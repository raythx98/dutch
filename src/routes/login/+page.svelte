<script lang="ts">
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { query } from '$lib/api';
	import { fetchAndSyncCurrencies } from '$lib/currency';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});

	const LOGIN_MUTATION = `
        mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
                id
                name
                token
            }
        }
    `;

	function validate() {
		const newErrors: Record<string, string> = {};

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!email) {
			newErrors.email = 'Email is required';
		} else if (!emailRegex.test(email)) {
			newErrors.email = 'Invalid email address';
		} else if (email.length > 255) {
			newErrors.email = 'Email too long (max 255)';
		}

		if (!password) {
			newErrors.password = 'Password is required';
		} else if (password.length < 6) {
			newErrors.password = 'Password must be at least 6 characters';
		} else if (password.length > 30) {
			newErrors.password = 'Password too long (max 30)';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!validate()) return;

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
			
			// Sync currencies on login
			fetchAndSyncCurrencies();

			const pendingInvite = localStorage.getItem('pendingInvite');
			if (pendingInvite) {
				localStorage.removeItem('pendingInvite');
				goto(`${base}/join/${pendingInvite}`);
			} else {
				goto(`${base}/dashboard`);
			}
		}
	}
</script>

<div class="auth-page">
	<header class="auth-header">
		<a href="{base}/" class="logo">Dutch<span>.</span></a>
	</header>
	
	<div class="auth-container">
		<form onsubmit={handleLogin} class="auth-form">
			<h1>Login to Dutch</h1>

		<div class="field">
			<label for="email">Email</label>
			<input
				type="email"
				id="email"
				bind:value={email}
				required
				placeholder="email@example.com"
				class:error={errors.email}
			/>
			{#if errors.email}<span class="error-text">{errors.email}</span>{/if}
		</div>

		<div class="field">
			<label for="password">Password</label>
			<input
				type="password"
				id="password"
				bind:value={password}
				required
				placeholder="••••••••"
				class:error={errors.password}
			/>
			{#if errors.password}<span class="error-text">{errors.password}</span>{/if}
		</div>

		<button type="submit" disabled={loading}>
			{loading ? 'Logging in...' : 'Login'}
		</button>

		        <p class="switch">
		            Don't have an account? <a href="{base}/register">Register here</a>
		        </p>
		    </form>
	</div>
</div>
<style>
	.auth-page {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		width: 100%;
		box-sizing: border-box;
	}

	.auth-header {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.auth-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 60vh;
	}

	.auth-form {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-width: 400px;
	}

	@media (max-width: 480px) {
		.auth-container {
			padding: 1rem;
		}
		.auth-form {
			padding: 1.5rem;
			width: 90%;
		}
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

	input.error {
		border-color: #ef4444;
	}

	.error-text {
		color: #ef4444;
		font-size: 0.75rem;
		margin-top: 0.25rem;
		display: block;
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

	.switch a {
		color: #4f46e5;
		text-decoration: none;
		font-weight: 500;
	}

	.switch a:hover {
		text-decoration: underline;
	}
</style>
