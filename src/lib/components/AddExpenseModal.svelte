<script lang="ts">
	import { currencyStore } from '$lib/currency';
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';
	import { auth } from '$lib/auth';
	import { onMount } from 'svelte';
	import type { User, Expense, Currency, Share } from '$lib/types';

	interface Props {
		groupId: string;
		members: User[];
		expense?: Expense;
		usedCurrencies?: Currency[];
		onClose: () => void;
		onSuccess: () => void;
	}

	let { groupId, members, expense, usedCurrencies = [], onClose, onSuccess }: Props = $props();

	let isEditing = $derived(!!expense);
	let isViewOnly = $state(false);

	let name = $state<string>('');
	let description = $state<string>('');
	let amount = $state<string>('');
	let currencyId = $state<string>('');

	const displayCurrencies = $derived.by(() => {
		const usedIds = new Set(usedCurrencies.map((c: Currency) => c.id));
		const others = $currencyStore.filter((c: Currency) => !usedIds.has(c.id));

		if (usedCurrencies.length === 0) return $currencyStore;
		if (others.length === 0) return usedCurrencies;

		return [
			...usedCurrencies,
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
		}
	});

	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let amountInput: HTMLInputElement;

	function validate() {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Expense name is required';
		} else if (name.length > 100) {
			newErrors.name = 'Name too long (max 100)';
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

		if (Object.keys(newErrors).length === 0) {
			const payersSum = payers.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
			if (Math.abs(payersSum - totalAmount) > 0.01) {
				newErrors.payers = `Sum (${payersSum.toFixed(2)}) must equal total (${totalAmount.toFixed(2)})`;
			}

			const sharesSum = shares.reduce((sum, s) => sum + parseFloat(s.amount || '0'), 0);
			if (Math.abs(sharesSum - totalAmount) > 0.01) {
				newErrors.shares = `Sum (${sharesSum.toFixed(2)}) must equal total (${totalAmount.toFixed(2)})`;
			}
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	const sortedMembers = $derived(
		[...members].sort((a, b) => (a.id === $auth.user?.id ? -1 : b.id === $auth.user?.id ? 1 : 0))
	);

	// Payers and Shares state
	let payers = $state<{ userId: string; amount: string }[]>([]);
	let shares = $state<{ userId: string; amount: string }[]>([]);

	let payersDiff = $derived.by(() => {
		const total = parseFloat(amount || '0');
		const sum = payers.reduce((acc, p) => acc + parseFloat(p.amount || '0'), 0);
		const diff = sum - total;
		if (Math.abs(diff) < 0.001) return null;
		return {
			val: Math.abs(diff).toFixed(2),
			text: diff > 0 ? 'exceed by' : 'under by'
		};
	});

	let sharesDiff = $derived.by(() => {
		const total = parseFloat(amount || '0');
		const sum = shares.reduce((acc, p) => acc + parseFloat(p.amount || '0'), 0);
		const diff = sum - total;
		if (Math.abs(diff) < 0.001) return null;
		return {
			val: Math.abs(diff).toFixed(2),
			text: diff > 0 ? 'exceed by' : 'under by'
		};
	});

	const filteredPayers = $derived(
		isViewOnly ? payers.filter((p) => parseFloat(p.amount) > 0) : payers
	);
	const filteredShares = $derived(
		isViewOnly ? shares.filter((s) => parseFloat(s.amount) > 0) : shares
	);

	function getName(member: User | undefined) {
		if (!member) return 'Unknown';
		return member.name;
	}

	$effect(() => {
		if (displayCurrencies.length > 0 && !currencyId) {
			if (expense) {
				const found = displayCurrencies.find((c: Currency) => c.code === expense.currency.code);
				if (found && found.id !== 'separator') currencyId = found.id;
			} else {
				// Default to first available currency (skip separator if it happens to be first, though unlikely)
				const first = displayCurrencies.find((c: Currency) => c.id !== 'separator');
				if (first) currencyId = first.id;
			}
		}
	});

	$effect(() => {
		if (sortedMembers.length > 0 && payers.length === 0) {
			if (expense) {
				payers = sortedMembers.map((m: User) => {
					const existing = expense.payers.find((p: Share) => p.user.id === m.id);
					return {
						userId: m.id,
						amount: existing ? parseFloat(existing.amount).toFixed(2) : '0.00'
					};
				});
				shares = sortedMembers.map((m: User) => {
					const existing = expense.shares.find((s: Share) => s.user.id === m.id);
					return {
						userId: m.id,
						amount: existing ? parseFloat(existing.amount).toFixed(2) : '0.00'
					};
				});
			} else {
				const currentUserId = $auth.user?.id;
				payers = sortedMembers.map((m: User) => ({
					userId: m.id,
					amount: m.id === currentUserId ? '0.00' : '0.00'
				}));
				shares = sortedMembers.map((m: User) => ({
					userId: m.id,
					amount: '0.00'
				}));
			}
		}
	});

	onMount(() => {
		if (amountInput && !isViewOnly) amountInput.focus();
	});

	function distributeEqually(totalStr: string, participants: { userId: string; amount: string }[]) {
		const total = parseFloat(totalStr);
		if (isNaN(total) || total <= 0) return participants.map((p) => ({ ...p, amount: '0.00' }));

		const count = participants.length;
		if (count === 0) return participants;

		const amountPerPerson = Math.floor((total * 100) / count) / 100;
		let remaining = Math.round((total - amountPerPerson * count) * 100);

		const newParticipants = participants.map((p) => ({ ...p, amount: amountPerPerson.toFixed(2) }));

		const indices = Array.from({ length: count }, (_, i) => i);
		for (let i = indices.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[indices[i], indices[j]] = [indices[j], indices[i]];
		}

		for (let i = 0; i < remaining; i++) {
			const idx = indices[i];
			newParticipants[idx].amount = (parseFloat(newParticipants[idx].amount) + 0.01).toFixed(2);
		}

		return newParticipants;
	}

	function handleAmountChange() {
		if (isViewOnly) return;
		const payersWithAmount = payers.filter((p) => parseFloat(p.amount) > 0);
		if (payersWithAmount.length <= 1) {
			let targetId = $auth.user?.id;
			if (payersWithAmount.length === 1) {
				targetId = payersWithAmount[0].userId;
			} else if (expense) {
				const originalPayer = expense.payers.find((p: Share) => parseFloat(p.amount) > 0);
				if (originalPayer) targetId = originalPayer.user.id;
			}

			payers = payers.map((p) => ({
				...p,
				amount: p.userId === targetId ? parseFloat(amount || '0').toFixed(2) : '0.00'
			}));
		}

		if (!isEditing) {
			shares = distributeEqually(amount, shares);
		}
	}

	function allocateFull(targetId: string, list: 'payers' | 'shares') {
		if (isViewOnly) return;
		const totalAmount = parseFloat(amount || '0').toFixed(2);
		if (list === 'payers') {
			payers = payers.map((p) => ({ ...p, amount: p.userId === targetId ? totalAmount : '0.00' }));
		} else {
			shares = shares.map((s) => ({ ...s, amount: s.userId === targetId ? totalAmount : '0.00' }));
		}
	}

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
		const localDateTime = new Date(`${expenseDate}T${expenseTime}:00`);
		const expenseAtVal = localDateTime.toISOString();

		const input = {
			name,
			description,
			type: 'Generic',
			amount: totalAmount.toFixed(2),
			currencyId,
			expenseAt: expenseAtVal,
			payers: payers
				.filter((p) => parseFloat(p.amount) > 0)
				.map((p) => ({
					userId: p.userId,
					amount: parseFloat(p.amount).toFixed(2)
				})),
			shares: shares
				.filter((s) => parseFloat(s.amount) > 0)
				.map((s) => ({
					userId: s.userId,
					amount: parseFloat(s.amount).toFixed(2)
				}))
		};

		let data;
		if (isEditing) {
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
			data = await query(
				`
				mutation AddExpense($groupId: ID!, $input: ExpenseInput!) {
					addExpense(groupId: $groupId, input: $input) {
						id
					}
				}
			`,
				{ groupId, input }
			);
		}

		if (data) {
			toast.success(isEditing ? 'Expense updated' : 'Expense added');
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
			<h2>{isEditing ? (isViewOnly ? 'Expense Details' : 'Edit Expense') : 'Add Expense'}</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<form onsubmit={handleSubmit}>
			<div class="form-group mb-1">
				<label for="name">Expense Name</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					placeholder="e.g. Dinner, Groceries"
					required
					disabled={isViewOnly}
					class:error={errors.name}
				/>
				{#if errors.name}<span class="error-text">{errors.name}</span>{/if}
			</div>

			<div class="form-group mb-1">
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

			<div class="form-row">
				<div class="form-group amount-group">
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
							oninput={handleAmountChange}
							placeholder="0.00"
							required
							disabled={isViewOnly}
						/>
					</div>
					{#if errors.amount}<span class="error-text">{errors.amount}</span>{/if}
					{#if errors.currency}<span class="error-text">{errors.currency}</span>{/if}
				</div>
				<div class="form-group date-time-group">
					<label for="date">Date & Time</label>
					<div class="date-time-inputs">
						<input
							type="date"
							id="date"
							bind:value={expenseDate}
							required
							disabled={isViewOnly}
							class:error={errors.date}
						/>
						<input
							type="time"
							id="time"
							bind:value={expenseTime}
							required
							disabled={isViewOnly}
							class:error={errors.time}
						/>
					</div>
					{#if errors.date}<span class="error-text">{errors.date}</span>{/if}
					{#if errors.time}<span class="error-text">{errors.time}</span>{/if}
				</div>
			</div>

			<div class="split-section">
				<div class="split-header">
					<h3>Paid by</h3>
					{#if payersDiff || errors.payers}
						<span class="hint warning"
							>{errors.payers || `${payersDiff?.text} ${payersDiff?.val}`}</span
						>
					{/if}
				</div>
				<div class="share-list">
					{#each filteredPayers as payer (payer.userId)}
						<div class="share-item">
							<div class="share-user">
								<span class="name">{getName(members.find((m: User) => m.id === payer.userId))}</span
								>
								{#if payer.userId === $auth.user?.id}
									<div class="me-tag-wrapper"><span class="me-tag">You</span></div>
								{/if}
							</div>
							<div class="share-input-row no-wrap">
								{#if !isViewOnly}
									<button
										type="button"
										class="quick-btn"
										title="Pay Full"
										onclick={() => allocateFull(payer.userId, 'payers')}>100%</button
									>
									<input type="number" step="0.01" bind:value={payer.amount} />
								{:else}
									<span class="amount-display">{parseFloat(payer.amount).toFixed(2)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				{#if !isViewOnly}
					<button
						type="button"
						class="split-equally-btn"
						onclick={() => (payers = distributeEqually(amount, payers))}>Split equally</button
					>
				{/if}
			</div>

			<div class="split-section">
				<div class="split-header">
					<h3>Split among</h3>
					{#if sharesDiff || errors.shares}
						<span class="hint warning"
							>{errors.shares || `${sharesDiff?.text} ${sharesDiff?.val}`}</span
						>
					{/if}
				</div>
				<div class="share-list">
					{#each filteredShares as share (share.userId)}
						<div class="share-item">
							<div class="share-user">
								<span class="name">{getName(members.find((m: User) => m.id === share.userId))}</span
								>
								{#if share.userId === $auth.user?.id}
									<div class="me-tag-wrapper"><span class="me-tag">You</span></div>
								{/if}
							</div>
							<div class="share-input-row no-wrap">
								{#if !isViewOnly}
									<button
										type="button"
										class="quick-btn"
										title="Full Share"
										onclick={() => allocateFull(share.userId, 'shares')}>100%</button
									>
									<input type="number" step="0.01" bind:value={share.amount} />
								{:else}
									<span class="amount-display">{parseFloat(share.amount).toFixed(2)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				{#if !isViewOnly}
					<button
						type="button"
						class="split-equally-btn"
						onclick={() => (shares = distributeEqually(amount, shares))}>Split equally</button
					>
				{/if}
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
				{#if isViewOnly}
					<button type="button" class="btn btn-primary" onclick={() => (isViewOnly = false)}
						>Edit</button
					>
				{:else}
					<button type="submit" class="btn btn-primary" disabled={loading}>
						{loading ? 'Saving...' : isEditing ? 'Update Expense' : 'Add Expense'}
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
		max-width: 500px;
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

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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
		min-height: 80px;
	}

	.form-group input:disabled,
	.form-group textarea:disabled {
		background: #f9fafb;
		color: #111827;
	}

	.mb-1 {
		margin-bottom: 1rem;
	}

	.input-with-currency.error {
		border-color: #ef4444;
	}

	.date-time-inputs {
		display: flex;
		gap: 0.5rem;
	}

	.date-time-inputs input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
	}

	.date-time-inputs input:disabled {
		background: #f9fafb;
		color: #111827;
	}

	.split-section {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 8px;
	}

	.split-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.split-section h3 {
		margin: 0;
		font-size: 0.875rem;
		text-transform: uppercase;
		color: #6b7280;
	}

	.hint {
		font-size: 0.8rem;
		font-weight: 600;
	}
	.hint.warning {
		color: #ef4444;
	}

	.share-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.share-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.amount-display {
		font-weight: 600;
		color: #111827;
		font-size: 1rem;
		min-width: 40px;
		text-align: right;
	}

	.share-user {
		display: flex;
		align-items: center;
		align-content: flex-start;
		flex-wrap: wrap;
		max-height: 1.5rem;
		overflow: hidden;
		font-size: 0.95rem;
		flex: 1;
		min-width: 0;
		line-height: 1.5rem;
		row-gap: 2rem;
	}

	.share-user .name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		flex: 0 1 auto;
	}

	.me-tag-wrapper {
		margin-left: 0.4rem;
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		height: 1.5rem;
	}

	.share-input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.share-item input {
		width: auto;
		max-width: 80px;
		padding: 0.25rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		text-align: right;
		flex-shrink: 0;
		min-width: 40px;
	}

	.share-item input:disabled {
		background: transparent;
		border: none;
		color: #111827;
		font-weight: 500;
	}

	.quick-btn {
		background: #e5e7eb;
		border: none;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		color: #4b5563;
		flex-shrink: 0;
		transition: transform 0.2s;
	}

	.quick-btn:active {
		transform: scale(0.96);
	}

	.quick-btn:hover {
		background: #d1d5db;
	}

	.split-equally-btn {
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		color: #374151;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		transition: all 0.2s;
		display: inline-block;
		margin-top: 0.5rem;
	}

	.split-equally-btn:active {
		transform: scale(0.96);
	}

	.split-equally-btn:hover {
		background: #e5e7eb;
		border-color: #9ca3af;
		color: #111827;
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

	@media (max-width: 640px) {
		.modal-content {
			width: 90%;
			padding: 1.5rem;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.share-item {
			gap: 0.5rem;
		}

		.share-input-row {
			flex-shrink: 0;
			flex-wrap: nowrap;
		}

		.share-item input {
			width: auto;
			max-width: 80px;
			min-width: 40px;
			flex-shrink: 0;
		}

		.modal-actions {
			flex-direction: column-reverse;
		}

		.modal-actions button {
			width: 100%;
		}
	}
</style>
