# Decisions

Architecture decision records — why things are the way they are.

---

## ADR-001: Static SPA with SSR disabled

**Decision**: SSR is globally disabled in `+layout.ts` (`ssr = false`) and the app is deployed as a static SPA using `adapter-static`.

**Rationale**: The backend is a separate GraphQL service. All data is fetched client-side post-authentication. SSR would require the server to handle JWT auth, adding complexity without benefit. Static hosting (GitHub Pages) is free and simpler to operate.

**Tradeoff**: No server-side rendering means slower perceived initial load and no SEO for dynamic content. Acceptable for a private, auth-gated expense app.

---

## ADR-002: JWT in localStorage

**Decision**: The JWT access token is stored in `localStorage` under the key `dutch_auth`.

**Rationale**: SvelteKit SSR is disabled, so `httpOnly` cookies (which would be the more secure option) offer no meaningful advantage here. `localStorage` is simpler for a pure client-side SPA. The token is never sent to any server other than the intended backend.

**Tradeoff**: Susceptible to XSS attacks. Mitigated by the fact this is a personal tool with no third-party scripts.

---

## ADR-003: Custom GraphQL wrapper instead of a client library

**Decision**: A minimal `query<T>()` function in `src/lib/api.ts` handles all GraphQL calls instead of a dedicated library (e.g., Apollo Client, urql).

**Rationale**: The app's query patterns are simple POST requests. A library would add significant bundle size, a learning curve, and a caching layer that isn't needed (data is fetched fresh on navigation). The custom wrapper is ~50 lines and covers all required features: auth headers, 401 handling, typed responses.

**Tradeoff**: No normalized cache, no optimistic updates. Acceptable for this use case.

---

## ADR-004: Svelte 5 runes for component state

**Decision**: All component-level reactive state uses Svelte 5 runes (`$state`, `$derived`, `$effect`). Svelte stores are reserved for global/cross-component state.

**Rationale**: Runes are the idiomatic Svelte 5 pattern. They are more explicit than the old `$:` reactive declarations, easier to reason about, and align with the direction of the framework.

---

## ADR-005: IndexedDB for currency caching

**Decision**: The list of supported currencies is fetched from the backend once and cached in IndexedDB.

**Rationale**: The currency list changes infrequently. Re-fetching it on every page load adds latency. IndexedDB persists across sessions and supports structured data, making it ideal for this purpose.

**Tradeoff**: Stale data if currencies change on the backend. Mitigated by a cache invalidation strategy (fetch and update on each app start if stale).

---

## ADR-006: Modal pattern without a centralized modal manager

**Decision**: Modals are rendered inline within the parent component via conditional rendering (`{#if showModal}`). There is no global modal store or portal.

**Rationale**: The app has a small number of well-defined modals. A centralized modal manager would add complexity without benefit at this scale. Each modal is self-contained and receives `onClose`/`onSuccess` callbacks.

**Tradeoff**: Each page component is responsible for its own modal state. Acceptable given the limited number of modals.

---

## ADR-007: GitHub Pages subdir hosting via $app/paths

**Decision**: The app uses SvelteKit's `$app/paths` (`base`, `assets`) for all internal links to support deployment at a subpath (e.g., `/dutch/` on GitHub Pages).

**Rationale**: GitHub Pages project sites are served under a subpath by default. Hardcoding root-relative paths would break the deployment.
