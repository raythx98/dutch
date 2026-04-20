import type { HandleClientError } from '@sveltejs/kit';

const RELOAD_KEY = 'dutch_chunk_reload';

export const handleError: HandleClientError = ({ error }) => {
	const message = error instanceof Error ? error.message : String(error);
	// Stale chunk after a new deploy — navigate with cache-bust param to force fresh HTML.
	// Guard flag prevents a loop if the reload itself still fails.
	if (
		message.includes('Importing a module script failed') ||
		message.includes('Failed to fetch dynamically imported module') ||
		message.includes('error loading dynamically imported module')
	) {
		if (!sessionStorage.getItem(RELOAD_KEY)) {
			sessionStorage.setItem(RELOAD_KEY, '1');
			window.location.href = window.location.pathname + '?_r=' + Date.now();
		}
	}
};
