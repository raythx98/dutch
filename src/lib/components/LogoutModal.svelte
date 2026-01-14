<script lang="ts">
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let { onClose }: { onClose: () => void } = $props();

	function handleLogout() {
		auth.logout();
		toast.info('Logged out successfully');
		onClose();
		goto(`${base}/`);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			onClose();
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			e.stopPropagation();
			handleLogout();
		}
	}
</script>

<svelte:window onkeydowncapture={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} role="presentation">
	<div class="modal-content" onclick={e => e.stopPropagation()} role="presentation">
		<header class="modal-header">
			<h2>Confirm Logout</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<div class="modal-body">
			<p>Are you sure you want to log out of Dutch?</p>
		</div>

		<footer>
			<button class="btn btn-secondary" onclick={onClose}>Cancel</button>
			<button class="btn btn-danger" onclick={handleLogout}>Log Out</button>
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
		padding: 1.25rem;
	}

	.modal-body p {
		margin: 0;
		color: #4b5563;
		line-height: 1.5;
	}

	footer {
		padding: 1rem 1.25rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}
</style>
