# Offline Mode

**Date:** 2026-04-16 | **Status:** Implemented

---

## Design

**Constraints:** CSR-only SPA, no new dependencies, last-write-wins, Svelte 5 runes.

**Connectivity:** Two-signal — `window` `online`/`offline` events + `api.ts` request outcomes. `isOnline` store in `connectivity.ts`. `navigator.onLine` used (not `$isOnline`) as the page-level fetch guard so the page can make recovery requests even when `isOnline` is false.

**Cache:** `dutch-db` IndexedDB v2. Stale-while-revalidate: serve cache immediately, overwrite on network success, no TTL.

| Store             | Key           | Purpose                        |
| ----------------- | ------------- | ------------------------------ |
| `dashboard-cache` | `"dashboard"` | Groups + balance summaries     |
| `group-cache`     | groupId       | Group detail + expense summary |
| `offline-queue`   | auto-increment| Pending mutations              |

**Queue:** `OfflineQueueItem { id?, operation, groupId, payload, tempId?, createdAt }`. Add offline: `crypto.randomUUID()` tempId, optimistic cache entry with `pendingSync: true`. Edit coalescing:
1. Multiple `editExpense` for same server expense → replace in-place.
2. `editExpense` targeting a `tempId` → update `addExpense` payload instead (expense not on server yet; UUID would be rejected).

**Sync:** `syncQueue()` drains queue in insertion order. After `addExpense` success, replaces `tempId` with real ID in cache. Protected by `navigator.locks('dutch-sync-queue')` (no `ifAvailable` — callers queue up). Triggered by: `isOnline` false→true, `initOffline()` on layout mount, and page data-fetch on every load (covers re-login after interrupted sync).

**Signal stores** (`pendingCount`, `syncing`, `syncVersion`) declared in `connectivity.ts` — HMR singletons. `offline.ts` re-exports them. `syncing.set(false)` called before `refreshPendingCount()` so the `fetchData()` guard is clear when `syncVersion` triggers a refetch.

**UI:** Offline banner (`!$isOnline` on auth pages), pending icon on `pendingSync` rows with CSS tooltip, "All changes synced" toast in layout on `pendingCount` >0→0, manual sync in `/settings`.

---

## Bug Fixes

### B1 — Banner wording
"You're offline" → "Unable to reach servers" (server-down ≠ no internet). `+layout.svelte`

### B2 — Banner on public pages
Gate on `!publicPages.includes($page.url.pathname)`. `+layout.svelte`

### B3 — Stale notice persists on dashboard during balances fetch
`usingCachedData = false` moved to immediately after groups load, before balances fetch. `dashboard/+page.svelte`

### B4 — Dashboard stuck "Loading..." when API fails with no cache
Add `loading = false` to the early-return branch after network failure. `dashboard/+page.svelte`

### B5 — Create group silently fails offline
Check `$isOnline` at start of `handleCreateGroup`; show error toast if offline. `dashboard/+page.svelte`

### B6 — Save button hangs when server unreachable
Add 5 s `AbortController` timeout to `fetch()` in `query()`. `api.ts`

### B7 — DataCloneError saving dashboard cache
`$state` is a reactive proxy. Use `$state.snapshot(groups)` before IDB write. `dashboard/+page.svelte`

### B8 — DataCloneError saving group cache
`$props()` array lookups are reactive proxies. Manually copy needed fields into plain objects. `AddExpenseModal.svelte`

### B9 — Duplicate expenses after sync
Two causes: (1) HMR concurrent `syncQueue()` runs → fixed with `navigator.locks`; (2) merge logic combined tempId + realId entries → removed merge, guard `fetchData()` against server fetches while pending items exist. `offline.ts`, `groups/[id]/+page.svelte`

### B10 — Multiple "All changes synced" toasts
Toast moved from `syncQueue()` to `+layout.svelte` `$effect` watching `pendingCount` >0→0. `offline.ts`, `+layout.svelte`

### B11 — Pending badge disappears on reconnect before sync
`fetchData()` guard checks cache directly for `pendingSync: true` items; does not overwrite with server data while any are present. `groups/[id]/+page.svelte`

### B12 — Record disappears after sync until browser refresh
`syncing.set(false)` was after `refreshPendingCount()`. Swapped order so `fetchData()` guard is clear when `syncVersion` triggers. `offline.ts`

### B13 — Sync not triggered on reconnect
`{ ifAvailable: true }` silently dropped the reconnect trigger if startup sync held the lock. Removed — callers queue up. `offline.ts`

### B14 — Multiple offline edits don't apply latest change
Multiple `editExpense` items per expense. Coalesce: replace existing queued edit in-place. `offline.ts`

### B15 — Cannot delete a pending sync expense
`DeleteExpenseModal` sent `deleteExpense` with UUID tempId. Intercept in `handleDeleteExpense` — call `removePendingOperation` directly for `pendingSync` expenses. `offline.ts`, `groups/[id]/+page.svelte`

### B16 — Pending sync tooltip clipped by overflow ancestors
`overflow: hidden` on `.expense-list` and `.expense-info` clipped the CSS `::before` tooltip. Changed `.expense-info` to `overflow: visible`; removed `overflow: hidden` from list, applied `border-radius` to first/last items directly. `groups/[id]/+page.svelte`

### B17 — editExpense sent with UUID expenseId
Editing a pending-add offline enqueued `editExpense` with UUID as `expenseId`. Server expects integer. `enqueueOperation` now coalesces: if `expenseId` matches an `addExpense` `tempId`, update that payload in-place. `offline.ts`

### B18 — Post-sync UI doesn't update without browser refresh
HMR re-executes `offline.ts`, creating fresh store instances. Page subscribed to `syncVersion_B`; sync ran in instance A incrementing `syncVersion_A`. Moved `pendingCount`/`syncing`/`syncVersion` to `connectivity.ts` (HMR singleton). `connectivity.ts`, `offline.ts`

### B19 — Group page offline banner stuck after server recovers
`fetchData()` guarded on `!get(isOnline)` — prevented the recovery request that would restore `isOnline`. Changed to `!navigator.onLine`; added fire-and-forget probe when `hasPendingItems && navigator.onLine && !isOnline`. `groups/[id]/+page.svelte`

### B20 — Sync not resumed after re-login
`initOffline()` runs once on layout mount; re-login (SPA nav) doesn't remount layout. Dashboard and group pages now call `syncQueue()` at the start of each data-fetch. `dashboard/+page.svelte`, `groups/[id]/+page.svelte`

### B21 — Settings page offline banner unresponsive
Settings makes no API calls → `isOnline` never updated. Added unconditional probe on `onMount` and `$effect` probe when `$isOnline` is false. Also added "Sync Offline Data" section with pending count + Sync Now button. `settings/+page.svelte`
