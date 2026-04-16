<script lang="ts">
	import { fetchAndSyncCurrencies } from '$lib/currency';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { syncQueue } from '$lib/offline';
	import { pendingCount, syncing, isOnline } from '$lib/connectivity';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { query } from '$lib/api';

	let loading = $state(false);

	onMount(() => {
		// Unconditional probe on mount so the banner reflects actual server state
		// when visiting settings, even if isOnline hasn't been updated by another page.
		query<{ groups: { id: string }[] }>('query { groups { id } }').catch(() => {});
	});

	// Self-heal: when isOnline is false but device has internet, re-probe so the
	// banner goes away as soon as the server becomes reachable again.
	$effect(() => {
		if (!$isOnline && navigator.onLine) {
			query<{ groups: { id: string }[] }>('query { groups { id } }').catch(() => {});
		}
	});

	async function handleSync() {
		await syncQueue();
		if (get(pendingCount) > 0) {
			toast.error('Some changes failed to sync — will retry when online');
		}
	}

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

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			goto(`${base}/dashboard`);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="settings-page">
	<header class="settings-header">
		<button class="btn btn-back" onclick={() => goto(`${base}/dashboard`)}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"
				></polyline></svg
			>
			Back
		</button>
		<h1>Settings</h1>
	</header>

	<main>
		<section class="card">
			<h2>Sync Offline Data</h2>
			<p>
				{#if $pendingCount > 0}
					{$pendingCount} change{$pendingCount === 1 ? '' : 's'} pending sync.
				{:else}
					No pending changes to sync.
				{/if}
			</p>
			<button
				class="btn btn-primary"
				onclick={handleSync}
				disabled={$syncing || $pendingCount === 0 || !$isOnline}
			>
				{$syncing ? 'Syncing...' : 'Sync Now'}
			</button>
		</section>

		<section class="card">
			<h2>Data Management</h2>
			<p>
				Update local cache of currencies from the server. This ensures you have the latest currency
				codes and symbols.
			</p>
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

	main {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.settings-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
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
