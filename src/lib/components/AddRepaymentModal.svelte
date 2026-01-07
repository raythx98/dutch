<script lang="ts">
	import { currencyStore } from '$lib/currency';
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';
	import { auth } from '$lib/auth';
	import { onMount } from 'svelte';

	let { groupId, members, onClose, onSuccess } = $props();

	let amount = $state<string>('');
	let currencyId = $state<string>('');
	
	function getLocalDate(date: Date) {
		const offset = date.getTimezoneOffset();
		const localDate = new Date(date.getTime() - (offset * 60 * 1000));
		return localDate.toISOString().slice(0, 10);
	}

	let expenseDate = $state<string>(getLocalDate(new Date()));
	let expenseTime = $state<string>('00:00');
	
	let debtorId = $state<string>('');
	let creditorId = $state<string>('');
	let loading = $state(false);
	let amountInput: HTMLInputElement;

	$effect(() => {
		if (members.length > 0) {
			if (!debtorId) debtorId = $auth.user?.id || members[0].id;
			if (!creditorId) {
				const firstNonMe = members.find((m: any) => m.id !== $auth.user?.id);
				creditorId = firstNonMe ? firstNonMe.id : members[0].id;
			}
		}
	});

	$effect(() => {
		if ($currencyStore.length > 0 && !currencyId) {
			currencyId = $currencyStore[0].id;
		}
	});

	onMount(() => {
		if (amountInput) amountInput.focus();
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
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

		const input = {
			amount: totalAmount.toFixed(2),
			currencyId,
			expenseAt,
			debtor: debtorId,
			creditor: creditorId
		};

		const data = await query(`
			mutation AddRepayment($groupId: ID!, $input: RepaymentInput!) {
				addRepayment(groupId: $groupId, input: $input) {
					id
				}
			}
		`, { groupId, input });

		if (data) {
			toast.success('Repayment recorded');
			onSuccess();
		}
		loading = false;
	}
</script>

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
	<div class="modal-content" onclick={e => e.stopPropagation()} aria-hidden="true">
		<header>
			<h2>Record Repayment</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<form onsubmit={handleSubmit}>
			<div class="form-group">
				<label for="amount">Amount</label>
				<div class="input-with-currency">
					<select bind:value={currencyId}>
						{#each $currencyStore as curr}
							<option value={curr.id}>{curr.symbol}{curr.code}</option>
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
					/>
				</div>
			</div>

			<div class="form-row compact-row">
				<div class="form-group">
					<label for="date">Date</label>
					<input type="date" id="date" bind:value={expenseDate} required />
				</div>
				<div class="form-group">
					<label for="time">Time</label>
					<input type="time" id="time" bind:value={expenseTime} required />
				</div>
			</div>

			<div class="form-group large-select">
				<label for="debtor">Who paid?</label>
				<select id="debtor" bind:value={debtorId} required>
					{#each members as member}
						<option value={member.id}>
							{member.name} {member.id === $auth.user?.id ? '(Me)' : ''}
						</option>
					{/each}
				</select>
			</div>

			<div class="form-group large-select">
				<label for="creditor">To whom?</label>
				<select id="creditor" bind:value={creditorId} required>
					{#each members as member}
						<option value={member.id}>
							{member.name} {member.id === $auth.user?.id ? '(Me)' : ''}
						</option>
					{/each}
				</select>
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={loading}>
					{loading ? 'Recording...' : 'Record Repayment'}
				</button>
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

	.input-with-currency select {
		border: none;
		background: #f3f4f6;
		padding: 0.5rem;
		border-right: 1px solid #d1d5db;
	}

	.input-with-currency input {
		border: none;
		padding: 0.5rem;
		flex: 1;
		width: 100%;
	}

	input[type="date"], input[type="time"], select {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 2rem;
	}
</style>
