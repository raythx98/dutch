<script lang="ts">
	import { fetchAndSyncCurrencies } from '$lib/currency';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';

	let loading = $state(false);

	async function handleRefreshCurrencies() {
		loading = true;
		const success = await fetchAndSyncCurrencies();
		loading = false;
		if (success) {
			toast.success('Currencies updated successfully');
		} else {
			toast.error('Failed to update currencies');
		}
	}
</script>

<div class="settings-page">
	<header>
		<button class="btn btn-back" onclick={() => goto('/dashboard')}>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
			Back
		</button>
		<h1>Settings</h1>
	</header>

	<main>
		<section class="card">
			<h2>Data Management</h2>
			<p>Update local cache of currencies from the server. This ensures you have the latest currency codes and symbols.</p>
			<button class="btn btn-primary" onclick={handleRefreshCurrencies} disabled={loading}>
				{loading ? 'Refreshing...' : 'Refresh Now'}
			</button>
		</section>
	</main>
</div>

<style>
	.settings-page {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
	}

	.card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}

	.card h2 {
		margin-top: 0;
		font-size: 1.25rem;
		margin-bottom: 1rem;
	}

	.card p {
		color: #4b5563;
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}
</style>