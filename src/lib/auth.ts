import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface AuthState {
	token: string | null;
	user: { id: string; name: string } | null;
}

const STORAGE_KEY = 'dutch_auth';

function getInitialState(): AuthState {
	if (!browser) return { token: null, user: null };
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			return JSON.parse(stored);
		} catch (e) {
			console.error('Failed to parse auth from localStorage', e);
		}
	}
	return { token: null, user: null };
}

function createAuthStore() {
	const { subscribe, set } = writable<AuthState>(getInitialState());

	return {
		subscribe,
		login: (token: string, user: { id: string; name: string }) => {
			const state = { token, user };
			if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			set(state);
		},
		logout: () => {
			if (browser) localStorage.removeItem(STORAGE_KEY);
			set({ token: null, user: null });
		}
	};
}

export const auth = createAuthStore();
