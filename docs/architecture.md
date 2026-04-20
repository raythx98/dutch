# Architecture

Dutch is a SvelteKit SPA (SSR disabled, `adapter-static`) for group expense management backed by a separate Go/GraphQL service (`go-dutch`).

## Layers

```
Routes  (src/routes/)          — pages and layouts
Components  (src/lib/components/) — modal components
Lib  (src/lib/)                — api · auth · currency · offline · toast · types
Backend (external)             — GraphQL API at /query
```

## Routes

| Route          | Auth | Purpose                      |
| -------------- | ---- | ---------------------------- |
| `/`            | No   | Landing                      |
| `/login`       | No   | Login form                   |
| `/register`    | No   | Registration form            |
| `/dashboard`   | Yes  | Groups list                  |
| `/groups/[id]` | Yes  | Group detail + expenses      |
| `/join/[code]` | No   | Group preview before joining |
| `/settings`    | Yes  | User settings + manual sync  |

Auth guard in `+layout.svelte` — unauthenticated users redirect to `/login`.

## Auth Flow

JWT returned on login → stored in `localStorage` (`dutch_auth`) → attached as `Bearer` on all requests → 401 (HTTP or GQL error code) → auto-logout + redirect.

## State Management

| State             | Location                  | Mechanism                                                            |
| ----------------- | ------------------------- | -------------------------------------------------------------------- |
| Auth token + user | `src/lib/auth.ts`         | Svelte store + localStorage                                          |
| Currency list     | `src/lib/currency.ts`     | Svelte store + IndexedDB                                             |
| Toast             | `src/lib/toast.ts`        | Svelte store                                                         |
| Connectivity/sync | `src/lib/connectivity.ts` | Svelte stores (`isOnline`, `pendingCount`, `syncing`, `syncVersion`) |
| Component state   | `.svelte` files           | Svelte 5 runes                                                       |

## Offline Mode

App-layer offline support backed by a Service Worker for shell caching.

### Service Worker (`src/service-worker.ts`)

Precaches all build chunks and static files on install. Serves hashed assets from cache (immutable); network-first with cache fallback for everything else. Old caches evicted on activate. Fixes: (1) unvisited routes fail to load offline, (2) stale-chunk errors after deploy.

### Connectivity Detection

`isOnline` store in `connectivity.ts`, initialised from `navigator.onLine`. Updated by:

1. `window` `online`/`offline` events.
2. `api.ts`: `TypeError`/timeout → `isOnline.set(false)`; successful response → `isOnline.set(true)`.

### Cache (dutch-db, IndexedDB v2)

| Store             | Key            | Purpose                        |
| ----------------- | -------------- | ------------------------------ |
| `currencies`      | id             | Currency list                  |
| `dashboard-cache` | `"dashboard"`  | Groups + balance summaries     |
| `group-cache`     | groupId        | Group detail + expense summary |
| `offline-queue`   | auto-increment | Pending mutations              |

Pages use stale-while-revalidate: serve cache immediately, then overwrite on network success.

### Write Queue & Sync

`enqueueOperation(item)` adds to `offline-queue` with three coalescing rules:

- Multiple `editExpense` for the same server expense → replace in-place (last write wins).
- `editExpense` whose `expenseId` matches a pending `addExpense` `tempId` → update the `addExpense` payload (expense doesn't exist on server yet; UUID `expenseId` would be rejected).
- `deleteExpense` targeting a pending `addExpense` tempId → cancels the add (expense never existed on server); any queued `editExpense` for the same ID is also removed.

`syncQueue()` drains the queue in insertion order via `query()`, updates cache with real IDs after `addExpense`. Protected by `navigator.locks('dutch-sync-queue')`. Triggered by:

- `isOnline` false→true subscription.
- `initOffline()` on layout mount.
- Dashboard and group page data-fetch on every load (covers re-login after interrupted sync).

### Sync Signals (all declared in `connectivity.ts` — HMR singleton)

| Store          | Purpose                                                 |
| -------------- | ------------------------------------------------------- |
| `pendingCount` | Queue depth; layout badge + "All changes synced" toast  |
| `syncing`      | True during active sync run                             |
| `syncVersion`  | Increments on sync complete; pages subscribe to refetch |

### UI

- **Offline banner** — fixed top bar on auth pages when `!$isOnline`.
- **Pending badge** — warning icon on `pendingSync: true` expense rows with CSS tooltip.
- **Sync toast** — "All changes synced" fires in layout when `pendingCount` transitions >0→0.
- **Refresh button** — header icon on dashboard and group pages; calls fetch + `syncQueue()` unconditionally, restoring `isOnline` if the server is reachable again.
- **Offline action guards** — Join Group, Add Member, Delete Group show a toast error and abort when offline. Delete Expense is available offline and queues a `deleteExpense` operation.
- **Settings Sync Now** — probes the network before calling `syncQueue()` so clicking always attempts connectivity restore. Button enabled whenever `pendingCount > 0`.

## Deployment

`adapter-static`, SSR disabled globally (`+layout.ts`), SPA fallback to `index.html`, base path via `$app/paths` for GitHub Pages subdir hosting.
