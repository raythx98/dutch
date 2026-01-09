<script lang="ts">
	import { page } from '$app/stores';
	import { query } from '$lib/api';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import AddMemberModal from '$lib/components/AddMemberModal.svelte';
	import AddExpenseModal from '$lib/components/AddExpenseModal.svelte';
	import AddRepaymentModal from '$lib/components/AddRepaymentModal.svelte';
	import DeleteGroupModal from '$lib/components/DeleteGroupModal.svelte';
	import DeleteExpenseModal from '$lib/components/DeleteExpenseModal.svelte';
	import InviteModal from '$lib/components/InviteModal.svelte';

	const groupId = $page.params.id;

	interface User {
		id: string;
		name: string;
	}

	interface Group {
		id: string;
		name: string;
		inviteToken: string;
		members: User[];
	}

	interface Currency {
		id: string;
		code: string;
		symbol: string;
	}

	interface Share {
		user: { id: string; name: string };
		amount: string;
	}

	interface Expense {
		id: string;
		type: string;
		name: string;
		description: string;
		amount: string;
		expenseAt: string;
		currency: Currency;
		payers: Share[];
		shares: Share[];
	}

	interface Owe {
		user: User;
		amount: string;
		currency: { code: string; symbol: string };
	}

	interface ExpenseSummary {
		expenses: Expense[];
		owes: Owe[];
		owed: Owe[];
	}

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
		
		const groupsData = await query<{ groups: Group[] }>(`
			query GetGroups {
				groups {
					id
					name
					inviteToken
					members {
						id
						name
					}
				}
			}
		`);

		if (groupsData) {
			group = groupsData.groups.find(g => String(g.id) === String(groupId)) || null;
		}

		if (!group) {
			toast.error('Group not found');
			goto('/dashboard');
			return;
		}

		const expensesData = await query<{ expenses: ExpenseSummary }>(`
			query GetGroupExpenses($groupId: ID!) {
				expenses(groupId: $groupId) {
					expenses {
						id
						type
						name
						description
						amount
						expenseAt
						currency { id code symbol }
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
						currency { code symbol }
					}
					owed {
						user { id name }
						amount
						currency { code symbol }
					}
				}
			}
		`, { groupId });

		if (expensesData) {
			summary = expensesData.expenses;
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

	onMount(fetchData);
</script>

<div class="group-page">
	<header>
		<div class="header-top">
			<button class="btn btn-back" onclick={() => goto('/dashboard')}>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
				Dashboard
			</button>
			{#if group}
				<h1>{group.name}</h1>
				<div class="header-actions">
					<button class="btn btn-secondary btn-icon" onclick={() => showInvite = true} title="Share Group">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
					</button>
					<button class="btn btn-danger-outline btn-icon" onclick={() => showDeleteGroup = true} title="Delete Group">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
					</button>
					<button class="btn btn-primary add-member-top" onclick={() => showAddMember = true}>Add Member</button>
				</div>
			{:else}
				<h1>Loading...</h1>
			{/if}
		</div>

		{#if summary}
			<section class="balance-summary">
				<div class="balance-card owed">
					<h3>You are owed</h3>
					{#each summary.owed as o}
						<div class="owe-item">
							<div class="owe-info">
								<span class="user">{o.user.name}</span>
								<span class="amount positive">
									{o.currency.symbol}{o.amount} {o.currency.code}
								</span>
							</div>
							<button class="btn btn-xs btn-outline" onclick={() => openSettlement(o.user.id, $auth.user?.id || '', o.amount, o.currency.code)}>Settle</button>
						</div>
					{:else}
						<p class="empty-msg">Nobody owes you anything.</p>
					{/each}
				</div>
				<div class="balance-card owes">
					<h3>You owe</h3>
					{#each summary.owes as o}
						<div class="owe-item">
							<div class="owe-info">
								<span class="user">{o.user.name}</span>
								<span class="amount negative">
									{o.currency.symbol}{o.amount} {o.currency.code}
								</span>
							</div>
							<button class="btn btn-xs btn-outline" onclick={() => openSettlement($auth.user?.id || '', o.user.id, o.amount, o.currency.code)}>Settle</button>
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
						<button class="btn btn-secondary" onclick={() => showAddRepayment = true}>Settle</button>
						<button class="btn btn-primary" onclick={() => { editingExpense = undefined; showAddExpense = true; }}>Add Expense</button>
					</div>
				</div>
				
				<div class="expense-list">
					{#each summary?.expenses || [] as expense}
						{@const balance = getBalanceForExpense(expense)}
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
								{#if expense.description}
									<div class="expense-desc">{expense.description}</div>
								{/if}
								<div class="expense-details">
									{#if expense.type === 'Repayment'}
										{@const payer = expense.payers[0]?.user.name === $auth.user?.name ? 'You' : expense.payers[0]?.user.name}
										{@const recipient = expense.shares[0]?.user.name === $auth.user?.name ? 'you' : expense.shares[0]?.user.name}
										<span>{payer} paid {recipient}</span>
									{:else}
										<span>Paid by {expense.payers[0]?.user.name === $auth.user?.name ? 'You' : expense.payers[0]?.user.name}</span>
										<span class="dot">&bull;</span>
										<span>Split among {expense.shares.length} people</span>
									{/if}
								</div>
							</div>

							{#if balance && expense.type !== 'Repayment'}
								<div class="expense-balance" class:positive={balance.isOwed} class:negative={!balance.isOwed}>
									<span class="label">{balance.isOwed ? 'you lent' : 'you borrowed'}</span>
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
					{@const sortedMembers = [...group.members].sort((a, b) => {
						if (a.id === $auth.user?.id) return -1;
						if (b.id === $auth.user?.id) return 1;
						return a.name.localeCompare(b.name);
					})}
					<ul class="member-list">
						{#each sortedMembers as member}
							<li>
								<span class="name">
									{member.name} 
									{#if member.id === $auth.user?.id}
										<strong class="me-label">You</strong>
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

	header {
		margin-bottom: 2rem;
	}

	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.header-top h1 {
		flex: 1;
		margin: 0;
		font-size: 1.25rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-actions .btn {
		height: 2.25rem;
		padding: 0 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.header-actions .btn-icon {
		padding: 0;
		width: 2.25rem;
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

	.balance-card {
		background: white;
		padding: 1.25rem;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.balance-card h3 {
		margin-top: 0;
		font-size: 0.875rem;
		text-transform: uppercase;
		color: #6b7280;
		letter-spacing: 0.025em;
		margin-bottom: 1rem;
	}

	.owe-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f3f4f6;
		gap: 0.5rem;
	}

	.owe-item:last-child {
		border-bottom: none;
	}

	.owe-info {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.btn-xs {
		padding: 0.25rem 0.6rem;
		font-size: 0.75rem;
		height: auto;
		line-height: 1;
	}

	.btn-outline {
		background: transparent;
		border: 1px solid #d1d5db;
		color: #374151;
	}

	.btn-outline:hover {
		background: #f3f4f6;
		border-color: #9ca3af;
	}

	.amount {
		font-weight: 600;
	}

	.positive { color: #059669; }
	.negative { color: #dc2626; }

	.empty-msg {
		color: #9ca3af;
		font-size: 0.875rem;
		margin: 0;
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

	.expense-item {
		display: flex;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid #f3f4f6;
		gap: 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
		border-left: 4px solid transparent;
	}

	.expense-item:hover {
		background-color: #f9fafb;
	}

	.expense-item:last-child {
		border-bottom: none;
	}

	.expense-date {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 45px;
		color: #6b7280;
		font-size: 0.75rem;
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
	}

	.expense-name {
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.125rem;
		font-size: 0.95rem;
	}

	.expense-desc {
		font-size: 0.8125rem;
		color: #6b7280;
		margin-bottom: 0.25rem;
	}

	.expense-details {
		font-size: 0.8125rem;
		color: #6b7280;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.dot { color: #d1d5db; }

	.expense-balance {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 0.75rem;
		min-width: 90px;
	}

	.expense-balance .label {
		color: #6b7280;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.025em;
	}

	.expense-balance .val { font-weight: 600; }
	.expense-balance.positive .val { color: #059669; }
	.expense-balance.negative .val { color: #dc2626; }

	.expense-amount {
		font-weight: 700;
		font-size: 1.05rem;
		min-width: 80px;
		text-align: right;
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
		margin-left: 0.5rem;
	}

	.delete-btn:hover { color: #ef4444; }

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

	.me-label {
		background: #e0f2fe;
		color: #0369a1;
		font-size: 0.75rem;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-weight: 600;
		margin-left: 0.5rem;
	}

	.empty-state {
		padding: 3rem;
		text-align: center;
		color: #9ca3af;
	}
</style>