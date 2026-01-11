<script lang="ts">
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { query } from '$lib/api';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});

	const REGISTER_MUTATION = `
        mutation Register($email: String!, $password: String!, $username: String!) {
            register(email: $email, password: $password, username: $username) {
                id
                name
                token
            }
        }
    `;

	function validate() {
		const newErrors: Record<string, string> = {};

		if (username.length < 3 || username.length > 20) {
			newErrors.username = 'Username must be between 3 and 20 characters';
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			newErrors.email = 'Invalid email address';
		} else if (email.length > 255) {
			newErrors.email = 'Email too long (max 255)';
		}

		if (password.length < 6 || password.length > 24) {
			newErrors.password = 'Password must be between 6 and 24 characters';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		if (!validate()) return;

		loading = true;
		const data = await query<{ register: { id: string; name: string; token: string } }>(
			REGISTER_MUTATION,
			{
				email,
				password,
				username
			}
		);
		loading = false;

		if (data?.register) {
			auth.login(data.register.token, { id: data.register.id, name: data.register.name });
			toast.success(`Account created! Welcome, ${data.register.name}!`);
			
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

<div class="auth-container">
	<form onsubmit={handleRegister} class="auth-form">
		<h1>Join Dutch</h1>

		<div class="field">
			<label for="username">Username</label>
			<input
				type="text"
				id="username"
				bind:value={username}
				required
				placeholder="johndoe"
				class:error={errors.username}
			/>
			{#if errors.username}<span class="error-text">{errors.username}</span>{/if}
		</div>

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
			{loading ? 'Creating account...' : 'Register'}
		</button>

		<p class="switch">
			Already have an account? <a href="{base}/login">Login here</a>
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

	a {
		color: #4f46e5;
		text-decoration: none;
		font-weight: 500;
	}

	a:hover {
		text-decoration: underline;
	}
</style>
