<script lang="ts">
	import { currencyStore, fetchAndSyncCurrencies } from '$lib/currency';
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';
	import { auth } from '$lib/auth';
	import { onMount } from 'svelte';

	let { groupId, members, expense, onClose, onSuccess } = $props();

	let isEditing = !!expense;
	let isViewOnly = $state(!!expense);

	let name = $state<string>(expense ? expense.name : 'Repayment');
	let description = $state<string>(expense ? expense.description : '');
	let amount = $state<string>(expense ? expense.amount : '');
	let currencyId = $state<string>('');
	
	function getLocalDate(date: Date) {
		const offset = date.getTimezoneOffset();
		const localDate = new Date(date.getTime() - (offset * 60 * 1000));
		return localDate.toISOString().slice(0, 10);
	}

	function getLocalTime(date: Date) {
		const h = String(date.getHours()).padStart(2, '0');
		const m = String(date.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}

	let initialDate = expense ? new Date(expense.expenseAt) : new Date();
	let expenseDate = $state<string>(getLocalDate(initialDate));
	let expenseTime = $state<string>(expense ? getLocalTime(initialDate) : '00:00');
	
	let debtorId = $state<string>('');
	let creditorId = $state<string>('');
	let loading = $state(false);
	let amountInput: HTMLInputElement;

	$effect(() => {
		if (members.length > 0 && !debtorId) {
			if (expense) {
				debtorId = expense.payers[0]?.user.id;
				creditorId = expense.shares[0]?.user.id;
			} else {
				debtorId = $auth.user?.id || members[0].id;
				const firstNonMe = members.find((m: any) => m.id !== $auth.user?.id);
				creditorId = firstNonMe ? firstNonMe.id : members[0].id;
			}
		}
	});

	$effect(() => {
		if ($currencyStore.length > 0 && !currencyId) {
			if (expense) {
				const found = $currencyStore.find(c => c.code === expense.currency.code);
				if (found) currencyId = found.id;
			} else {
				currencyId = $currencyStore[0].id;
			}
		}
	});

	onMount(() => {
		if (amountInput && !isViewOnly) amountInput.focus();
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (isViewOnly) return;

		const totalAmount = parseFloat(amount);
		if (isNaN(totalAmount) || totalAmount <= 0) {
			toast.error('Please enter a valid amount');
			return;
		}

		if (debtorId === creditorId) {
			toast.error('Debtor and Creditor cannot be the same person');
			return;
		}

		loading = true;

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
				payers: [{ userId: debtorId, amount: totalAmount.toFixed(2) }],
				shares: [{ userId: creditorId, amount: totalAmount.toFixed(2) }]
			};
			data = await query(`
				mutation EditExpense($id: ID!, $input: ExpenseInput!) {
					editExpense(expenseId: $id, input: $input) {
						id
					}
				}
			`, { id: expense.id, input });
		} else {
			const input = {
				name,
				description,
				type: 'Repayment',
				amount: totalAmount.toFixed(2),
				currencyId,
				expenseAt,
				debtor: debtorId,
				creditor: creditorId
			};
			data = await query(`
				mutation AddRepayment($groupId: ID!, $input: RepaymentInput!) {
					addRepayment(groupId: $groupId, input: $input) {
						id
					}
				}
			`, { groupId, input });
		}

		if (data) {
			toast.success(isEditing ? 'Repayment updated' : 'Repayment recorded');
			fetchAndSyncCurrencies();
			onSuccess();
		}
		loading = false;
	}
</script>

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
	<div class="modal-content" onclick={e => e.stopPropagation()} aria-hidden="true">
		<header>
			<h2>{isEditing ? (isViewOnly ? 'Repayment Details' : 'Edit Repayment') : 'Record Repayment'}</h2>
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
				/>
			</div>

			<div class="form-group">
				<label for="description">Description (Optional)</label>
				<textarea 
					id="description" 
					bind:value={description} 
					placeholder="Add more details..." 
					disabled={isViewOnly}
				></textarea>
			</div>

			<div class="form-group">
				<label for="amount">Amount</label>
				<div class="input-with-currency">
					<select bind:value={currencyId} disabled={isViewOnly}>
						{#each $currencyStore as curr}
							<option value={curr.id}>{curr.code} ({curr.symbol})</option>
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
			</div>

			<div class="form-row compact-row">
				<div class="form-group">
					<label for="date">Date</label>
					<input type="date" id="date" bind:value={expenseDate} required disabled={isViewOnly} />
				</div>
				<div class="form-group">
					<label for="time">Time</label>
					<input type="time" id="time" bind:value={expenseTime} required disabled={isViewOnly} />
				</div>
			</div>

			<div class="form-group large-select">
				<label for="debtor">Who paid?</label>
				<select id="debtor" bind:value={debtorId} required disabled={isViewOnly}>
					{#each members as member}
						<option value={member.id}>
							{member.name} {member.id === $auth.user?.id ? '(Me)' : ''}
						</option>
					{/each}
				</select>
			</div>

			<div class="form-group large-select">
				<label for="creditor">To whom?</label>
				<select id="creditor" bind:value={creditorId} required disabled={isViewOnly}>
					{#each members as member}
						<option value={member.id}>
							{member.name} {member.id === $auth.user?.id ? '(Me)' : ''}
						</option>
					{/each}
				</select>
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
				{#if isViewOnly}
					<button type="button" class="btn btn-primary" onclick={() => isViewOnly = false}>Edit</button>
				{:else}
					<button type="submit" class="btn btn-primary" disabled={loading}>
						{loading ? 'Saving...' : (isEditing ? 'Update Repayment' : 'Record Repayment')}
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
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	header h2 { margin: 0; font-size: 1.25rem; }

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

	.form-group input[type="text"],
	.form-group textarea {
		padding: 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		width: 100%;
		font-size: 0.95rem;
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

	.input-with-currency {
		display: flex;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		overflow: hidden;
	}

	.input-with-currency select:disabled { background: #f9fafb; color: #6b7280; }

	.input-with-currency input {
		border: none;
		padding: 0.5rem;
		flex: 1;
		width: 100%;
	}

	.input-with-currency input:disabled { background: #f9fafb; color: #111827; }

	input[type="date"], input[type="time"], select {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
	}

	input[type="date"]:disabled, input[type="time"]:disabled, select:disabled {
		background: #f9fafb;
		color: #111827;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 2rem;
	}
</style>
