<script lang="ts">
	import Toast from '$lib/components/Toast.svelte';
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import { loadCurrenciesFromDB } from '$lib/currency';
	import { isOnline } from '$lib/connectivity';
	import { pendingCount, initOffline } from '$lib/offline';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	const publicPages = [
		`${base}/`,
		`${base}/login`,
		`${base}/register`,
		`${base}/login/`,
		`${base}/register/`
	];

	let prevPendingCount = 0;
	$effect(() => {
		const count = $pendingCount;
		if (prevPendingCount > 0 && count === 0) {
			toast.success('All changes synced');
		}
		prevPendingCount = count;
	});

	onMount(() => {
		initOffline();

		const unsubscribe = auth.subscribe(($auth) => {
			const path = $page.url.pathname;

			if (!$auth.token && !publicPages.includes(path)) {
				goto(`${base}/login`);
			} else if ($auth.token) {
				loadCurrenciesFromDB();
				if (path === `${base}/login` || path === `${base}/register`) {
					goto(`${base}/dashboard`);
				}
			}
		});

		return unsubscribe;
	});
</script>

<Toast />

{#if !$isOnline && !publicPages.includes($page.url.pathname)}
	<div class="offline-banner">
		<span class="offline-text">Unable to reach servers — showing cached data</span>
		{#if $pendingCount > 0}
			<span class="pending-pill"
				>{$pendingCount} change{$pendingCount === 1 ? '' : 's'} pending sync</span
			>
		{/if}
	</div>
{/if}

<div class:banner-offset={!$isOnline && !publicPages.includes($page.url.pathname)}>
	{@render children()}
</div>

<style>
	.offline-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 2000;
		background: #1f2937;
		color: #f9fafb;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.offline-text {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.offline-text::before {
		content: '';
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
		flex-shrink: 0;
	}

	.pending-pill {
		background: #374151;
		border: 1px solid #4b5563;
		border-radius: 999px;
		padding: 0.15rem 0.6rem;
		font-size: 0.8rem;
		color: #fbbf24;
		white-space: nowrap;
	}

	.banner-offset {
		padding-top: 2.5rem;
	}
</style>
