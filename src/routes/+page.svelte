<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { auth } from '$lib/auth';
	import { get } from 'svelte/store';

	onMount(() => {
		const $auth = get(auth);
		if ($auth.token) {
			goto(`${base}/dashboard`);
		} else {
			goto(`${base}/login`);
		}
	});
</script>

<p>Redirecting...</p>
