import { writable } from 'svelte/store';

/**
 * Reactive online/offline state.
 * Updated by window events AND by api.ts when a fetch TypeError is caught.
 */
export const isOnline = writable<boolean>(
	typeof navigator !== 'undefined' ? navigator.onLine : true
);

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => isOnline.set(true));
	window.addEventListener('offline', () => isOnline.set(false));
}

// Offline sync signal stores — defined here (not in offline.ts) so they survive
// Vite HMR reloads of offline.ts without creating fresh instances. All importers
// share the same store objects regardless of how many times offline.ts is re-evaluated.

/** Number of items currently in the offline queue. */
export const pendingCount = writable<number>(0);

/** True while a sync run is actively processing. */
export const syncing = writable<boolean>(false);

/** Increments each time a sync run completes; pages subscribe to trigger a server refetch. */
export const syncVersion = writable<number>(0);
