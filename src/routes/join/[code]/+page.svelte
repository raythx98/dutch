<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { auth } from '$lib/auth';
	import { query } from '$lib/api';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/toast';

	const inviteCode = $page.params.code;
	
	interface PreviewGroup {
		name: string;
		members: { id: string; name: string }[];
	}

	let group = $state<PreviewGroup | null>(null);
	let loading = $state(true);
	let joining = $state(false);
	let error = $state<string | null>(null);

	const MAX_VISIBLE_MEMBERS = 5;
	const visibleMembers = $derived(group ? group.members.slice(0, MAX_VISIBLE_MEMBERS) : []);
	const remainingCount = $derived(group ? Math.max(0, group.members.length - MAX_VISIBLE_MEMBERS) : 0);

	async function fetchPreview() {
		if (!$auth.token) {
			if (inviteCode) {
				localStorage.setItem('pendingInvite', inviteCode);
			}
			goto('/login');
			return;
		}

		loading = true;
		error = null;

		// Check if already joined
		const groupsData = await query<{ groups: { id: string, inviteToken: string }[] }>(`
			query GetGroups {
				groups {
					id
					inviteToken
				}
			}
		`);

		if (groupsData && inviteCode) {
			const existing = groupsData.groups.find(g => g.inviteToken === inviteCode);
			if (existing) {
				toast.info('You are already a member of this group.');
				goto(`/groups/${existing.id}`);
				return;
			}
		}
		
		const data = await query<{ previewGroup: PreviewGroup }>(`
			query PreviewGroup($code: String!) {
				previewGroup(inviteCode: $code) {
					name
					members {
						id
						name
					}
				}
			}
		`, { code: inviteCode || '' });

		if (data) {
			group = data.previewGroup;
		} else {
			error = 'Invalid or expired invite link';
		}
		loading = false;
	}

	async function handleJoin() {
		joining = true;
		const data = await query<{ joinGroup: { id: string } }>(`
			mutation JoinGroup($code: String!) {
				joinGroup(inviteCode: $code) {
					id
				}
			}
		`, { code: inviteCode });

		if (data?.joinGroup) {
			toast.success(`Successfully joined ${group?.name}!`);
			goto(`/groups/${data.joinGroup.id}`);
		} else {
			joining = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') goto('/dashboard');
		if (e.key === 'Enter' && group && !joining) handleJoin();
	}

	onMount(fetchPreview);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="join-page">
	<div class="card">
		{#if loading}
			<div class="loading">
				<p>Fetching group details...</p>
			</div>
		{:else if error}
			<div class="error-state">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="error-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				<h2>Invitation Error</h2>
				<p>{error}</p>
				<button class="btn btn-primary" onclick={() => goto('/dashboard')}>Go to Dashboard</button>
			</div>
		{:else if group}
			<header class="join-header">
				<div class="invite-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
				</div>
				<h1>Join Group</h1>
				<p>You've been invited to join <strong>{group.name}</strong></p>
			</header>

			<div class="members-preview">
				<h3>Group Members ({group.members.length})</h3>
				<div class="tags-container">
					{#each visibleMembers as member}
						<span class="member-tag">
							<span class="avatar">{member.name[0]}</span>
							<span class="name">{member.name}</span>
						</span>
					{/each}
					{#if remainingCount > 0}
						<span class="more-tag">& {remainingCount} more...</span>
					{/if}
				</div>
			</div>

			<div class="actions">
				<button class="btn btn-secondary" onclick={() => goto('/dashboard')} disabled={joining}>Decline</button>
				<button class="btn btn-primary join-btn" onclick={handleJoin} disabled={joining}>
					{joining ? 'Joining...' : 'Accept & Join'}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.join-page {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		box-sizing: border-box;
		background: var(--bg-color);
		z-index: 10;
	}

	.card {
		background: white;
		padding: 2.5rem;
		border-radius: 16px;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-width: 450px;
		max-height: 90vh;
		overflow-y: auto;
		text-align: center;
	}

	.join-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 2rem;
	}

	.invite-icon {
		width: 64px;
		height: 64px;
		background: #eff6ff;
		color: #2563eb;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1.5rem;
	}

	h1 {
		font-size: 1.5rem;
		margin: 0 0 0.5rem;
		color: #111827;
	}

	.join-header p {
		color: #6b7280;
		margin: 0;
	}

	.members-preview {
		text-align: left;
		background: #f9fafb;
		border-radius: 12px;
		padding: 1.25rem;
		margin-bottom: 2rem;
		border: 1px solid #f3f4f6;
	}

	.members-preview h3 {
		font-size: 0.875rem;
		color: #6b7280;
		text-transform: uppercase;
		margin: 0 0 1rem;
		letter-spacing: 0.025em;
	}

	.tags-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.member-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: white;
		padding: 0.25rem 0.75rem 0.25rem 0.25rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		color: #374151;
		border: 1px solid #e5e7eb;
		box-shadow: 0 1px 2px rgba(0,0,0,0.05);
		font-weight: 500;
	}

	.avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #eff6ff;
		color: #3b82f6;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.more-tag {
		display: inline-flex;
		align-items: center;
		color: #6b7280;
		font-size: 0.875rem;
		padding: 0.25rem 0;
		font-style: italic;
	}

	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.actions .btn {
		flex: 1;
		padding: 0.75rem;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
	}

	.actions .btn-primary {
		background: #2563eb;
		color: white;
	}

	.actions .btn-primary:hover {
		background: #1d4ed8;
	}

	.actions .btn-secondary {
		background: white;
		border-color: #d1d5db;
		color: #374151;
	}

	.actions .btn-secondary:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.error-state {
		padding: 1rem 0;
	}

	.error-icon {
		color: #dc2626;
		margin-bottom: 1.5rem;
	}

	.error-state h2 {
		margin-bottom: 0.5rem;
	}

	.error-state p {
		color: #6b7280;
		margin-bottom: 2rem;
	}

	.loading {
		padding: 3rem 0;
		color: #6b7280;
	}
</style>
