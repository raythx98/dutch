<script lang="ts">
	import { page } from '$app/stores';
	import { query } from '$lib/api';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import type { Group, Expense, ExpenseSummary, Currency } from '$lib/types';
	import AddMemberModal from '$lib/components/AddMemberModal.svelte';
	import AddExpenseModal from '$lib/components/AddExpenseModal.svelte';
	import AddRepaymentModal from '$lib/components/AddRepaymentModal.svelte';
	import DeleteGroupModal from '$lib/components/DeleteGroupModal.svelte';
	import DeleteExpenseModal from '$lib/components/DeleteExpenseModal.svelte';
	import InviteModal from '$lib/components/InviteModal.svelte';

	const groupId = $page.params.id;

	let group = $state<Group | null>(null);
	let summary = $state<ExpenseSummary | null>(null);
	let loading = $state(true);
	let activeTab = $state('expenses'); // 'expenses' or 'members'
	let showAddMember = $state(false);
	let showAddExpense = $state(false);
	let showAddRepayment = $state(false);
	let showDeleteGroup = $state(false);
	let showDeleteExpense = $state(false);
	let showInvite = $state(false);
	let editingExpense = $state<Expense | undefined>(undefined);
	let deletingExpense = $state<Expense | undefined>(undefined);
	let settlementPrefill = $state<{payerId: string, recipientId: string, amount: string, currencyCode: string} | undefined>(undefined);

	async function fetchData() {
		loading = true;
		
		const data = await query<{ group: Group, expenses: ExpenseSummary }>(`
			query GetGroupData($groupId: ID!) {
				group(groupId: $groupId) {
					id
					name
					inviteToken
					members {
						id
						name
					}
					usedCurrencies {
						id
						code
						symbol
						name
					}
				}
				expenses(groupId: $groupId) {
					expenses {
						id
						type
						name
						description
						amount
						expenseAt
						currency { id code symbol name }
						payers {
							user { id name }
							amount
						}
						shares {
							user { id name }
							amount
						}
					}
					owes {
						user { id name }
						amount
						currency { code symbol name }
					}
					owed {
						user { id name }
						amount
						currency { code symbol name }
					}
				}
			}
		`, { groupId });

		if (data) {
			group = data.group;
			summary = data.expenses;
		}

		if (!group) {
			toast.error('Group not found');
			goto(`${base}/dashboard`);
			return;
		}
		
		loading = false;
	}

	async function handleDeleteExpense(e: Event, expense: Expense) {
		e.stopPropagation();
		deletingExpense = expense;
		showDeleteExpense = true;
	}

	function getBalanceForExpense(expense: Expense) {
		const myId = $auth.user?.id;
		if (!myId) return null;

		const paidByMe = expense.payers.find(p => p.user.id === myId);
		const myShare = expense.shares.find(s => s.user.id === myId);

		const paid = paidByMe ? parseFloat(paidByMe.amount) : 0;
		const share = myShare ? parseFloat(myShare.amount) : 0;
		const diff = paid - share;

		if (Math.abs(diff) < 0.01) return null;

		return {
			amount: Math.abs(diff).toFixed(2),
			isOwed: diff > 0
		};
	}

	function openEditExpense(expense: Expense) {
		editingExpense = expense;
		if (expense.type === 'Repayment') {
			showAddRepayment = true;
		} else {
			showAddExpense = true;
		}
	}

	function openSettlement(payerId: string, recipientId: string, amount: string, currencyCode: string) {
		settlementPrefill = { payerId, recipientId, amount, currencyCode };
		showAddRepayment = true;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			const anyModalOpen = showAddMember || showAddExpense || showAddRepayment || showDeleteGroup || showDeleteExpense || showInvite;
			if (!anyModalOpen) {
				e.preventDefault();
				goto(`${base}/dashboard`);
			}
		}
	}

	onMount(fetchData);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="group-page">
	<header class="group-header">
		<div class="header-top">
			<div class="title-group">
				<button class="btn btn-back" onclick={() => goto(`${base}/dashboard`)}>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
					<span class="back-text">Dashboard</span>
				</button>
				{#if group}
					<h1 class="group-title">{group.name}</h1>
				{:else}
					<h1 class="group-title">Loading...</h1>
				{/if}
			</div>

			{#if group}
				<div class="header-actions">
					<button class="btn btn-secondary btn-icon" onclick={() => showInvite = true} title="Share Group">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
					</button>
					<button class="btn btn-danger-outline btn-icon" onclick={() => showDeleteGroup = true} title="Delete Group">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
					</button>
					<button class="btn btn-primary add-member-top" onclick={() => showAddMember = true}>Add Member</button>
				</div>
			{/if}
		</div>

		{#if summary}
			<section class="balance-summary">
				<div class="card owed">
					<h3>You are owed</h3>
					{#each summary.owed as o}
						<div class="balance-row">
							<span class="label">{o.user.name}</span>
							<div class="owe-actions">
								<span class="value positive">
									{o.currency.symbol}{o.amount} {o.currency.code}
								</span>
								<button class="btn btn-xs btn-outline" onclick={() => openSettlement(o.user.id, $auth.user?.id || '', o.amount, o.currency.code)}>Settle</button>
							</div>
						</div>
					{:else}
						<p class="empty-msg">Nobody owes you anything.</p>
					{/each}
				</div>
				<div class="card owes">
					<h3>You owe</h3>
					{#each summary.owes as o}
						<div class="balance-row">
							<span class="label">{o.user.name}</span>
							<div class="owe-actions">
								<span class="value negative">
									{o.currency.symbol}{o.amount} {o.currency.code}
								</span>
								<button class="btn btn-xs btn-outline" onclick={() => openSettlement($auth.user?.id || '', o.user.id, o.amount, o.currency.code)}>Settle</button>
							</div>
						</div>
					{:else}
						<p class="empty-msg">You don't owe anything.</p>
					{/each}
				</div>
			</section>
		{/if}

		<nav class="tabs">
			<button 
				class:active={activeTab === 'expenses'} 
				onclick={() => activeTab = 'expenses'}
			>
				Expenses
			</button>
			<button 
				class:active={activeTab === 'members'} 
				onclick={() => activeTab = 'members'}
			>
				Members
			</button>
		</nav>
	</header>

	<main>
		{#if loading && !group}
			<p>Loading...</p>
		{:else if activeTab === 'expenses'}
			<section class="expenses-tab">
				<div class="tab-header">
					<h2>Expenses</h2>
					<div class="actions">
						<button class="btn btn-primary" onclick={() => { editingExpense = undefined; showAddExpense = true; }}>Add Expense</button>
					</div>
				</div>
				
				<div class="expense-list">
					{#each summary?.expenses || [] as expense}
						{@const balance = getBalanceForExpense(expense)}
						<div class="expense-item-container">
							<div 
								class="expense-item" 
								class:repayment-item={expense.type === 'Repayment'}
								class:generic-item={expense.type === 'Generic'}
								onclick={() => openEditExpense(expense)}
								role="button"
								tabindex="0"
								onkeydown={e => e.key === 'Enter' && openEditExpense(expense)}
							>
								<div class="expense-date">
									<span class="month">{new Date(expense.expenseAt).toLocaleDateString(undefined, {month: 'short'})}</span>
									<span class="day">{new Date(expense.expenseAt).getDate()}</span>
								</div>
								
								<div class="expense-icon-container">
									{#if expense.type === 'Repayment'}
										<div class="expense-icon repayment-icon">
											<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
										</div>
									{:else}
										<div class="expense-icon generic-icon">
											<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/></svg>
										</div>
									{/if}
								</div>

								<div class="expense-info">
									<div class="expense-name">{expense.name || expense.type}</div>
									<div class="expense-details">
										{#if expense.type === 'Repayment'}
											{@const payer = expense.payers[0]?.user.name === $auth.user?.name ? 'You' : expense.payers[0]?.user.name}
											{@const recipient = expense.shares[0]?.user.name === $auth.user?.name ? 'you' : expense.shares[0]?.user.name}
											<span class="paid-by">{payer} paid {recipient}</span>
										{:else}
											<span class="paid-by">Paid by {expense.payers[0]?.user.name === $auth.user?.name ? 'You' : expense.payers[0]?.user.name}</span>
											<span class="split-info">
												<span class="dot">&bull;</span>
												<span>Split among {expense.shares.length} people</span>
											</span>
										{/if}
									</div>
								</div>

								{#if balance && expense.type !== 'Repayment'}
									<div class="expense-balance" class:positive={balance.isOwed} class:negative={!balance.isOwed}>
										<span class="label">{balance.isOwed ? 'YOU LENT' : 'BORROWED'}</span>
										<span class="val">
											{expense.currency.symbol}{balance.amount} {expense.currency.code}
										</span>
									</div>
								{/if}

								<div class="expense-amount">
									{expense.currency.symbol}{expense.amount} {expense.currency.code}
								</div>

								<button class="delete-btn" onclick={(e) => handleDeleteExpense(e, expense)} title="Delete">&times;</button>
							</div>
						</div>
					{:else}
						<div class="empty-state">
							<p>No expenses yet. Start by adding one!</p>
						</div>
					{/each}
				</div>
			</section>
		{:else if activeTab === 'members'}
			<section class="members-tab">
				<div class="tab-header">
					<h2>Group Members</h2>
				</div>
				
				{#if group}
					{@const sortedMembers = [...group.members].sort((a, b) => a.id === $auth.user?.id ? -1 : (b.id === $auth.user?.id ? 1 : 0))}
					<ul class="member-list">
						{#each sortedMembers as member}
							<li>
								<span class="name">
									{member.name} 
									{#if member.id === $auth.user?.id}
										<strong class="me-tag" style="margin-left: 0.5rem">You</strong>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</main>

	{#if showAddMember}
		<AddMemberModal 
			groupId={groupId} 
			onClose={() => showAddMember = false} 
			onSuccess={() => { showAddMember = false; fetchData(); }} 
		/>
	{/if}

	{#if showAddExpense && group}
		<AddExpenseModal 
			groupId={groupId} 
			members={group.members}
			expense={editingExpense}
			usedCurrencies={group.usedCurrencies}
			onClose={() => { showAddExpense = false; editingExpense = undefined; }} 
			onSuccess={() => { showAddExpense = false; editingExpense = undefined; fetchData(); }} 
		/>
	{/if}

	{#if showAddRepayment && group}
		<AddRepaymentModal 
			groupId={groupId} 
			members={group.members} 
			expense={editingExpense}
			prefill={settlementPrefill}
			usedCurrencies={group.usedCurrencies}
			onClose={() => { showAddRepayment = false; editingExpense = undefined; settlementPrefill = undefined; }} 
			onSuccess={() => { showAddRepayment = false; editingExpense = undefined; settlementPrefill = undefined; fetchData(); }} 
		/>
	{/if}

	{#if showDeleteGroup && group}
		<DeleteGroupModal 
			group={group}
			onClose={() => showDeleteGroup = false}
		/>
	{/if}

	{#if showDeleteExpense && deletingExpense}
		<DeleteExpenseModal 
			expense={deletingExpense}
			onClose={() => { showDeleteExpense = false; deletingExpense = undefined; }}
			onSuccess={() => { showDeleteExpense = false; deletingExpense = undefined; fetchData(); }}
		/>
	{/if}

	{#if showInvite && group}
		<InviteModal 
			inviteToken={group.inviteToken}
			onClose={() => showInvite = false}
		/>
	{/if}
</div>

<style>
	.group-page {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		width: 100%;
		box-sizing: border-box;
	}

	.group-header {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		margin-bottom: 2rem;
		width: 100%;
	}

	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		max-width: 100%;
	}

	.group-title {
		margin: 0;
		font-size: 1.25rem;
		line-height: 1.2;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		margin-left: auto;
	}

	.header-actions .btn-icon {
		padding: 0;
	}

	.btn-danger-outline {
		background: white;
		border: 1px solid #fee2e2;
		color: #ef4444;
	}

	.btn-danger-outline:hover {
		background: #fef2f2;
		border-color: #fecaca;
	}

	.balance-summary {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.owe-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 0 1 auto;
		min-width: 0;
		max-width: 100%;
		justify-content: flex-end;
	}

	.tabs {
		display: flex;
		gap: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.tabs button {
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-weight: 600;
		color: #6b7280;
		font-size: 1rem;
	}

	.tabs button.active {
		color: #2563eb;
		border-bottom-color: #2563eb;
	}

	.tab-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		margin-top: 2rem;
	}

	.tab-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.tab-header .actions {
		display: flex;
		gap: 0.5rem;
	}

	.expense-list {
		display: flex;
		flex-direction: column;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		overflow: hidden;
	}

	.expense-item-container {
		container-type: inline-size;
		width: 100%;
		border-bottom: 1px solid #f3f4f6;
	}

	.expense-item-container:last-child {
		border-bottom: none;
	}

	.expense-item {
		display: flex;
		align-items: center;
		padding: 1rem;
		gap: 0.75rem;
		cursor: pointer;
		transition: background-color 0.2s;
		border-left: 4px solid transparent;
		min-width: 0;
	}

	.expense-item:hover {
		background-color: #f9fafb;
	}

	.expense-date {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 45px;
		color: #6b7280;
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.expense-date .day {
		font-size: 1.1rem;
		font-weight: 700;
		color: #374151;
	}

	.expense-icon-container {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.expense-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.generic-icon {
		background-color: #eff6ff;
		color: #3b82f6;
	}

	.repayment-icon {
		background-color: #f0fdf4;
		color: #22c55e;
	}

	.expense-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		overflow: hidden;
	}

	.expense-name {
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.125rem;
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}

	.expense-details {
		font-size: 0.8125rem;
		color: #6b7280;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
		display: block;
	}

	.paid-by {
		display: inline;
	}

	.split-info {
		display: inline;
	}

	.dot { color: #d1d5db; margin: 0 0.25rem; }

	.expense-balance {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 0.75rem;
		min-width: 0;
		flex-shrink: 1;
		margin-left: 0.5rem;
	}

	.expense-balance .label {
		color: #6b7280;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.025em;
		white-space: nowrap;
	}

	.expense-balance .val { 
		font-weight: 600; 
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.expense-balance.positive .val { color: #059669; }
	.expense-balance.negative .val { color: #dc2626; }

	.expense-amount {
		font-weight: 700;
		font-size: 1.05rem;
		min-width: 80px;
		text-align: right;
		flex-shrink: 0;
		margin-left: 0.5rem;
	}

	.repayment-item {
		background-color: #fcfdfc;
		border-left-color: #22c55e;
	}

	.generic-item {
		border-left-color: #d1d5db;
	}

	.delete-btn {
		background: none;
		border: none;
		color: #d1d5db;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0.5rem;
		flex-shrink: 0;
		margin-left: 0.5rem;
	}

	.delete-btn:hover { color: #ef4444; }

	/* Column Disappearing logic based on container width */
	@container (max-width: 700px) {
		.split-info { display: none; }
	}

	@container (max-width: 570px) {
		.expense-icon-container { display: none; }
	}

	@container (max-width: 530px) {
		.expense-amount { display: none; }
	}

	.member-list {
		list-style: none;
		padding: 0;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
	}

	.member-list li {
		padding: 1rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.member-list li:last-child {
		border-bottom: none;
	}

	.empty-state {
		padding: 3rem;
		text-align: center;
		color: #9ca3af;
	}

	/* Mobile Responsive Styles */
	@media (max-width: 640px) {
		.group-page {
			padding: 1rem;
		}

		.back-text {
			display: none;
		}

		.header-top {
			margin-bottom: 1.5rem;
		}

		.add-member-top {
			flex: 1;
		}

		.balance-summary {
			grid-template-columns: minmax(0, 1fr);
			gap: 1rem;
		}

		.tabs button {
			padding: 0.75rem 1rem;
			flex: 1;
		}

		.tab-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.tab-header .actions {
			width: 100%;
		}

		.tab-header .actions button {
			width: 100%;
		}
	}

	@media (max-width: 360px) {
		.expense-item {
			padding: 0.75rem;
		}
		
		.expense-amount {
			font-size: 1.1rem;
		}
	}
</style>