<script lang="ts">
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';
	import { query } from '$lib/api';
	import { onMount } from 'svelte';

	interface Group {
		id: string;
		name: string;
	}

	interface Balance {
		groupName: string;
		amount: string;
		currency: { symbol: string; code: string };
	}

	let groups = $state<Group[]>([]);
	let loading = $state(true);
	let showCreateModal = $state(false);
	let showJoinModal = $state(false);
	let newGroupName = $state('');
	let joinCode = $state('');
	let creating = $state(false);

	let totalOwed = $state<Balance[]>([]);
	let totalOwes = $state<Balance[]>([]);

	async function fetchGroupsAndBalances() {
		loading = true;
		const data = await query<{ groups: Group[] }>(`
			query GetGroups {
				groups {
					id
					name
				}
			}
		`);

		if (data) {
			groups = data.groups;
			
			if (groups.length > 0) {
				// Construct a single batched query with aliases
				const queryParts = groups.map(g => `
					g_${g.id}: expenses(groupId: "${g.id}") {
						owes {
							amount
							currency { symbol code }
						}
						owed {
							amount
							currency { symbol code }
						}
					}
				`);

				const batchedQuery = `
					query GetAllBalances {
						${queryParts.join('\n')}
					}
				`;

				const balancesData = await query<Record<string, { owes: any[], owed: any[] }>>(batchedQuery);

				if (balancesData) {
					const owedList: Balance[] = [];
					const owesList: Balance[] = [];

					groups.forEach(group => {
						const expenses = balancesData[`g_${group.id}`];
						if (expenses) {
							// Aggregate per group and currency
							const groupOwed = new Map<string, { amount: number, symbol: string }>();
							const groupOwes = new Map<string, { amount: number, symbol: string }>();

							expenses.owed.forEach(item => {
								const key = item.currency.code;
								const current = groupOwed.get(key) || { amount: 0, symbol: item.currency.symbol };
								groupOwed.set(key, { ...current, amount: current.amount + parseFloat(item.amount) });
							});

							expenses.owes.forEach(item => {
								const key = item.currency.code;
								const current = groupOwes.get(key) || { amount: 0, symbol: item.currency.symbol };
								groupOwes.set(key, { ...current, amount: current.amount + parseFloat(item.amount) });
							});

							groupOwed.forEach((val, code) => {
								if (val.amount > 0) {
									owedList.push({
										groupName: group.name,
										amount: val.amount.toFixed(2),
										currency: { code, symbol: val.symbol }
									});
								}
							});

							groupOwes.forEach((val, code) => {
								if (val.amount > 0) {
									owesList.push({
										groupName: group.name,
										amount: val.amount.toFixed(2),
										currency: { code, symbol: val.symbol }
									});
								}
							});
						}
					});

					totalOwed = owedList;
					totalOwes = owesList;
				}
			} else {
				totalOwed = [];
				totalOwes = [];
			}
		}
		loading = false;
	}

	async function handleCreateGroup(e: Event) {
		e.preventDefault();
		if (!newGroupName.trim()) return;

		creating = true;
		const data = await query<{ addGroup: Group }>(
			`
			mutation AddGroup($name: String!) {
				addGroup(name: $name) {
					id
					name
				}
			}
		`,
			{ name: newGroupName }
		);

		if (data) {
			toast.success(`Group "${data.addGroup.name}" created!`);
			newGroupName = '';
			showCreateModal = false;
			await fetchGroupsAndBalances();
		}
		creating = false;
	}

	function handleJoinGroup(e: Event) {
		e.preventDefault();
		if (!joinCode.trim()) return;
		goto(`/join/${joinCode}`);
	}

	function logout() {
		auth.logout();
		toast.info('Logged out successfully');
		goto('/login');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showCreateModal = false;
			showJoinModal = false;
		}
	}

	onMount(() => {
		fetchGroupsAndBalances();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dashboard">
	<header class="dashboard-header">
		<div class="logo">Dutch<span>.</span></div>
		<div class="user-info">
			<span class="welcome-text">Hi, <strong>{$auth.user?.name}</strong></span>
			<button class="btn btn-secondary" onclick={() => goto('/settings')}>Settings</button>
			<button class="btn btn-secondary" onclick={logout}>Logout</button>
		</div>
	</header>

	<main>
		<div class="stats-grid">
			<div class="card">
				<h3>You are owed</h3>
				{#if totalOwed.length === 0}
					<p class="empty-msg">Nobody owes you anything.</p>
				{:else}
					{#each totalOwed as balance}
						<div class="balance-item">
							<span class="group-label">{balance.groupName}</span>
							<span class="amount positive">
								{balance.currency.symbol}{balance.amount} {balance.currency.code}
							</span>
						</div>
					{/each}
				{/if}
			</div>
			<div class="card">
				<h3>You owe</h3>
				{#if totalOwes.length === 0}
					<p class="empty-msg">You don't owe anything.</p>
				{:else}
					{#each totalOwes as balance}
						<div class="balance-item">
							<span class="group-label">{balance.groupName}</span>
							<span class="amount negative">
								{balance.currency.symbol}{balance.amount} {balance.currency.code}
							</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<section class="groups-section">
			<div class="section-header">
				<h2>Your Groups</h2>
				<div class="header-actions">
					<button class="btn btn-secondary" onclick={() => showJoinModal = true}>Join Group</button>
					<button class="btn btn-primary" onclick={() => showCreateModal = true}>Create Group</button>
				</div>
			</div>

			{#if loading}
				<p>Loading groups...</p>
			{:else if groups.length === 0}
				<div class="empty-state">
					<p>You don't have any groups yet.</p>
					<p>Create one to start splitting expenses!</p>
				</div>
			{:else}
				<div class="groups-grid">
					{#each groups as group}
						<button class="group-card" onclick={() => goto(`/groups/${group.id}`)}>
							<span class="group-name">{group.name}</span>
							<span class="chevron">&rarr;</span>
						</button>
					{/each}
				</div>
			{/if}
		</section>
	</main>

	{#if showCreateModal}
		<div class="modal-backdrop" onclick={() => showCreateModal = false} aria-hidden="true">
			<div class="modal-content" onclick={e => e.stopPropagation()} aria-hidden="true">
				<h3>Create New Group</h3>
				<form onsubmit={handleCreateGroup}>
					<div class="form-group">
						<label for="groupName">Group Name</label>
						<input 
							type="text" 
							id="groupName" 
							bind:value={newGroupName} 
							placeholder="e.g. Summer Trip 2025" 
							required 
							disabled={creating}
						/>
					</div>
					<div class="modal-actions">
						<button type="button" class="btn btn-secondary" onclick={() => showCreateModal = false}>Cancel</button>
						<button type="submit" class="btn btn-primary" disabled={creating || !newGroupName.trim()}>
							{creating ? 'Creating...' : 'Create Group'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if showJoinModal}
		<div class="modal-backdrop" onclick={() => showJoinModal = false} aria-hidden="true">
			<div class="modal-content" onclick={e => e.stopPropagation()} aria-hidden="true">
				<h3>Join a Group</h3>
				<form onsubmit={handleJoinGroup}>
					<div class="form-group">
						<label for="joinCode">Invite Code</label>
						<input 
							type="text" 
							id="joinCode" 
							bind:value={joinCode} 
							placeholder="Enter code" 
							required 
						/>
					</div>
					<div class="modal-actions">
						<button type="button" class="btn btn-secondary" onclick={() => showJoinModal = false}>Cancel</button>
						<button type="submit" class="btn btn-primary" disabled={!joinCode.trim()}>
							Join Group
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	.dashboard {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		width: 100%;
		box-sizing: border-box;
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.welcome-text {
		margin-right: 0.5rem;
		color: #4b5563;
		font-size: 1.1rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 3rem;
	}

	.card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}

	.card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.amount {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
	}

	.empty-msg {
		color: #9ca3af;
		font-size: 0.875rem;
		margin: 0;
	}

	.balance-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f3f4f6;
	}

	.balance-item:last-child {
		border-bottom: none;
	}

	.group-label {
		color: #6b7280;
		font-weight: 700;
		font-size: 1rem;
	}

	.positive {
		color: #059669;
	}

	.negative {
		color: #dc2626;
	}

	.groups-section {
		margin-top: 2rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
	}

	.groups-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}

	.group-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		text-align: left;
		width: 100%;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.group-card:hover {
		border-color: #2563eb;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		background: white;
	}

	.group-name {
		font-weight: 600;
		font-size: 1.1rem;
		color: #111827;
	}

	.chevron {
		color: #9ca3af;
		font-size: 1.2rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: #f9fafb;
		border-radius: 8px;
		border: 2px dashed #e5e7eb;
		color: #6b7280;
	}

	.empty-state p {
		margin: 0.5rem 0;
	}

	/* Modal Styles */
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

	.modal-content h3 {
		margin-top: 0;
		margin-bottom: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		box-sizing: border-box;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}
</style>