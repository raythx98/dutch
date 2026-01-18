<script lang="ts">
	import Toast from '$lib/components/Toast.svelte';
	import { auth } from '$lib/auth';
	import { loadCurrenciesFromDB } from '$lib/currency';
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

	onMount(() => {
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

{@render children()}

<style>
</style>
