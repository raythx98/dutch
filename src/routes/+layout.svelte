<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import Toast from '$lib/components/Toast.svelte';
	import { auth } from '$lib/auth';
	import { loadCurrenciesFromDB } from '$lib/currency';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	const publicPages = ['/login', '/register'];

	onMount(() => {
		const unsubscribe = auth.subscribe(($auth) => {
			const path = $page.url.pathname;

			if (!$auth.token && !publicPages.includes(path)) {
				goto('/login');
			} else if ($auth.token) {
				loadCurrenciesFromDB();
				if (path === '/login' || path === '/register' || path === '/') {
					goto('/dashboard');
				}
			} else if (path === '/') {
				goto('/dashboard');
			}
		});

		return unsubscribe;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toast />

{@render children()}

<style>
</style>
