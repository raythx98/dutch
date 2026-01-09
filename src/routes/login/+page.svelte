<script lang="ts">
	import { auth } from '$lib/auth';
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);

	const LOGIN_MUTATION = `
        mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
                id
                name
                token
            }
        }
    `;

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!email || !password) {
			toast.error('Please fill in all fields');
			return;
		}

		loading = true;
		const data = await query<{ login: { id: string; name: string; token: string } }>(
			LOGIN_MUTATION,
			{
				email,
				password
			}
		);
		loading = false;

		if (data?.login) {
			auth.login(data.login.token, { id: data.login.id, name: data.login.name });
			toast.success(`Welcome back, ${data.login.name}!`);
			
			const pendingInvite = localStorage.getItem('pendingInvite');
			if (pendingInvite) {
				localStorage.removeItem('pendingInvite');
				goto(`/join/${pendingInvite}`);
			} else {
				goto('/dashboard');
			}
		}
	}
</script>

<div class="auth-container">
	<form onsubmit={handleLogin} class="auth-form">
		<h1>Login to Dutch</h1>

		<div class="field">
			<label for="email">Email</label>
			<input type="email" id="email" bind:value={email} required placeholder="email@example.com" />
		</div>

		<div class="field">
			<label for="password">Password</label>
			<input type="password" id="password" bind:value={password} required placeholder="••••••••" />
		</div>

		<button type="submit" disabled={loading}>
			{loading ? 'Logging in...' : 'Login'}
		</button>

		<p class="switch">
			Don't have an account? <a href="/register">Register here</a>
		</p>
	</form>
</div>

<style>
	.auth-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 80vh;
	}

	.auth-form {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-width: 400px;
	}

	h1 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		text-align: center;
		font-size: 1.5rem;
	}

	.field {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 500;
		font-size: 0.875rem;
	}

	input {
		width: 100%;
		padding: 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 1rem;
	}

	button {
		width: 100%;
		padding: 0.625rem;
		background: #4f46e5;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		margin-top: 1rem;
	}

	button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.switch {
		margin-top: 1.5rem;
		text-align: center;
		font-size: 0.875rem;
		color: #6b7280;
	}

	a {
		color: #4f46e5;
		text-decoration: none;
		font-weight: 500;
	}

	a:hover {
		text-decoration: underline;
	}
</style>
