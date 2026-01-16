<script lang="ts">
	import { auth } from '$lib/auth';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
</script>

<div class="landing-page">
	<nav class="nav">
		<a href="{base}/" class="logo">Dutch<span>.</span></a>
	</nav>

	<main class="hero">
		<div class="hero-content">
			<h1>Splitting expenses, <span class="highlight">simplified</span>.</h1>
			<p class="description">
				Dutch helps you track shared expenses with friends, family, and housemates. No more awkward
				conversations about who owes what.
			</p>
			<div class="hero-actions">
				{#if $auth.token}
					<button class="btn btn-lg btn-primary" onclick={() => goto(`${base}/dashboard`)}
						>Go to Dashboard</button
					>
				{:else}
					<button class="btn btn-lg btn-primary" onclick={() => goto(`${base}/register`)}
						>Start Splitting for Free</button
					>
					<button class="btn btn-lg btn-primary-outline" onclick={() => goto(`${base}/login`)}
						>Sign In</button
					>
				{/if}
			</div>
		</div>
		<div class="hero-image">
			<div class="mock-ui">
				<div class="mock-header">
					<div class="mock-dot red"></div>
					<div class="mock-dot yellow"></div>
					<div class="mock-dot green"></div>
					<div class="mock-title">Group: Summer Trip ☀️</div>
				</div>
				<div class="mock-body">
					<div class="mock-row">
						<div class="mock-date">
							<div class="m-month">JAN</div>
							<div class="m-day">14</div>
						</div>
						<div class="mock-icon grocery">🛒</div>
						<div class="mock-text-group">
							<div class="mock-text short">Groceries</div>
							<div class="mock-subtext">Paid by Alice</div>
						</div>
						<div class="mock-amount negative">-$42.00</div>
					</div>
					<div class="mock-row">
						<div class="mock-date">
							<div class="m-month">JAN</div>
							<div class="m-day">12</div>
						</div>
						<div class="mock-icon dinner">🍕</div>
						<div class="mock-text-group">
							<div class="mock-text short">Pizza Night</div>
							<div class="mock-subtext">Paid by You</div>
						</div>
						<div class="mock-amount positive">+$15.50</div>
					</div>
					<div class="mock-row repayment">
						<div class="mock-date">
							<div class="m-month">JAN</div>
							<div class="m-day">10</div>
						</div>
						<div class="mock-icon settle">✅</div>
						<div class="mock-text-group">
							<div class="mock-text short">Settle up</div>
							<div class="mock-subtext">Bob paid You</div>
						</div>
						<div class="mock-amount positive">+$25.00</div>
					</div>
					<div class="mock-row">
						<div class="mock-date">
							<div class="m-month">JAN</div>
							<div class="m-day">08</div>
						</div>
						<div class="mock-icon transport">🚗</div>
						<div class="mock-text-group">
							<div class="mock-text short">Gas station</div>
							<div class="mock-subtext">Paid by Charlie</div>
						</div>
						<div class="mock-amount negative">-$10.20</div>
					</div>
				</div>
			</div>
		</div>
	</main>

	<section class="features">
		<div class="feature-card">
			<div class="feature-icon">💸</div>
			<h3>Track Expenses</h3>
			<p>Easily add expenses and split them any way you want.</p>
		</div>
		<div class="feature-card">
			<div class="feature-icon">👥</div>
			<h3>Group Management</h3>
			<p>Organize your shared costs by trips, households, or events.</p>
		</div>
		<div class="feature-card">
			<div class="feature-icon">🔄</div>
			<h3>Easy Settlements</h3>
			<p>See exactly who owes whom and settle up with one click.</p>
		</div>
	</section>

	<footer class="footer">
		<p>&copy; {new Date().getFullYear()} Dutch. All rights reserved.</p>
	</footer>
</div>

<style>
	.landing-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: linear-gradient(to bottom, #f9fafb, #ffffff);
		color: #111827;
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Helvetica,
			Arial,
			sans-serif;
	}

	.nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
	}

	.hero {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4rem 2rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
		gap: 4rem;
		flex: 1;
	}

	.hero-content {
		flex: 1;
		max-width: 600px;
	}

	.hero-content h1 {
		font-size: 3.5rem;
		font-weight: 800;
		line-height: 1.1;
		margin-bottom: 1.5rem;
		letter-spacing: -0.02em;
	}

	.highlight {
		color: #2563eb;
	}

	.description {
		font-size: 1.25rem;
		color: #4b5563;
		line-height: 1.6;
		margin-bottom: 2.5rem;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.btn-lg {
		padding: 1rem 2rem;
		font-size: 1.125rem;
	}

	.hero-image {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.mock-ui {
		background: white;
		border-radius: 12px;
		box-shadow:
			0 20px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
		width: 100%;
		max-width: 420px;
		border: 1px solid #e5e7eb;
		overflow: hidden;
	}

	.mock-header {
		background: #f9fafb;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.mock-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.mock-dot.red {
		background: #ff5f56;
	}
	.mock-dot.yellow {
		background: #ffbd2e;
	}
	.mock-dot.green {
		background: #27c93f;
	}

	.mock-title {
		margin-left: 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
	}

	.mock-body {
		padding: 0.5rem 1rem;
	}

	.mock-row {
		display: flex;
		align-items: center;
		padding: 1rem 0;
		border-bottom: 1px solid #f3f4f6;
		gap: 1rem;
	}

	.mock-row:last-child {
		border-bottom: none;
	}

	.mock-date {
		text-align: center;
		min-width: 32px;
		color: #9ca3af;
	}

	.m-month {
		font-size: 0.65rem;
		font-weight: 700;
	}
	.m-day {
		font-size: 1rem;
		font-weight: 800;
		color: #374151;
		margin-top: -2px;
	}

	.mock-icon {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #f3f4f6;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.mock-row.repayment .mock-icon {
		background: #ecfdf5;
	}

	.mock-text-group {
		flex: 1;
		min-width: 0;
	}

	.mock-text {
		font-weight: 600;
		font-size: 0.95rem;
		color: #111827;
	}

	.mock-subtext {
		font-size: 0.75rem;
		color: #6b7280;
		margin-top: 0.125rem;
	}

	.mock-amount {
		font-weight: 700;
		font-size: 0.95rem;
		white-space: nowrap;
	}

	.mock-amount.positive {
		color: #059669;
	}
	.mock-amount.negative {
		color: #dc2626;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
		padding: 4rem 2rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
	}

	.feature-card {
		padding: 2.5rem;
		background: white;
		border-radius: 16px;
		border: 1px solid #e5e7eb;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}

	.feature-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
	}

	.feature-icon {
		font-size: 2.5rem;
		margin-bottom: 1.5rem;
	}

	.feature-card h3 {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1rem;
	}

	.feature-card p {
		color: #4b5563;
		line-height: 1.6;
	}

	.footer {
		padding: 2rem;
		text-align: center;
		color: #6b7280;
		font-size: 0.875rem;
		border-top: 1px solid #e5e7eb;
		margin-top: auto;
	}

	@media (max-width: 1024px) {
		.hero {
			flex-direction: column;
			text-align: center;
			gap: 3rem;
		}

		.hero-content {
			max-width: 100%;
		}

		.hero-actions {
			justify-content: center;
		}

		.hero-content h1 {
			font-size: 2.75rem;
		}
	}

	@media (max-width: 640px) {
		.hero-content h1 {
			font-size: 2.25rem;
		}

		.hero-image {
			display: none;
		}

		.nav {
			padding: 1rem;
		}

		.hero {
			padding: 2rem 1rem;
		}

		.features {
			padding: 2rem 1rem;
		}
	}
</style>
