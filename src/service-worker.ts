/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `dutch-${version}`;

// All app shell assets — hashed chunks + static files
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	async function precache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	(event as ExtendableEvent).waitUntil(precache());
});

self.addEventListener('activate', (event) => {
	async function evictOldCaches() {
		const keys = await caches.keys();
		await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
		// Take control of uncontrolled clients immediately on first install
		await (self as ServiceWorkerGlobalScope).clients.claim();
	}
	(event as ExtendableEvent).waitUntil(evictOldCaches());
});

self.addEventListener('fetch', (event) => {
	const req = (event as FetchEvent).request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);

	// Never intercept API requests — always go straight to the network
	if (url.hostname !== self.location.hostname) return;

	async function respond(): Promise<Response> {
		const cache = await caches.open(CACHE);

		// Hashed build assets are immutable — serve from cache immediately
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(req);
			if (cached) return cached;
		}

		// Everything else: try network first, fall back to cache
		try {
			const response = await fetch(req);
			if (response.ok) {
				cache.put(req, response.clone());
			}
			return response;
		} catch {
			const cached = await cache.match(req);
			if (cached) return cached;
			return new Response('Offline', { status: 503 });
		}
	}

	(event as FetchEvent).respondWith(respond());
});
