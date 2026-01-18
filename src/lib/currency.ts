import { openDB, type DBSchema } from 'idb';
import { writable } from 'svelte/store';
import { query } from './api';
import type { Currency } from './types';
import currencyConfig from './currency-config.json';

interface DutchDB extends DBSchema {
	currencies: {
		key: string;
		value: Currency;
	};
}

const DB_NAME = 'dutch-db';
const STORE_NAME = 'currencies';

const dbPromise =
	typeof window !== 'undefined'
		? openDB<DutchDB>(DB_NAME, 1, {
				upgrade(db) {
					db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				}
			})
		: null;

export const currencyStore = writable<Currency[]>([]);

const GUESSED_CURRENCY_KEY = 'dutch_guessed_currency';
export const guessedCurrencyCode = writable<string | null>(
	typeof window !== 'undefined' ? localStorage.getItem(GUESSED_CURRENCY_KEY) : null
);

if (typeof window !== 'undefined') {
	guessedCurrencyCode.subscribe((val) => {
		if (val) localStorage.setItem(GUESSED_CURRENCY_KEY, val);
		else localStorage.removeItem(GUESSED_CURRENCY_KEY);
	});
}

export async function fetchAndSyncCurrencies() {
	// Log the guess immediately when sync starts
	getCurrencyByLocation();

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

export function getCurrencyByLocation(): string | null {
	if (typeof window === 'undefined' || !window.navigator) return null;

	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
	const locales = window.navigator.languages || [window.navigator.language];

	// 1. Try Timezone (more specific)
	for (const entry of currencyConfig) {
		if (entry.tz && tz.includes(entry.tz)) {
			console.log(`[Currency] Guess: ${entry.code} (Matched TZ: ${tz})`);
			guessedCurrencyCode.set(entry.code);
			return entry.code;
		}
	}

	// 2. Try Locale
	let country = '';
	for (const loc of locales) {
		const parts = loc.split('-');
		if (parts.length > 1) {
			country = parts.pop()!.toUpperCase();
			break;
		}
	}

	if (!country && locales[0]) {
		try {
			// @ts-ignore
			const maximized = new Intl.Locale(locales[0]).maximize();
			country = maximized.region || '';
		} catch (e) {
			/* ignore */
		}
	}

	if (country) {
		for (const entry of currencyConfig) {
			if (entry.locale === country) {
				console.log(`[Currency] Guess: ${entry.code} (Matched Locale: ${country})`);
				guessedCurrencyCode.set(entry.code);
				return entry.code;
			}
		}
	}

	console.log(`[Currency] No match found. (TZ: ${tz}, Locale: ${locales.join(', ')})`);
	guessedCurrencyCode.set(null);
	return null;
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
