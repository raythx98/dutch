<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { currencyStore, guessedCurrencyCode } from '$lib/currency';
	import { query } from '$lib/api';
	import { toast } from '$lib/toast';
	import { onMount } from 'svelte';
	import type { Currency, ExchangeRateSnapshot } from '$lib/types';

	interface Props {
		groupId: string;
		creditorId: string;
		debtorId: string;
		sourceAmount: string;
		sourceCurrencyCode: string;
		usedCurrencies?: Currency[];
		onClose: () => void;
		onSuccess: () => void;
	}

	let {
		groupId,
		creditorId,
		debtorId,
		sourceAmount,
		sourceCurrencyCode,
		usedCurrencies = [],
		onClose,
		onSuccess
	}: Props = $props();

	let name = $state('Currency Conversion');
	let description = $state('');
	let targetCurrencyId = $state('');
	let rate = $state('');
	let targetAmount = $state('');
	let loading = $state(false);
	let fetchingRates = $state(false);
	let errors = $state<Record<string, string>>({});
	let rateSnapshot = $state<ExchangeRateSnapshot | null>(null);

	function getLocalDate(date: Date) {
		const offset = date.getTimezoneOffset();
		const localDate = new Date(date.getTime() - offset * 60 * 1000);
		return localDate.toISOString().slice(0, 10);
	}

	function getLocalTime(date: Date) {
		const h = String(date.getHours()).padStart(2, '0');
		const m = String(date.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}

	const initialDate = new Date();
	let expenseDate = $state(getLocalDate(initialDate));
	let expenseTime = $state(getLocalTime(initialDate));

	const displayCurrencies = $derived.by(() => {
		const usedFiltered = usedCurrencies.filter((c: Currency) => c.code !== sourceCurrencyCode);
		const usedIds = new Set(usedFiltered.map((c: Currency) => c.id));

		const guessedCurrency = $currencyStore.find(
			(c: Currency) =>
				c.code === $guessedCurrencyCode && c.code !== sourceCurrencyCode && !usedIds.has(c.id)
		);

		const priorityIds = new SvelteSet([...usedIds]);
		if (guessedCurrency) priorityIds.add(guessedCurrency.id);

		const others = $currencyStore.filter(
			(c: Currency) => !priorityIds.has(c.id) && c.code !== sourceCurrencyCode
		);
		const topSection = [...usedFiltered];
		if (guessedCurrency) topSection.push(guessedCurrency);

		if (topSection.length === 0)
			return $currencyStore.filter((c: Currency) => c.code !== sourceCurrencyCode);
		if (others.length === 0) return topSection;

		return [
			...topSection,
			{ id: 'separator', code: '──────────', symbol: '', name: 'Separator' },
			...others
		];
	});

	$effect(() => {
		if (displayCurrencies.length > 0 && !targetCurrencyId) {
			const first = displayCurrencies.find((c: Currency) => c.id !== 'separator');
			if (first) targetCurrencyId = first.id;
		}
	});

	const sourceCurrencyId = $derived(
		$currencyStore.find((c: Currency) => c.code === sourceCurrencyCode)?.id ??
			usedCurrencies.find((c: Currency) => c.code === sourceCurrencyCode)?.id ??
			''
	);

	const targetCurrencyCode = $derived(
		$currencyStore.find((c: Currency) => c.id === targetCurrencyId)?.code ?? ''
	);

	const hasUnsupportedCurrency = $derived(
		rateSnapshot != null &&
			(rateSnapshot.unsupportedCurrencies.includes(sourceCurrencyCode) ||
				(targetCurrencyCode !== '' &&
					rateSnapshot.unsupportedCurrencies.includes(targetCurrencyCode)))
	);

	const lastUpdatedText = $derived.by(() => {
		if (!rateSnapshot) return '';
		const h = Math.floor((Date.now() - new Date(rateSnapshot.fetchedAt).getTime()) / 3_600_000);
		return h < 1 ? 'Updated recently' : `Updated ${h}h ago`;
	});

	function computeCrossRate(fromCode: string, toCode: string): string | null {
		const from = rateSnapshot?.rates.find((r) => r.code === fromCode)?.rate;
		const to = rateSnapshot?.rates.find((r) => r.code === toCode)?.rate;
		if (!from || !to) return null;
		return (parseFloat(to) / parseFloat(from)).toFixed(6);
	}

	function updateRateForCurrentPair() {
		if (!rateSnapshot || !targetCurrencyCode) return;
		const r = computeCrossRate(sourceCurrencyCode, targetCurrencyCode);
		if (r !== null) {
			rate = r;
			const src = parseFloat(sourceAmount);
			if (!isNaN(src) && src > 0) {
				targetAmount = (src * parseFloat(r)).toFixed(2);
			}
		}
	}

	$effect(() => {
		if (rateSnapshot && targetCurrencyCode) {
			updateRateForCurrentPair();
		}
	});

	function onRateInput(e: Event) {
		rate = (e.target as HTMLInputElement).value;
		const r = parseFloat(rate);
		const src = parseFloat(sourceAmount);
		if (!isNaN(r) && !isNaN(src) && src > 0) {
			targetAmount = (src * r).toFixed(2);
		}
	}

	function onTargetAmountInput(e: Event) {
		targetAmount = (e.target as HTMLInputElement).value;
		const t = parseFloat(targetAmount);
		const src = parseFloat(sourceAmount);
		if (!isNaN(t) && !isNaN(src) && src > 0) {
			rate = (t / src).toFixed(6);
		}
	}

	const EXCHANGE_RATES_QUERY = `
		query ExchangeRates {
			exchangeRates {
				base
				rates { code rate }
				fetchedAt
				unsupportedCurrencies
			}
		}
	`;

	onMount(async () => {
		fetchingRates = true;
		const data = await query<{ exchangeRates: ExchangeRateSnapshot }>(EXCHANGE_RATES_QUERY);
		if (data) {
			rateSnapshot = data.exchangeRates;
		}
		fetchingRates = false;
	});

	function validate() {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Title is required';
		} else if (name.length > 100) {
			newErrors.name = 'Title too long (max 100)';
		}

		if (description.length > 1000) {
			newErrors.description = 'Description too long (max 1000)';
		}

		const ta = parseFloat(targetAmount);
		if (isNaN(ta) || ta <= 0) {
			newErrors.targetAmount = 'Valid target amount is required';
		}

		const r = parseFloat(rate);
		if (isNaN(r) || r <= 0) {
			newErrors.rate = 'Valid exchange rate is required';
		}

		if (!targetCurrencyId) {
			newErrors.targetCurrency = 'Target currency is required';
		}

		if (!expenseDate) {
			newErrors.date = 'Date is required';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!validate()) {
			const firstError = Object.values(errors)[0];
			toast.error(firstError);
			return;
		}

		if (!sourceCurrencyId) {
			toast.error('Source currency not found');
			return;
		}

		loading = true;

		const localDateTime = new Date(`${expenseDate}T${expenseTime}:00`);
		const expenseAt = localDateTime.toISOString();

		const input = {
			name,
			description,
			sourceAmount: parseFloat(sourceAmount).toFixed(2),
			sourceCurrencyId,
			targetAmount: parseFloat(targetAmount).toFixed(2),
			targetCurrencyId,
			expenseAt,
			debtorId,
			creditorId
		};

		const data = await query(
			`
			mutation AddConversion($groupId: ID!, $input: ConversionInput!) {
				addConversion(groupId: $groupId, input: $input) {
					id
				}
			}
			`,
			{ groupId, input }
		);

		if (data) {
			toast.success('Conversion recorded');
			onSuccess();
		}

		loading = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" onclick={onClose} aria-hidden="true">
	<div class="modal-content" onclick={(e) => e.stopPropagation()} aria-hidden="true">
		<header class="modal-header">
			<h2>Convert Currency</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<form onsubmit={handleSubmit}>
			<div class="form-group">
				<label for="name">Title</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					placeholder="Currency Conversion"
					required
					class:error={errors.name}
				/>
				{#if errors.name}<span class="error-text">{errors.name}</span>{/if}
			</div>

			<div class="form-group">
				<label for="description">Description (Optional)</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Add more details..."
					class:error={errors.description}
				></textarea>
				{#if errors.description}<span class="error-text">{errors.description}</span>{/if}
			</div>

			<div class="source-display">
				<span class="source-label">Converting from</span>
				<span class="source-amount"
					>{sourceCurrencyCode}
					<strong>{sourceAmount}</strong></span
				>
			</div>

			<div class="form-group">
				<label for="target-currency">To currency</label>
				<select
					id="target-currency"
					bind:value={targetCurrencyId}
					class:error={errors.targetCurrency}
				>
					<option value="" disabled selected>Select currency</option>
					{#each displayCurrencies as curr (curr.id)}
						<option value={curr.id} disabled={curr.id === 'separator'}>
							{curr.code}
							{curr.symbol ? `(${curr.symbol})` : ''}
						</option>
					{/each}
				</select>
				{#if errors.targetCurrency}<span class="error-text">{errors.targetCurrency}</span>{/if}
			</div>

			<div class="rate-section">
				<div class="form-group rate-group">
					<label for="rate">
						Exchange rate
						{#if lastUpdatedText}
							<span class="rate-meta">{lastUpdatedText}</span>
						{/if}
					</label>
					{#if fetchingRates}
						<div class="rate-loading">Fetching market rate…</div>
					{:else}
						<div class="rate-input-row">
							<span class="rate-label-inline">1 {sourceCurrencyCode} =</span>
							<input
								type="number"
								id="rate"
								step="0.000001"
								min="0"
								value={rate}
								oninput={onRateInput}
								placeholder="0.000000"
								class:error={errors.rate}
							/>
							<span class="rate-label-inline">{targetCurrencyCode || '...'}</span>
						</div>
					{/if}
					{#if errors.rate}<span class="error-text">{errors.rate}</span>{/if}
				</div>

				<div class="form-group">
					<label for="target-amount">Target amount</label>
					<div class="input-with-currency" class:error={errors.targetAmount}>
						<span class="currency-prefix">{targetCurrencyCode || '...'}</span>
						<input
							type="number"
							id="target-amount"
							step="0.01"
							min="0"
							value={targetAmount}
							oninput={onTargetAmountInput}
							placeholder="0.00"
						/>
					</div>
					{#if errors.targetAmount}<span class="error-text">{errors.targetAmount}</span>{/if}
				</div>
			</div>

			{#if hasUnsupportedCurrency}
				<p class="unsupported-warning">
					Market rate unavailable for one of the selected currencies — please enter the rate
					manually.
				</p>
			{/if}

			<div class="form-row compact-row">
				<div class="form-group">
					<label for="date">Date</label>
					<input
						type="date"
						id="date"
						bind:value={expenseDate}
						required
						class:error={errors.date}
					/>
					{#if errors.date}<span class="error-text">{errors.date}</span>{/if}
				</div>
				<div class="form-group">
					<label for="time">Time</label>
					<input type="time" id="time" bind:value={expenseTime} />
				</div>
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={loading || fetchingRates}>
					{loading ? 'Saving…' : 'Convert'}
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		width: 100%;
		max-width: 420px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #111827;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #9ca3af;
	}

	.source-display {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin-bottom: 1.25rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.source-label {
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.source-amount {
		font-size: 0.9375rem;
		color: #374151;
	}

	.source-amount strong {
		font-size: 1.1rem;
		margin-left: 0.25rem;
	}

	.rate-section {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1.25rem;
	}

	.rate-group {
		margin-bottom: 1rem;
	}

	.rate-input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.rate-label-inline {
		font-size: 0.875rem;
		color: #6b7280;
		white-space: nowrap;
	}

	.rate-loading {
		font-size: 0.875rem;
		color: #6b7280;
		padding: 0.5rem 0;
	}

	.rate-meta {
		font-size: 0.7rem;
		color: #9ca3af;
		font-weight: 400;
		margin-left: 0.5rem;
	}

	.input-with-currency {
		display: flex;
		align-items: center;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		overflow: hidden;
	}

	.input-with-currency.error {
		border-color: #ef4444;
	}

	.currency-prefix {
		padding: 0.625rem 0.75rem;
		background: #f9fafb;
		border-right: 1px solid #d1d5db;
		font-size: 0.875rem;
		color: #6b7280;
		white-space: nowrap;
	}

	.input-with-currency input {
		border: none;
		padding: 0.625rem;
		width: 100%;
		font-size: 1rem;
		outline: none;
	}

	.unsupported-warning {
		font-size: 0.8125rem;
		color: #374151;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
		padding: 0.625rem 0.75rem;
		margin-bottom: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.compact-row {
		margin-bottom: 0.75rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input[type='text'],
	.form-group input[type='date'],
	.form-group input[type='time'],
	.form-group input[type='number'],
	.form-group textarea,
	.form-group select {
		padding: 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		width: 100%;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.form-group textarea {
		resize: vertical;
		min-height: 60px;
	}

	.rate-input-row input[type='number'] {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 1rem;
	}

	.error-text {
		color: #ef4444;
		font-size: 0.75rem;
		margin-top: 0.25rem;
		display: block;
	}

	select.error,
	input.error {
		border-color: #ef4444;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
	}

	@media (max-width: 480px) {
		.modal-content {
			width: 90%;
			padding: 1.5rem;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.modal-actions {
			flex-direction: column-reverse;
		}

		.modal-actions button {
			width: 100%;
		}
	}
</style>
