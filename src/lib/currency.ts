import { openDB, type DBSchema } from 'idb';
import { writable } from 'svelte/store';
import { query } from './api';

export interface Currency {
	id: string;
	code: string;
	name: string;
	symbol: string;
	sortOrder?: number;
}

interface DutchDB extends DBSchema {
	currencies: {
		key: string;
		value: Currency;
	};
}

const DB_NAME = 'dutch-db';
const STORE_NAME = 'currencies';

const dbPromise = typeof window !== 'undefined'
	? openDB<DutchDB>(DB_NAME, 1, {
			upgrade(db) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		})
	: null;

export const currencyStore = writable<Currency[]>([]);

export async function fetchAndSyncCurrencies() {
	const data = await query<{ currencies: Currency[] }>(`
		query GetCurrencies {
			currencies {
				id
				code
				name
				symbol
			}
		}
	`);

	if (data?.currencies) {
		await saveCurrenciesToDB(data.currencies);
		currencyStore.set(data.currencies);
		return true;
	}
	console.warn('No currencies returned from API');
	return false;
}

async function saveCurrenciesToDB(currencies: Currency[]) {
	if (!dbPromise) return;
	const db = await dbPromise;
	const tx = db.transaction(STORE_NAME, 'readwrite');
	const store = tx.objectStore(STORE_NAME);
	await store.clear();
	for (let i = 0; i < currencies.length; i++) {
		await store.put({ ...currencies[i], sortOrder: i });
	}
	await tx.done;
}

export async function loadCurrenciesFromDB() {
	if (!dbPromise) return;
	const db = await dbPromise;
	const allCurrencies = await db.getAll(STORE_NAME);
	
	if (allCurrencies.length > 0) {
		allCurrencies.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
		currencyStore.set(allCurrencies);
	}
}

export async function clearCurrencies() {
	currencyStore.set([]);
	if (!dbPromise) return;
	const db = await dbPromise;
	const tx = db.transaction(STORE_NAME, 'readwrite');
	await tx.objectStore(STORE_NAME).clear();
	await tx.done;
}