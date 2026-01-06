<script lang="ts">
	import { toast } from '../toast';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
</script>

<div class="toast-container">
	{#each $toast as t (t.id)}
		<div
			class="toast {t.type}"
			animate:flip={{ duration: 300 }}
			in:fly={{ y: 20, duration: 300 }}
			out:fade={{ duration: 200 }}
		>
			<span class="message">{t.message}</span>
			<button class="close" onclick={() => toast.remove(t.id)}>&times;</button>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		pointer-events: none;
	}

	.toast {
		pointer-events: auto;
		padding: 0.75rem 1rem;
		border-radius: 4px;
		background: #333;
		color: white;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-width: 250px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.toast.error {
		background: #f44336;
	}

	.toast.success {
		background: #4caf50;
	}

	.toast.info {
		background: #2196f3;
	}

	.message {
		font-size: 0.9rem;
	}

	.close {
		background: transparent;
		border: none;
		color: white;
		cursor: pointer;
		font-size: 1.2rem;
		line-height: 1;
		padding: 0;
		opacity: 0.7;
	}

	.close:hover {
		opacity: 1;
	}
</style>
