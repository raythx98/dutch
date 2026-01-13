<script lang="ts">
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';

	let { groupId, onClose, onSuccess } = $props();

	let identifier = $state('');
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let inputRef: HTMLInputElement;

	function validate() {
		const newErrors: Record<string, string> = {};
		if (!identifier.trim()) {
			newErrors.identifier = 'Username or email is required';
		} else if (identifier.length < 3 || identifier.length > 255) {
			newErrors.identifier = 'Must be between 3 and 255 characters';
		}
		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;

		loading = true;
		const data = await query<{ addMember: any }>(`
			mutation AddMember($groupId: ID!, $identifier: String!) {
				addMember(groupId: $groupId, identifier: $identifier) {
					id
				}
			}
		`, { groupId, identifier });

		if (data) {
			toast.success('Member added successfully');
			onSuccess();
		}
		loading = false;
	}

	$effect(() => {
		if (inputRef) inputRef.focus();
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
	<div class="modal-content" onclick={e => e.stopPropagation()} aria-hidden="true">
		<header class="modal-header">
			<h2>Add Member</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<form onsubmit={handleSubmit}>
			<div class="form-group">
				<label for="identifier">Username or Email</label>
				<input 
					type="text" 
					id="identifier" 
					bind:this={inputRef}
					bind:value={identifier} 
					placeholder="Enter username or email" 
					required 
					disabled={loading}
					class:error={errors.identifier}
				/>
				{#if errors.identifier}<span class="error-text">{errors.identifier}</span>{/if}
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={loading || !identifier.trim()}>
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
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.modal-header h2 { margin: 0; font-size: 1.25rem; }

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
		font-size: 1rem;
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
		align-items: center;
		gap: 1rem;
	}

	@media (max-width: 480px) {
		.modal-content {
			width: 90%;
			padding: 1.5rem;
		}

		.modal-actions {
			flex-direction: column-reverse;
		}

		.modal-actions button {
			width: 100%;
		}
	}
</style>
