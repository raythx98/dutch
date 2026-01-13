<script lang="ts">
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';
	import { auth } from '$lib/auth';
	import type { Expense } from '$lib/types';

	let { expense, onClose, onSuccess }: { expense: Expense; onClose: () => void; onSuccess: () => void } = $props();
	let loading = $state(false);

	const affectedMembers = $derived.by(() => {
		const users = new Map<string, User>();
		expense.payers.forEach(p => users.set(p.user.id, p.user));
		expense.shares.forEach(s => users.set(s.user.id, s.user));
		return Array.from(users.values()).sort((a, b) => a.id === $auth.user?.id ? -1 : (b.id === $auth.user?.id ? 1 : 0));
	});

	const MAX_VISIBLE_MEMBERS = 5;
	const visibleMembers = $derived(affectedMembers.slice(0, MAX_VISIBLE_MEMBERS));
	const remainingCount = $derived(Math.max(0, affectedMembers.length - MAX_VISIBLE_MEMBERS));

	async function handleDelete() {
		loading = true;
		const data = await query<{ deleteExpense: boolean }>(`
			mutation DeleteExpense($id: ID!) {
				deleteExpense(expenseId: $id)
			}
		`, { id: expense.id });

		if (data?.deleteExpense) {
			toast.success('Expense deleted successfully');
			onSuccess();
		} else {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			onClose();
		}
		if (e.key === 'Enter' && !loading) {
			e.preventDefault();
			e.stopPropagation();
			handleDelete();
		}
	}
</script>

<svelte:window onkeydowncapture={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} role="presentation">
	<div class="modal-content" onclick={e => e.stopPropagation()} role="presentation">
		<header class="modal-header">
			<h2>Delete Expense</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<div class="modal-body">
			<div class="warning-box">
				<span class="emoji">⚠️</span>
				<p>This action is permanent and will delete <strong>{expense.name || 'this expense'}</strong> for all involved members.</p>
			</div>

			<div class="expense-preview">
				<div class="expense-card">
					<span class="label">Amount</span>
					<span class="value">{expense.currency.symbol}{expense.amount} {expense.currency.code}</span>
				</div>
			</div>

			<div class="members-preview">
				<h3>Affected Members ({affectedMembers.length})</h3>
				<div class="tags-container">
					{#each visibleMembers as member}
						<span class="member-tag">
							<span class="avatar">{member.name[0]}</span>
							<span class="name">{member.name}</span>
							{#if member.id === $auth.user?.id}
								<span class="me-tag">You</span>
							{/if}
						</span>
					{/each}
					{#if remainingCount > 0}
						<span class="more-tag">& {remainingCount} more...</span>
					{/if}
				</div>
			</div>

			<p>Are you sure you want to proceed?</p>
		</div>

		<footer>
			<button class="btn btn-secondary" onclick={onClose} disabled={loading}>Cancel</button>
			<button class="btn btn-danger" onclick={handleDelete} disabled={loading}>
				{loading ? 'Deleting...' : 'Delete Expense'}
			</button>
		</footer>
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
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		border-radius: 12px;
		width: 90%;
		max-width: 450px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #111827;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: #9ca3af;
		cursor: pointer;
	}

	.modal-body {
		padding: 1rem 1.25rem 1.25rem;
	}

	.warning-box {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		background: #fef2f2;
		border: 1px solid #fecaca;
		padding: 0.75rem;
		border-radius: 6px;
		margin-bottom: 1.25rem;
		color: #991b1b;
		font-size: 0.9rem;
	}

	.warning-box p {
		margin: 0;
		line-height: 1.4;
		min-width: 0;
		overflow-wrap: break-word;
	}

	.warning-box .emoji {
		font-size: 1.1rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.expense-preview {
		margin-bottom: 1.25rem;
	}

	.expense-card {
		background: #f9fafb;
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.expense-card .label {
		font-size: 0.75rem;
		color: #6b7280;
		text-transform: uppercase;
		font-weight: 600;
	}

	.expense-card .value {
		font-size: 1.25rem;
		font-weight: 700;
		color: #111827;
	}

	.members-preview {
		margin-bottom: 1.25rem;
	}

	.members-preview h3 {
		font-size: 0.875rem;
		color: #6b7280;
		text-transform: uppercase;
		margin-bottom: 0.75rem;
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

	p {
		color: #4b5563;
		margin: 0;
	}

	footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}
</style>
