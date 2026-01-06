import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	let count = 0;

	function add(message: string, type: ToastType = 'info', duration = 3000) {
		const id = count++;
		update((toasts) => [...toasts, { id, message, type }]);

		if (duration > 0) {
			setTimeout(() => {
				remove(id);
			}, duration);
		}
	}

	function remove(id: number) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		error: (m: string, d?: number) => add(m, 'error', d),
		success: (m: string, d?: number) => add(m, 'success', d),
		info: (m: string, d?: number) => add(m, 'info', d),
		remove
	};
}

export const toast = createToastStore();
