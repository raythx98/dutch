<script lang="ts">
	import { auth } from '$lib/auth';
	import { toast } from '$lib/toast';
	import { goto } from '$app/navigation';

	function logout() {
		auth.logout();
		toast.info('Logged out successfully');
		goto('/login');
	}
</script>

<div class="dashboard">
	<header>
		<h1>Dutch Dashboard</h1>
		<div class="user-info">
			<span>Logged in as: <strong>{$auth.user?.name}</strong></span>
			<button onclick={logout}>Logout</button>
		</div>
	</header>

	<main>
		<p>Welcome to your Dutch dashboard. This is a placeholder for your groups and expenses.</p>

		<div class="stats-grid">
			<div class="card">
				<h3>Total Balance</h3>
				<p class="amount">$0.00</p>
			</div>
			<div class="card">
				<h3>You are owed</h3>
				<p class="amount positive">$0.00</p>
			</div>
			<div class="card">
				<h3>You owe</h3>
				<p class="amount negative">$0.00</p>
			</div>
		</div>
	</main>
</div>

<style>
	.dashboard {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	button {
		padding: 0.5rem 1rem;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	button:hover {
		background: #f9fafb;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.card {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.amount {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	.positive {
		color: #059669;
	}

	.negative {
		color: #dc2626;
	}
</style>
