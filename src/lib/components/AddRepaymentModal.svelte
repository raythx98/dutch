<script lang="ts">
	import { currencyStore, guessedCurrencyCode } from '$lib/currency';
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';
	import { auth } from '$lib/auth';
	import { onMount } from 'svelte';
	import type { User, Expense, Currency } from '$lib/types';

	interface Props {
		groupId: string;
		members: User[];
		expense?: Expense;
		prefill?: { amount: string; payerId: string; recipientId: string; currencyCode: string };
		usedCurrencies?: Currency[];
		onClose: () => void;
		onSuccess: () => void;
	}

	let {
		groupId,
		members,
		expense,
		prefill,
		usedCurrencies = [],
		onClose,
		onSuccess
	}: Props = $props();

	let isEditing = $derived(!!expense);
	let isViewOnly = $state(false);

	let name = $state<string>('Repayment');
	let description = $state<string>('');
	let amount = $state<string>('');
	let currencyId = $state<string>('');

	const displayCurrencies = $derived.by(() => {
		const usedIds = new Set(usedCurrencies.map((c: Currency) => c.id));
		
		// Find guessed currency if it's not already in usedCurrencies
		const guessedCurrency = $currencyStore.find(
			(c: Currency) => c.code === $guessedCurrencyCode && !usedIds.has(c.id)
		);
		
		const priorityIds = new Set([...usedIds]);
		if (guessedCurrency) priorityIds.add(guessedCurrency.id);

		const others = $currencyStore.filter((c: Currency) => !priorityIds.has(c.id));

		const topSection = [...usedCurrencies];
		if (guessedCurrency) topSection.push(guessedCurrency);

		if (topSection.length === 0) return $currencyStore;
		if (others.length === 0) return topSection;

		return [
			...topSection,
			{ id: 'separator', code: '──────────', symbol: '', name: 'Separator' },
			...others
		];
	});

	function getLocalDate(date: Date) {
		const offset = date.getTimezoneOffset();
		const localDate = new Date(date.getTime() - offset * 60 * 1000);
		return localDate.toISOString().slice(0, 10);
	}

	function getLocalTime(date: Date) {
		const h = String(date.getHours()).padStart(2, '0');
		const m = String(date.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}

	let initialDate = new Date();
	let expenseDate = $state<string>(getLocalDate(initialDate));
	let expenseTime = $state<string>('00:00');

	$effect.pre(() => {
		if (expense) {
			isViewOnly = true;
			name = expense.name;
			description = expense.description || '';
			amount = expense.amount;
			const d = new Date(expense.expenseAt);
			expenseDate = getLocalDate(d);
			expenseTime = getLocalTime(d);
		} else if (prefill) {
			amount = prefill.amount;
		}
	});

	let payerId = $state<string>('');
	let recipientId = $state<string>('');
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let amountInput: HTMLInputElement;

	function validate() {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Title is required';
		} else if (name.length > 100) {
			newErrors.name = 'Title too long (max 100)';
		}

		if (description.length > 1000) {
			newErrors.description = 'Description too long (max 1000)';
		}

		const totalAmount = parseFloat(amount);
		if (isNaN(totalAmount) || totalAmount < 0) {
			newErrors.amount = 'Valid amount is required';
		}

		if (!currencyId) {
			newErrors.currency = 'Currency is required';
		}

		if (!expenseDate) {
			newErrors.date = 'Date is required';
		}

		if (!expenseTime) {
			newErrors.time = 'Time is required';
		}

		if (payerId === recipientId) {
			newErrors.recipient = 'Payer and recipient must be different';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	const sortedMembers = $derived(
		[...members].sort((a, b) => (a.id === $auth.user?.id ? -1 : b.id === $auth.user?.id ? 1 : 0))
	);

	$effect(() => {
		if (sortedMembers.length > 0 && !payerId) {
			if (expense) {
				payerId = expense.payers[0].user.id;
				recipientId = expense.shares[0].user.id;
			} else if (prefill) {
				payerId = prefill.payerId;
				recipientId = prefill.recipientId;
			} else {
				payerId = $auth.user?.id || sortedMembers[0].id;
				const firstNonMe = sortedMembers.find((m: User) => m.id !== $auth.user?.id);
				recipientId = firstNonMe ? firstNonMe.id : sortedMembers[0].id;
			}
		}
	});

	$effect(() => {
		if (displayCurrencies.length > 0 && !currencyId) {
			if (expense) {
				const found = displayCurrencies.find((c: Currency) => c.code === expense.currency.code);
				if (found && found.id !== 'separator') currencyId = found.id;
			} else if (prefill) {
				const found = displayCurrencies.find((c: Currency) => c.code === prefill.currencyCode);
				if (found && found.id !== 'separator') currencyId = found.id;
			} else {
				// Default to first available currency in the prioritized list
				const first = displayCurrencies.find((c: Currency) => c.id !== 'separator');
				if (first) currencyId = first.id;
			}
		}
	});

	onMount(() => {
		if (amountInput && !isViewOnly) amountInput.focus();
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (isViewOnly) return;

		if (!validate()) {
			const firstError = Object.values(errors)[0];
			toast.error(firstError);
			return;
		}

		loading = true;

		const totalAmount = parseFloat(amount);
		// Convert local date/time to UTC
		const localDateTime = new Date(`${expenseDate}T${expenseTime}:00`);
		const expenseAt = localDateTime.toISOString();

		let data;
		if (isEditing) {
			const input = {
				name,
				description,
				type: 'Repayment',
				amount: totalAmount.toFixed(2),
				currencyId,
				expenseAt,
				payers: [{ userId: recipientId, amount: totalAmount.toFixed(2) }],
				shares: [{ userId: payerId, amount: totalAmount.toFixed(2) }]
			};
			data = await query(
				`
				mutation EditExpense($id: ID!, $input: ExpenseInput!) {
					editExpense(expenseId: $id, input: $input) {
						id
					}
											}
										`,
				{ id: expense?.id, input }
			);
		} else {
			const input = {
				name,
				description,
				type: 'Repayment',
				amount: totalAmount.toFixed(2),
				currencyId,
				expenseAt,
				debtor: recipientId,
				creditor: payerId
			};
			data = await query(
				`
				mutation AddRepayment($groupId: ID!, $input: RepaymentInput!) {
					addRepayment(groupId: $groupId, input: $input) {
						id
					}
				}
			`,
				{ groupId, input }
			);
		}

		if (data) {
			toast.success(isEditing ? 'Repayment updated' : 'Repayment recorded');
			onSuccess();
		}
		loading = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
	<div class="modal-content" onclick={(e) => e.stopPropagation()} aria-hidden="true">
		<header class="modal-header">
			<h2>
				{isEditing ? (isViewOnly ? 'Repayment Details' : 'Edit Repayment') : 'Record Repayment'}
			</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<form onsubmit={handleSubmit}>
			<div class="form-group">
				<label for="name">Title</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					placeholder="Repayment"
					required
					disabled={isViewOnly}
					class:error={errors.name}
				/>
				{#if errors.name}<span class="error-text">{errors.name}</span>{/if}
			</div>

			<div class="form-group">
				<label for="description">Description (Optional)</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Add more details..."
					disabled={isViewOnly}
					class:error={errors.description}
				></textarea>
				{#if errors.description}<span class="error-text">{errors.description}</span>{/if}
			</div>

			<div class="form-group">
				<label for="amount">Amount</label>
				<div class="input-with-currency" class:error={errors.amount || errors.currency}>
					<select bind:value={currencyId} disabled={isViewOnly}>
						<option value="" disabled selected>Select</option>
						{#each displayCurrencies as curr (curr.id)}
							<option value={curr.id} disabled={curr.id === 'separator'}>
								{curr.code}
								{curr.symbol ? `(${curr.symbol})` : ''}
							</option>
						{/each}
					</select>
					<input
						type="number"
						id="amount"
						step="0.01"
						bind:this={amountInput}
						bind:value={amount}
						placeholder="0.00"
						required
						disabled={isViewOnly}
					/>
				</div>
				{#if errors.amount}<span class="error-text">{errors.amount}</span>{/if}
				{#if errors.currency}<span class="error-text">{errors.currency}</span>{/if}
			</div>

			<div class="form-row compact-row">
				<div class="form-group">
					<label for="date">Date</label>
					<input
						type="date"
						id="date"
						bind:value={expenseDate}
						required
						disabled={isViewOnly}
						class:error={errors.date}
					/>
					{#if errors.date}<span class="error-text">{errors.date}</span>{/if}
				</div>
				<div class="form-group">
					<label for="time">Time</label>
					<input
						type="time"
						id="time"
						bind:value={expenseTime}
						required
						disabled={isViewOnly}
						class:error={errors.time}
					/>
					{#if errors.time}<span class="error-text">{errors.time}</span>{/if}
				</div>
			</div>

			<div class="form-group large-select">
				<label for="debtor">Who paid?</label>
				<select id="debtor" bind:value={payerId} required disabled={isViewOnly}>
					{#each sortedMembers as member (member.id)}
						<option value={member.id}>
							{member.name}
							{member.id === $auth.user?.id ? '(Me)' : ''}
						</option>
					{/each}
				</select>
			</div>

			<div class="form-group large-select">
				<label for="creditor">To whom?</label>
				<select
					id="creditor"
					bind:value={recipientId}
					required
					disabled={isViewOnly}
					class:error={errors.recipient}
				>
					{#each sortedMembers as member (member.id)}
						<option value={member.id}>
							{member.name}
							{member.id === $auth.user?.id ? '(Me)' : ''}
						</option>
					{/each}
				</select>
				{#if errors.recipient}<span class="error-text">{errors.recipient}</span>{/if}
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
				{#if isViewOnly}
					<button type="button" class="btn btn-primary" onclick={() => (isViewOnly = false)}
						>Edit</button
					>
				{:else}
					<button type="submit" class="btn btn-primary" disabled={loading}>
						{loading ? 'Saving...' : isEditing ? 'Update Repayment' : 'Record Repayment'}
					</button>
				{/if}
			</div>
		</form>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		width: 100%;
		max-width: 400px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #9ca3af;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.compact-row {
		margin-bottom: 0.75rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input[type='text'],
	.form-group textarea {
		padding: 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		width: 100%;
		font-size: 1rem;
	}

	.form-group textarea {
		resize: vertical;
		min-height: 60px;
	}

	.form-group input:disabled,
	.form-group textarea:disabled {
		background: #f9fafb;
		color: #111827;
	}

	.large-select label {
		font-size: 1rem;
		color: #111827;
	}

	.large-select select {
		font-size: 1rem;
		padding: 0.75rem;
	}

	.input-with-currency.error {
		border-color: #ef4444;
	}

	.error-text {
		color: #ef4444;
		font-size: 0.75rem;
		margin-top: 0.25rem;
		display: block;
	}

	select.error,
	input.error {
		border-color: #ef4444;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
	}

	@media (max-width: 480px) {
		.modal-content {
			width: 90%;
			padding: 1.5rem;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.modal-actions {
			flex-direction: column-reverse;
		}

		.modal-actions button {
			width: 100%;
		}
	}
</style>
