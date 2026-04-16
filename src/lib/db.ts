import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Currency, DashboardCacheEntry, GroupCacheEntry, OfflineQueueItem } from './types';

interface DutchDB extends DBSchema {
	currencies: {
		key: string;
		value: Currency & { sortOrder?: number };
	};
	'dashboard-cache': {
		key: string;
		value: DashboardCacheEntry;
	};
	'group-cache': {
		key: string;
		value: GroupCacheEntry;
	};
	'offline-queue': {
		key: number;
		value: OfflineQueueItem;
	};
}

export type { DutchDB, IDBPDatabase };

/**
 * Single shared IndexedDB connection for the whole app.
 * Version 2 adds dashboard-cache, group-cache, and offline-queue stores.
 */
export const dbPromise: Promise<IDBPDatabase<DutchDB>> | null =
	typeof window !== 'undefined'
		? openDB<DutchDB>('dutch-db', 2, {
				upgrade(db, oldVersion) {
					if (oldVersion < 1) {
						db.createObjectStore('currencies', { keyPath: 'id' });
					}
					if (oldVersion < 2) {
						db.createObjectStore('dashboard-cache');
						db.createObjectStore('group-cache');
						db.createObjectStore('offline-queue', { autoIncrement: true, keyPath: 'id' });
					}
				}
			})
		: null;
