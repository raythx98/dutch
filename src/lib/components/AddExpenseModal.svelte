<script lang="ts">
	import { currencyStore, guessedCurrencyCode } from '$lib/currency';
	import { query } from '$lib/api';
	import { isOnline } from '$lib/connectivity';
	import {
		enqueueOperation,
		addExpenseToGroupCache,
		updateExpenseInGroupCache
	} from '$lib/offline';
	import { toast } from '$lib/toast';
	import { auth } from '$lib/auth';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import type { User, Expense, Currency, Share, ExpenseInput } from '$lib/types';

	interface Props {
		groupId: string;
		members: User[];
		expense?: Expense;
		usedCurrencies?: Currency[];
		onClose: () => void;
		onSuccess: () => void;
	}

	let { groupId, members, expense, usedCurrencies = [], onClose, onSuccess }: Props = $props();

	let isEditing = $derived(!!expense);
	let isViewOnly = $state(false);

	let name = $state<string>('');
	let description = $state<string>('');
	let amount = $state<string>('');
	let currencyId = $state<string>('');

	const displayCurrencies = $derived.by(() => {
		const usedIds = new Set(usedCurrencies.map((c: Currency) => c.id));

		const guessedCurrency = $currencyStore.find((c: Currency) => c.code === $guessedCurrencyCode);

		const topSection = [...usedCurrencies];

		if (guessedCurrency && !usedIds.has(guessedCurrency.id)) {
			topSection.push(guessedCurrency);
		}

		const priorityIds = new Set(topSection.map((c) => c.id));
		const others = $currencyStore.filter((c: Currency) => !priorityIds.has(c.id));

		if (topSection.length === 0) return $currencyStore;
		if (others.length === 0) return topSection;

		return [
			...topSection,
			{ id: 'separator', code: '──────────', symbol: '', name: 'Separator' },
			...others
		];
	});

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

	let initialDate = new Date();
	let expenseDate = $state<string>(getLocalDate(initialDate));
	let expenseTime = $state<string>('00:00');

	$effect.pre(() => {
		if (expense) {
			isViewOnly = true;
			name = expense.name;
			description = expense.description || '';
			amount = expense.amount;
			const d = new Date(expense.expenseAt);
			expenseDate = getLocalDate(d);
			expenseTime = getLocalTime(d);
		}
	});

	let loading = $state(false);
	let errors = $state<Record<string, string>>({});
	let amountInput: HTMLInputElement;

	const sortedMembers = $derived(
		[...members].sort((a, b) => (a.id === $auth.user?.id ? -1 : b.id === $auth.user?.id ? 1 : 0))
	);

	// --- Split state — initialised synchronously so first render is correct ---
	function buildInitialSplit() {
		const currentUserId = get(auth).user?.id;
		const pInc: Record<string, boolean> = {};
		const sInc: Record<string, boolean> = {};
		const pRat: Record<string, number> = {};
		const sRat: Record<string, number> = {};
		const pAmt: Record<string, number> = {};
		const sAmt: Record<string, number> = {};

		for (const m of members) {
			pRat[m.id] = 1;
			sRat[m.id] = 1;
			if (expense) {
				const payer = expense.payers.find((p: Share) => p.user.id === m.id);
				const share = expense.shares.find((s: Share) => s.user.id === m.id);
				pInc[m.id] = !!(payer && parseFloat(payer.amount) > 0);
				sInc[m.id] = !!(share && parseFloat(share.amount) > 0);
				pAmt[m.id] = payer ? parseFloat(payer.amount) : 0;
				sAmt[m.id] = share ? parseFloat(share.amount) : 0;
			} else {
				pInc[m.id] = m.id === currentUserId;
				sInc[m.id] = true;
				pAmt[m.id] = 0;
				sAmt[m.id] = 0;
			}
		}
		// useRatios starts ON for new expenses, OFF when editing (can't reverse-engineer ratios)
		const useRatios = !expense;
		return { pInc, sInc, pRat, sRat, pAmt, sAmt, useRatios };
	}

	const _init = buildInitialSplit();
	let payerIncluded = $state<Record<string, boolean>>(_init.pInc);
	let shareIncluded = $state<Record<string, boolean>>(_init.sInc);
	let payerRatios = $state<Record<string, number>>(_init.pRat);
	let shareRatios = $state<Record<string, number>>(_init.sRat);
	let payerUseRatios = $state(_init.useRatios);
	let shareUseRatios = $state(_init.useRatios);
	let payerAmounts = $state<Record<string, number>>(_init.pAmt);
	let shareAmounts = $state<Record<string, number>>(_init.sAmt);

	// Recalculate payer amounts when ratio mode is on
	$effect(() => {
		if (!payerUseRatios) return;
		const allIds = sortedMembers.map((m) => m.id);
		const includedIds = sortedMembers.filter((m) => payerIncluded[m.id]).map((m) => m.id);
		payerAmounts = distributeByRatio(amount, includedIds, payerRatios, allIds);
	});

	// Recalculate share amounts when ratio mode is on
	$effect(() => {
		if (!shareUseRatios) return;
		const allIds = sortedMembers.map((m) => m.id);
		const includedIds = sortedMembers.filter((m) => shareIncluded[m.id]).map((m) => m.id);
		shareAmounts = distributeByRatio(amount, includedIds, shareRatios, allIds);
	});

	const iterPayers = $derived(
		isViewOnly ? sortedMembers.filter((m) => (payerAmounts[m.id] ?? 0) > 0) : sortedMembers
	);

	const iterShares = $derived(
		isViewOnly ? sortedMembers.filter((m) => (shareAmounts[m.id] ?? 0) > 0) : sortedMembers
	);

	let payersDiff = $derived.by(() => {
		const total = parseFloat(amount || '0');
		const sum = Object.values(payerAmounts).reduce((acc, a) => acc + (a ?? 0), 0);
		const diff = sum - total;
		if (Math.abs(diff) < 0.001) return null;
		return { val: Math.abs(diff).toFixed(2), text: diff > 0 ? 'exceed by' : 'under by' };
	});

	let sharesDiff = $derived.by(() => {
		const total = parseFloat(amount || '0');
		const sum = Object.values(shareAmounts).reduce((acc, a) => acc + (a ?? 0), 0);
		const diff = sum - total;
		if (Math.abs(diff) < 0.001) return null;
		return { val: Math.abs(diff).toFixed(2), text: diff > 0 ? 'exceed by' : 'under by' };
	});

	function getName(member: User | undefined) {
		if (!member) return 'Unknown';
		return member.name;
	}

	$effect(() => {
		if (displayCurrencies.length > 0 && !currencyId) {
			if (expense) {
				const found = displayCurrencies.find((c: Currency) => c.code === expense.currency.code);
				if (found && found.id !== 'separator') currencyId = found.id;
			} else {
				const first = displayCurrencies.find((c: Currency) => c.id !== 'separator');
				if (first) currencyId = first.id;
			}
		}
	});

	onMount(() => {
		if (amountInput && !isViewOnly) amountInput.focus();
	});

	/**
	 * Distributes a total amount among included users proportionally by ratio.
	 * Remainder cents are distributed randomly to avoid systematic bias.
	 */
	function distributeByRatio(
		totalStr: string,
		includedIds: string[],
		ratios: Record<string, number>,
		allIds: string[]
	): Record<string, number> {
		const result: Record<string, number> = {};
		for (const id of allIds) result[id] = 0;
		if (includedIds.length === 0) return result;

		const total = parseFloat(totalStr || '0');
		if (isNaN(total) || total <= 0) return result;

		const totalRatio = includedIds.reduce((sum, id) => sum + (Number(ratios[id]) || 1), 0);
		if (totalRatio === 0) return result;

		const totalCents = Math.round(total * 100);
		const cents: Record<string, number> = {};
		let allocated = 0;

		for (const id of includedIds) {
			const share = Math.floor(((Number(ratios[id]) || 1) / totalRatio) * totalCents);
			cents[id] = share;
			allocated += share;
		}

		const remainder = totalCents - allocated;

		// Shuffle for random penny distribution — no one is systematically shortchanged
		const shuffled = [...includedIds];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		for (let i = 0; i < remainder; i++) {
			cents[shuffled[i % shuffled.length]] += 1;
		}

		for (const id of includedIds) {
			result[id] = cents[id] / 100;
		}

		return result;
	}

	/** Euclidean GCD of two non-negative integers. */
	function gcdTwo(a: number, b: number): number {
		return b === 0 ? a : gcdTwo(b, a % b);
	}

	/**
	 * Reverse-engineers the smallest integer ratios that reproduce `amounts`
	 * within ±1 cent each when fed back through distributeByRatio.
	 *
	 * Strategy: scan multipliers 1→MAX_SCALE (finds simplest ratio first),
	 * fall back to GCD-based exact ratios if no clean fit is found.
	 */
	function reverseEngineerRatios(amounts: number[], total: number): number[] {
		if (amounts.length === 0) return [];
		if (amounts.length === 1) return [1];

		const T = Math.round(total * 100);
		const c = amounts.map((a) => Math.round(a * 100));

		// Edge case: total is 0 or all amounts are 0
		if (T <= 0 || c.every((v) => v === 0)) return amounts.map(() => 1);

		const MAX_SCALE = 100;

		for (let scale = 1; scale <= MAX_SCALE; scale++) {
			const r = c.map((v) => Math.round((v / T) * scale));
			if (r.some((v) => v <= 0)) continue;

			const rTotal = r.reduce((sum, v) => sum + v, 0);
			const sim = r.map((v) => Math.floor((v / rTotal) * T));
			if (c.every((v, i) => Math.abs(v - sim[i]) <= 1)) return r;
		}

		// Fallback: GCD-based exact ratios
		const g = c.reduce((a, b) => gcdTwo(a, b));
		return c.map((v) => (g > 0 ? v / g : 1));
	}

	/**
	 * Handles the "Use ratios" toggle for a given section.
	 * When enabling, reverse-engineers ratios from current amounts so the
	 * user sees a meaningful starting point rather than all-1s.
	 */
	function handleUseRatiosToggle(section: 'payers' | 'shares', enabled: boolean) {
		if (enabled) {
			const total = parseFloat(amount || '0');
			if (section === 'payers') {
				const includedIds = sortedMembers.filter((m) => payerIncluded[m.id]).map((m) => m.id);
				const amounts = includedIds.map((id) => payerAmounts[id] ?? 0);
				const amountsSum = amounts.reduce((s, v) => s + v, 0);
				// Only reverse-engineer if current amounts are consistent with the total.
				// If stale (e.g. total changed while in manual mode), keep existing ratios
				// so the $effect re-applies them to the new total instead of using garbage ratios.
				if (Math.abs(amountsSum - total) < 0.02) {
					const reversed = reverseEngineerRatios(amounts, total);
					includedIds.forEach((id, i) => {
						payerRatios[id] = reversed[i];
					});
				}
				payerUseRatios = true;
			} else {
				const includedIds = sortedMembers.filter((m) => shareIncluded[m.id]).map((m) => m.id);
				const amounts = includedIds.map((id) => shareAmounts[id] ?? 0);
				const amountsSum = amounts.reduce((s, v) => s + v, 0);
				if (Math.abs(amountsSum - total) < 0.02) {
					const reversed = reverseEngineerRatios(amounts, total);
					includedIds.forEach((id, i) => {
						shareRatios[id] = reversed[i];
					});
				}
				shareUseRatios = true;
			}
		} else {
			if (section === 'payers') payerUseRatios = false;
			else shareUseRatios = false;
		}
	}

	function handleAmountChange() {
		if (isViewOnly) return;
		// In manual payer mode with exactly 1 included payer, auto-assign the full amount
		if (!payerUseRatios) {
			const includedPayerIds = sortedMembers.filter((m) => payerIncluded[m.id]).map((m) => m.id);
			if (includedPayerIds.length === 1) {
				payerAmounts = { ...payerAmounts, [includedPayerIds[0]]: parseFloat(amount || '0') };
			}
		}
		// Ratio mode: $effect handles recalculation automatically
	}

	function validate() {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Expense name is required';
		} else if (name.length > 100) {
			newErrors.name = 'Name too long (max 100)';
		}

		if (description.length > 1000) {
			newErrors.description = 'Description too long (max 1000)';
		}

		const totalAmount = parseFloat(amount);
		if (isNaN(totalAmount) || totalAmount < 0) {
			newErrors.amount = 'Valid amount is required';
		}

		if (!currencyId) {
			newErrors.currency = 'Currency is required';
		}

		if (!expenseDate) {
			newErrors.date = 'Date is required';
		}

		if (!expenseTime) {
			newErrors.time = 'Time is required';
		}

		if (Object.keys(newErrors).length === 0) {
			const payersSum = Object.values(payerAmounts).reduce((sum, a) => sum + (a ?? 0), 0);
			if (Math.abs(payersSum - totalAmount) > 0.01) {
				newErrors.payers = `Sum (${payersSum.toFixed(2)}) must equal total (${totalAmount.toFixed(2)})`;
			}

			const sharesSum = Object.values(shareAmounts).reduce((sum, a) => sum + (a ?? 0), 0);
			if (Math.abs(sharesSum - totalAmount) > 0.01) {
				newErrors.shares = `Sum (${sharesSum.toFixed(2)}) must equal total (${totalAmount.toFixed(2)})`;
			}
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function saveOffline(input: ExpenseInput): Promise<void> {
		const currency = displayCurrencies.find(
			(c: Currency) => c.id === currencyId && c.id !== 'separator'
		);
		if (!currency) {
			toast.error('Currency not found — cannot save offline');
			loading = false;
			return;
		}

		if (isEditing && expense) {
			const optimistic: Expense = {
				id: expense.id,
				type: expense.type,
				name: input.name,
				description: input.description,
				amount: input.amount,
				expenseAt: input.expenseAt,
				currency: {
					id: currency.id,
					code: currency.code,
					symbol: currency.symbol,
					name: currency.name
				},
				payers: input.payers.map((p) => {
					const m = members.find((u) => u.id === p.userId);
					return { user: { id: m?.id ?? p.userId, name: m?.name ?? 'Unknown' }, amount: p.amount };
				}),
				shares: input.shares.map((s) => {
					const m = members.find((u) => u.id === s.userId);
					return { user: { id: m?.id ?? s.userId, name: m?.name ?? 'Unknown' }, amount: s.amount };
				}),
				pendingSync: true
			};
			await updateExpenseInGroupCache(groupId, optimistic);
			await enqueueOperation({
				operation: 'editExpense',
				groupId,
				expenseId: expense.id,
				payload: input,
				createdAt: Date.now()
			});
			toast.success('Change saved \u2014 will sync when online');
		} else {
			const tempId = crypto.randomUUID();
			const optimistic: Expense = {
				id: tempId,
				type: 'Generic',
				name: input.name,
				description: input.description,
				amount: input.amount,
				expenseAt: input.expenseAt,
				currency: {
					id: currency.id,
					code: currency.code,
					symbol: currency.symbol,
					name: currency.name
				},
				payers: input.payers.map((p) => {
					const m = members.find((u) => u.id === p.userId);
					return { user: { id: m?.id ?? p.userId, name: m?.name ?? 'Unknown' }, amount: p.amount };
				}),
				shares: input.shares.map((s) => {
					const m = members.find((u) => u.id === s.userId);
					return { user: { id: m?.id ?? s.userId, name: m?.name ?? 'Unknown' }, amount: s.amount };
				}),
				pendingSync: true
			};
			await addExpenseToGroupCache(groupId, optimistic);
			await enqueueOperation({
				operation: 'addExpense',
				groupId,
				payload: input,
				tempId,
				createdAt: Date.now()
			});
			toast.success('Expense saved \u2014 will sync when online');
		}

		loading = false;
		onSuccess();
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (isViewOnly) return;

		if (!validate()) {
			const firstError = Object.values(errors)[0];
			toast.error(firstError);
			return;
		}

		loading = true;

		const totalAmount = parseFloat(amount);
		const localDateTime = new Date(`${expenseDate}T${expenseTime}:00`);
		const expenseAtVal = localDateTime.toISOString();

		const input: ExpenseInput = {
			name,
			description,
			type: 'Generic',
			amount: totalAmount.toFixed(2),
			currencyId,
			expenseAt: expenseAtVal,
			payers: sortedMembers
				.filter((m) => (payerAmounts[m.id] ?? 0) > 0)
				.map((m) => ({ userId: m.id, amount: (payerAmounts[m.id] ?? 0).toFixed(2) })),
			shares: sortedMembers
				.filter((m) => (shareAmounts[m.id] ?? 0) > 0)
				.map((m) => ({ userId: m.id, amount: (shareAmounts[m.id] ?? 0).toFixed(2) }))
		};

		if (!get(isOnline)) {
			try {
				await saveOffline(input);
			} catch (e) {
				console.error('saveOffline failed:', e);
				toast.error('Could not save. Please try again.');
				loading = false;
			}
			return;
		}

		// ---- Online path ----
		let data;
		if (isEditing) {
			data = await query(
				`
				mutation EditExpense($id: ID!, $input: ExpenseInput!) {
					editExpense(expenseId: $id, input: $input) {
						id
					}
				}
			`,
				{ id: expense?.id, input }
			);
		} else {
			data = await query(
				`
				mutation AddExpense($groupId: ID!, $input: ExpenseInput!) {
					addExpense(groupId: $groupId, input: $input) {
						id
					}
				}
			`,
				{ groupId, input }
			);
		}

		if (data) {
			toast.success(isEditing ? 'Expense updated' : 'Expense added');
			onSuccess();
			loading = false;
			return;
		}

		// Timed out or server unreachable — isOnline is now false, queue the operation
		if (!get(isOnline)) {
			try {
				await saveOffline(input);
			} catch (e) {
				console.error('saveOffline failed:', e);
				toast.error('Could not save. Please try again.');
				loading = false;
			}
			return;
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
			<h2>{isEditing ? (isViewOnly ? 'Expense Details' : 'Edit Expense') : 'Add Expense'}</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<form onsubmit={handleSubmit}>
			<div class="form-group mb-1">
				<label for="name">Expense Name</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					placeholder="e.g. Dinner, Groceries"
					required
					disabled={isViewOnly}
					class:error={errors.name}
				/>
				{#if errors.name}<span class="error-text">{errors.name}</span>{/if}
			</div>

			<div class="form-group mb-1">
				<label for="description">Description (Optional)</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Add more details..."
					disabled={isViewOnly}
					class:error={errors.description}
				></textarea>
				{#if errors.description}<span class="error-text">{errors.description}</span>{/if}
			</div>

			<div class="form-row">
				<div class="form-group amount-group">
					<label for="amount">Amount</label>
					<div class="input-with-currency" class:error={errors.amount || errors.currency}>
						<select bind:value={currencyId} disabled={isViewOnly}>
							<option value="" disabled selected>Select</option>
							{#each displayCurrencies as curr (curr.id)}
								<option value={curr.id} disabled={curr.id === 'separator'}>
									{curr.code}
									{curr.symbol ? `(${curr.symbol})` : ''}
								</option>
							{/each}
						</select>
						<input
							type="number"
							id="amount"
							step="0.01"
							bind:this={amountInput}
							bind:value={amount}
							oninput={handleAmountChange}
							placeholder="0.00"
							required
							disabled={isViewOnly}
						/>
					</div>
					{#if errors.amount}<span class="error-text">{errors.amount}</span>{/if}
					{#if errors.currency}<span class="error-text">{errors.currency}</span>{/if}
				</div>
				<div class="form-group date-time-group">
					<label for="date">Date & Time</label>
					<div class="date-time-inputs">
						<input
							type="date"
							id="date"
							bind:value={expenseDate}
							required
							disabled={isViewOnly}
							class:error={errors.date}
						/>
						<input
							type="time"
							id="time"
							bind:value={expenseTime}
							required
							disabled={isViewOnly}
							class:error={errors.time}
						/>
					</div>
					{#if errors.date}<span class="error-text">{errors.date}</span>{/if}
					{#if errors.time}<span class="error-text">{errors.time}</span>{/if}
				</div>
			</div>

			<!-- Paid by -->
			<div class="split-section">
				<div class="split-header">
					<div class="split-header-left">
						<h3>Paid by</h3>
						{#if payersDiff || errors.payers}
							<span class="hint warning"
								>{errors.payers || `${payersDiff?.text} ${payersDiff?.val}`}</span
							>
						{/if}
					</div>
					{#if !isViewOnly}
						<label class="ratio-toggle">
							<input
								type="checkbox"
								checked={payerUseRatios}
								onchange={(e) => handleUseRatiosToggle('payers', e.currentTarget.checked)}
							/>
							<span>Use ratios</span>
						</label>
					{/if}
				</div>
				<div class="share-list">
					{#each iterPayers as m (m.id)}
						{@const isIncluded = !!payerIncluded[m.id]}
						<div class="share-item" class:excluded={!isIncluded && !isViewOnly}>
							{#if !isViewOnly}
								<input type="checkbox" class="member-checkbox" bind:checked={payerIncluded[m.id]} />
							{/if}
							<div class="share-user">
								<span class="name">{getName(m)}</span>
								{#if m.id === $auth.user?.id}
									<div class="me-tag-wrapper"><span class="me-tag">You</span></div>
								{/if}
							</div>
							<div class="share-input-row no-wrap">
								{#if !isViewOnly}
									{#if payerUseRatios}
										<input
											type="number"
											class="ratio-input"
											bind:value={payerRatios[m.id]}
											disabled={!isIncluded}
											min="0"
											step="any"
										/>
										<span class="ratio-sep">×</span>
										<span class="amount-display" class:dimmed={!isIncluded}>
											{(payerAmounts[m.id] ?? 0).toFixed(2)}
										</span>
									{:else}
										<input
											type="number"
											step="0.01"
											class="amount-input"
											bind:value={payerAmounts[m.id]}
											disabled={!isIncluded}
										/>
									{/if}
								{:else}
									<span class="amount-display">{(payerAmounts[m.id] ?? 0).toFixed(2)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Split among -->
			<div class="split-section">
				<div class="split-header">
					<div class="split-header-left">
						<h3>Split among</h3>
						{#if sharesDiff || errors.shares}
							<span class="hint warning"
								>{errors.shares || `${sharesDiff?.text} ${sharesDiff?.val}`}</span
							>
						{/if}
					</div>
					{#if !isViewOnly}
						<label class="ratio-toggle">
							<input
								type="checkbox"
								checked={shareUseRatios}
								onchange={(e) => handleUseRatiosToggle('shares', e.currentTarget.checked)}
							/>
							<span>Use ratios</span>
						</label>
					{/if}
				</div>
				<div class="share-list">
					{#each iterShares as m (m.id)}
						{@const isIncluded = !!shareIncluded[m.id]}
						<div class="share-item" class:excluded={!isIncluded && !isViewOnly}>
							{#if !isViewOnly}
								<input type="checkbox" class="member-checkbox" bind:checked={shareIncluded[m.id]} />
							{/if}
							<div class="share-user">
								<span class="name">{getName(m)}</span>
								{#if m.id === $auth.user?.id}
									<div class="me-tag-wrapper"><span class="me-tag">You</span></div>
								{/if}
							</div>
							<div class="share-input-row no-wrap">
								{#if !isViewOnly}
									{#if shareUseRatios}
										<input
											type="number"
											class="ratio-input"
											bind:value={shareRatios[m.id]}
											disabled={!isIncluded}
											min="0"
											step="any"
										/>
										<span class="ratio-sep">×</span>
										<span class="amount-display" class:dimmed={!isIncluded}>
											{(shareAmounts[m.id] ?? 0).toFixed(2)}
										</span>
									{:else}
										<input
											type="number"
											step="0.01"
											class="amount-input"
											bind:value={shareAmounts[m.id]}
											disabled={!isIncluded}
										/>
									{/if}
								{:else}
									<span class="amount-display">{(shareAmounts[m.id] ?? 0).toFixed(2)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose}>Cancel</button>
				{#if isViewOnly}
					<button type="button" class="btn btn-primary" onclick={() => (isViewOnly = false)}
						>Edit</button
					>
				{:else}
					<button type="submit" class="btn btn-primary" disabled={loading}>
						{loading ? 'Saving...' : isEditing ? 'Update Expense' : 'Add Expense'}
					</button>
				{/if}
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
		max-width: 500px;
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
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #9ca3af;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input[type='text'],
	.form-group textarea {
		padding: 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		width: 100%;
		font-size: 1rem;
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
	}

	.form-group input:disabled,
	.form-group textarea:disabled {
		background: #f9fafb;
		color: #111827;
	}

	.mb-1 {
		margin-bottom: 1rem;
	}

	.input-with-currency.error {
		border-color: #ef4444;
	}

	.date-time-inputs {
		display: flex;
		gap: 0.5rem;
	}

	.date-time-inputs input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
	}

	.date-time-inputs input:disabled {
		background: #f9fafb;
		color: #111827;
	}

	.split-section {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 8px;
	}

	.split-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.split-header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.split-section h3 {
		margin: 0;
		font-size: 0.875rem;
		text-transform: uppercase;
		color: #6b7280;
		flex-shrink: 0;
	}

	.hint {
		font-size: 0.8rem;
		font-weight: 600;
	}

	.hint.warning {
		color: #ef4444;
	}

	.ratio-toggle {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: #4b5563;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.ratio-toggle input[type='checkbox'] {
		cursor: pointer;
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		accent-color: var(--primary-color);
	}

	.share-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.share-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.member-checkbox {
		width: 15px;
		height: 15px;
		cursor: pointer;
		flex-shrink: 0;
		accent-color: var(--primary-color);
	}

	.share-user {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		max-height: 1.5rem;
		overflow: hidden;
		font-size: 0.95rem;
		flex: 1;
		min-width: 0;
		line-height: 1.5rem;
		row-gap: 2rem;
	}

	.share-user .name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		flex: 0 1 auto;
	}

	.share-item.excluded .share-user .name {
		color: #9ca3af;
	}

	.me-tag-wrapper {
		margin-left: 0.4rem;
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		height: 1.5rem;
	}

	.share-input-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.ratio-input {
		width: 52px;
		padding: 0.25rem 0.4rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		text-align: right;
		flex-shrink: 0;
	}

	.ratio-input:disabled {
		background: #f3f4f6;
		color: #9ca3af;
		border-color: #e5e7eb;
	}

	.ratio-sep {
		color: #9ca3af;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.amount-display {
		font-weight: 600;
		color: #111827;
		font-size: 1rem;
		min-width: 52px;
		text-align: right;
	}

	.amount-display.dimmed {
		color: #9ca3af;
		font-weight: 400;
	}

	.amount-input {
		width: 80px;
		padding: 0.25rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		text-align: right;
		flex-shrink: 0;
	}

	.amount-input:disabled {
		background: #f3f4f6;
		color: #9ca3af;
		border-color: #e5e7eb;
	}

	.error-text {
		color: #ef4444;
		font-size: 0.75rem;
		margin-top: 0.25rem;
		display: block;
	}

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

	@media (max-width: 640px) {
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
