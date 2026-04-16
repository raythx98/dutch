import { get } from 'svelte/store';
import { dbPromise } from './db';
import { isOnline, pendingCount, syncing, syncVersion } from './connectivity';
import { query } from './api';
import type { Expense, DashboardCacheEntry, GroupCacheEntry, OfflineQueueItem } from './types';

// Re-export so existing imports from '$lib/offline' continue to work.
export { pendingCount, syncing, syncVersion };

async function refreshPendingCount(): Promise<void> {
	try {
		if (!dbPromise) return;
		const db = await dbPromise;
		const count = await db.count('offline-queue');
		const prev = get(pendingCount);
		pendingCount.set(count);
		if (prev > 0 && count === 0) {
			syncVersion.update((v) => v + 1);
		}
	} catch (e) {
		console.error('refreshPendingCount failed:', e);
	}
}

// ---- Dashboard cache ----

/** Returns the cached dashboard entry, or undefined if nothing is cached. */
export async function getDashboardCache(): Promise<DashboardCacheEntry | undefined> {
	try {
		if (!dbPromise) return undefined;
		const db = await dbPromise;
		return db.get('dashboard-cache', 'dashboard');
	} catch (e) {
		console.error('getDashboardCache failed:', e);
		return undefined;
	}
}

/** Persists dashboard data to IndexedDB. */
export async function saveDashboardCache(data: DashboardCacheEntry['data']): Promise<void> {
	try {
		if (!dbPromise) return;
		const db = await dbPromise;
		await db.put('dashboard-cache', { data, cachedAt: Date.now() }, 'dashboard');
	} catch (e) {
		console.error('saveDashboardCache failed:', e);
	}
}

// ---- Group cache ----

/** Returns the cached group + expense summary, or undefined if nothing is cached. */
export async function getGroupCache(groupId: string): Promise<GroupCacheEntry | undefined> {
	try {
		if (!dbPromise) return undefined;
		const db = await dbPromise;
		return db.get('group-cache', groupId);
	} catch (e) {
		console.error('getGroupCache failed:', e);
		return undefined;
	}
}

/** Persists group data to IndexedDB. */
export async function saveGroupCache(
	groupId: string,
	data: GroupCacheEntry['data']
): Promise<void> {
	try {
		if (!dbPromise) return;
		const db = await dbPromise;
		await db.put('group-cache', { data, cachedAt: Date.now() }, groupId);
	} catch (e) {
		console.error('saveGroupCache failed:', e);
	}
}

/**
 * Prepends a new expense to the cached expense list for a group.
 * Used for optimistic offline adds.
 */
export async function addExpenseToGroupCache(groupId: string, expense: Expense): Promise<void> {
	try {
		const cached = await getGroupCache(groupId);
		if (!cached) return;
		cached.data.summary.expenses.unshift(expense);
		await saveGroupCache(groupId, cached.data);
	} catch (e) {
		console.error('addExpenseToGroupCache failed:', e);
	}
}

/**
 * Replaces an existing expense in the cache by id.
 * Used for optimistic offline edits.
 */
export async function updateExpenseInGroupCache(groupId: string, expense: Expense): Promise<void> {
	try {
		const cached = await getGroupCache(groupId);
		if (!cached) return;
		const expenses = cached.data.summary.expenses;
		const idx = expenses.findIndex((e) => e.id === expense.id);
		if (idx >= 0) {
			expenses[idx] = expense;
			await saveGroupCache(groupId, cached.data);
		}
	} catch (e) {
		console.error('updateExpenseInGroupCache failed:', e);
	}
}

// ---- Offline queue ----

/** Adds a mutation to the offline queue and refreshes the pending count. */
export async function enqueueOperation(item: Omit<OfflineQueueItem, 'id'>): Promise<void> {
	try {
		if (!dbPromise) return;
		const db = await dbPromise;

		if (item.operation === 'editExpense' && item.expenseId) {
			const all = await db.getAll('offline-queue');

			// If the edited expense is itself a pending add (id is still a tempId), update
			// the addExpense payload in-place — the expense doesn't exist on the server yet
			// so no editExpense mutation should ever fire for it.
			const pendingAdd = all.find(
				(q) => q.operation === 'addExpense' && q.tempId === item.expenseId
			);
			if (pendingAdd?.id !== undefined) {
				await db.put('offline-queue', { ...pendingAdd, payload: item.payload } as OfflineQueueItem);
				await refreshPendingCount();
				return;
			}

			// For edits of server-persisted expenses: replace any existing queued edit
			// (last write wins) so only one mutation fires per expense.
			const existing = all.find(
				(q) => q.operation === 'editExpense' && q.expenseId === item.expenseId
			);
			if (existing?.id !== undefined) {
				await db.put('offline-queue', { ...item, id: existing.id } as OfflineQueueItem);
				await refreshPendingCount();
				return;
			}
		}

		await db.add('offline-queue', item as OfflineQueueItem);
		await refreshPendingCount();
	} catch (e) {
		console.error('enqueueOperation failed:', e);
	}
}

/** Removes all queue items for a given expense (matched by tempId or expenseId). */
export async function removePendingOperation(expenseId: string): Promise<void> {
	try {
		if (!dbPromise) return;
		const db = await dbPromise;
		const all = await db.getAll('offline-queue');
		for (const item of all) {
			if (item.id === undefined) continue;
			if (item.tempId === expenseId || item.expenseId === expenseId) {
				await db.delete('offline-queue', item.id);
			}
		}
		await refreshPendingCount();
	} catch (e) {
		console.error('removePendingOperation failed:', e);
	}
}

// ---- Sync engine ----

/**
 * Processes all queued offline operations in insertion order.
 * Guaranteed single-execution via the Web Locks API — concurrent callers skip immediately.
 * Stops mid-queue if connectivity is lost.
 */
export async function syncQueue(): Promise<void> {
	if (!get(isOnline) || !dbPromise) return;

	const run = async () => {
		if (!get(isOnline) || !dbPromise) return;

		let db;
		try {
			db = await dbPromise;
		} catch (e) {
			console.error('syncQueue: failed to open DB:', e);
			return;
		}

		const items = await db.getAll('offline-queue');
		if (items.length === 0) return;

		syncing.set(true);

		for (const item of items) {
			if (!get(isOnline)) break;
			if (item.id === undefined) continue;

			if (item.operation === 'addExpense') {
				const result = await query<{ addExpense: { id: string } }>(
					`mutation AddExpense($groupId: ID!, $input: ExpenseInput!) {
						addExpense(groupId: $groupId, input: $input) { id }
					}`,
					{ groupId: item.groupId, input: item.payload as unknown as Record<string, unknown> }
				);

				if (result && item.tempId) {
					const realId = (result as { addExpense: { id: string } }).addExpense.id;
					const cached = await getGroupCache(item.groupId);
					if (cached) {
						const idx = cached.data.summary.expenses.findIndex((e) => e.id === item.tempId);
						if (idx >= 0) {
							cached.data.summary.expenses[idx] = {
								...cached.data.summary.expenses[idx],
								id: realId,
								pendingSync: false
							};
							await saveGroupCache(item.groupId, cached.data);
						}
					}
				}
			} else if (item.operation === 'editExpense') {
				const result = await query<{ editExpense: { id: string } }>(
					`mutation EditExpense($id: ID!, $input: ExpenseInput!) {
						editExpense(expenseId: $id, input: $input) { id }
					}`,
					{ id: item.expenseId, input: item.payload as unknown as Record<string, unknown> }
				);

				if (result && item.expenseId) {
					const cached = await getGroupCache(item.groupId);
					if (cached) {
						const idx = cached.data.summary.expenses.findIndex((e) => e.id === item.expenseId);
						if (idx >= 0) {
							cached.data.summary.expenses[idx] = {
								...cached.data.summary.expenses[idx],
								pendingSync: false
							};
							await saveGroupCache(item.groupId, cached.data);
						}
					}
				}
			}

			// Remove from queue regardless of server success/failure.
			try {
				await db.delete('offline-queue', item.id);
			} catch (e) {
				console.error('syncQueue: failed to delete item:', e);
			}

			// Throttle between operations to avoid rate limiting.
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		// Delay before final refresh so server state settles.
		await new Promise((resolve) => setTimeout(resolve, 1000));

		syncing.set(false);
		await refreshPendingCount();
	};

	// navigator.locks ensures only one sync runs at a time across all JS contexts
	// (including HMR-created duplicate module instances in dev). Callers queue up
	// behind any active sync rather than skipping — this ensures the online-restore
	// trigger never gets dropped if a startup sync holds the lock momentarily.
	if (typeof navigator !== 'undefined' && 'locks' in navigator) {
		await navigator.locks.request('dutch-sync-queue', async () => {
			await run();
		});
	} else {
		if (get(syncing)) return;
		await run();
	}
}

// ---- Auto-sync on connectivity restore ----

let prevOnline = get(isOnline);
isOnline.subscribe((online) => {
	if (!prevOnline && online) {
		syncQueue();
	}
	prevOnline = online;
});

/**
 * Call once on app startup (e.g. from +layout.svelte onMount).
 * Refreshes the pending count and triggers a sync if items are queued.
 */
export async function initOffline(): Promise<void> {
	await refreshPendingCount();
	await syncQueue();
}
