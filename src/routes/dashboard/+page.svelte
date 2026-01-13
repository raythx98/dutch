<script lang="ts">
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { query } from '$lib/api';
	import { onMount } from 'svelte';
	import type { Group } from '$lib/types';

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
	let errors = $state<Record<string, string>>({});

	let totalOwed = $state<Balance[]>([]);
	let totalOwes = $state<Balance[]>([]);

	function validateCreateGroup() {
		const newErrors: Record<string, string> = {};
		if (!newGroupName.trim()) {
			newErrors.groupName = 'Group name is required';
		} else if (newGroupName.length < 3 || newGroupName.length > 20) {
			newErrors.groupName = 'Group name must be between 3 and 20 characters';
		}
		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	function validateJoinGroup() {
		const newErrors: Record<string, string> = {};
		if (!joinCode.trim()) {
			newErrors.joinCode = 'Invite code is required';
		} else if (joinCode.length < 3 || joinCode.length > 20) {
			newErrors.joinCode = 'Invite code must be between 3 and 20 characters';
		}
		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

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
		if (!validateCreateGroup()) return;

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
		if (!validateJoinGroup()) return;
		goto(`${base}/join/${joinCode}`);
	}

	function logout() {
		auth.logout();
		toast.info('Logged out successfully');
		goto(`${base}/login`);
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
			<div class="btn-group">
				<button class="btn btn-secondary btn-icon" onclick={() => goto(`${base}/settings`)} title="Settings">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
				</button>
				<button class="btn btn-secondary btn-icon" onclick={logout} title="Logout">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
				</button>
			</div>
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
						<div class="balance-row">
							<span class="label">{balance.groupName}</span>
							<span class="value positive">
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
						<div class="balance-row">
							<span class="label">{balance.groupName}</span>
							<span class="value negative">
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
						<button class="group-card" onclick={() => goto(`${base}/groups/${group.id}`)}>
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
							class:error={errors.groupName}
						/>
						{#if errors.groupName}<span class="error-text">{errors.groupName}</span>{/if}
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
							class:error={errors.joinCode}
						/>
						{#if errors.joinCode}<span class="error-text">{errors.joinCode}</span>{/if}
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
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.user-info {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		flex: 1;
	}

	.welcome-text {
		color: #4b5563;
		font-size: 1.1rem;
		white-space: nowrap;
		margin-right: 0.25rem;
	}

	.btn-group {
		display: flex;
		gap: 0.5rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 3rem;
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
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		margin-right: 0.5rem;
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

	.form-group input.error {
		border-color: #ef4444;
	}

	.error-text {
		color: #ef4444;
		font-size: 0.75rem;
		margin-top: 0.25rem;
		display: block;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}

	/* Responsive Adjustments */
	@media (max-width: 640px) {
		.dashboard {
			padding: 1rem;
		}

		.user-info {
			width: 100%;
			flex-direction: row;
			justify-content: flex-end;
			align-items: center;
			gap: 0.5rem;
		}

		.welcome-text {
			margin: 0;
			font-size: 1.1rem;
		}

		.stats-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.groups-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.section-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.header-actions {
			width: 100%;
		}

		.header-actions .btn {
			flex: 1;
		}

		.modal-content {
			width: 90%;
			padding: 1.5rem;
		}
	}
</style>