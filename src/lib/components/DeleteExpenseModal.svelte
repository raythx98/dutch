<script lang="ts">
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';

	interface Currency {
		code: string;
		symbol: string;
	}

	interface Expense {
		id: string;
		name: string;
		amount: string;
		currency: Currency;
	}

	let { expense, onClose, onSuccess }: { expense: Expense; onClose: () => void; onSuccess: () => void } = $props();
	let loading = $state(false);

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
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
	<div class="modal-content" onclick={e => e.stopPropagation()} role="presentation">
		<header>
			<h2>Delete Expense</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<div class="modal-body">
			<div class="warning-box">
				<span class="emoji">⚠️</span>
				<p>Are you sure you want to delete <strong>{expense.name || 'this expense'}</strong>?</p>
			</div>

			<div class="expense-preview">
				<div class="expense-card">
					<span class="label">Amount</span>
					<span class="value">{expense.currency.symbol}{expense.amount} {expense.currency.code}</span>
				</div>
			</div>

			<p>This action cannot be undone.</p>
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
		max-width: 400px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	header {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	header h2 {
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
		font-size: 0.95rem;
	}

	.warning-box p {
		margin: 0;
		line-height: 1.4;
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

	.btn {
		padding: 0.625rem 1.25rem;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid transparent;
	}

	.btn-secondary {
		background: white;
		border-color: #d1d5db;
		color: #374151;
	}

	.btn-danger {
		background: #dc2626;
		color: white;
	}

	.btn-danger:disabled {
		background: #f87171;
		cursor: not-allowed;
	}
</style>
