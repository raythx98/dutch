<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth';
	import { get } from 'svelte/store';

	onMount(() => {
		const $auth = get(auth);
		if ($auth.token) {
			goto('/dashboard');
		} else {
			goto('/login');
		}
	});
</script>

<p>Redirecting...</p>
