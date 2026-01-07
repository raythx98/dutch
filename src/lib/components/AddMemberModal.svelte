<script lang="ts">
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';

	let { groupId, onClose, onSuccess } = $props();

	let email = $state('');
	let loading = $state(false);
	let emailInput: HTMLInputElement;

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!email.trim()) return;

		loading = true;
		const data = await query<{ addMember: any }>(`
			mutation AddMember($groupId: ID!, $email: String!) {
				addMember(groupId: $groupId, email: $email) {
					id
				}
			}
		`, { groupId, email });

		if (data) {
			toast.success('Member added successfully');
			onSuccess();
		}
		loading = false;
	}

	$effect(() => {
		if (emailInput) emailInput.focus();
	});
</script>

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
	<div class="modal-content" onclick={e => e.stopPropagation()} aria-hidden="true">
		<header>
			<h2>Add Member</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<form onsubmit={handleSubmit}>
			<div class="form-group">
				<label for="email">Member's Email</label>
				<input 
					type="email" 
					id="email" 
					bind:this={emailInput}
					bind:value={email} 
					placeholder="friend@example.com" 
					required 
					disabled={loading}
				/>
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={loading || !email.trim()}>
					{loading ? 'Adding...' : 'Add Member'}
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
