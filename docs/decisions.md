# Decisions

Architecture decision records — why things are the way they are.

---

## ADR-001: Static SPA, SSR disabled

SSR disabled (`+layout.ts`, `ssr = false`), deployed via `adapter-static`. All data is fetched client-side after auth. SSR would require server-side JWT handling with no benefit for a private, auth-gated app.

---

## ADR-002: JWT in localStorage

Token stored under `dutch_auth`. SSR is disabled so `httpOnly` cookies offer no security advantage. Token is only sent to the intended backend.

---

## ADR-003: Custom GraphQL wrapper

`query<T>()` in `api.ts` instead of Apollo/urql. Query patterns are simple POSTs; a library adds bundle size and a caching layer that isn't needed. The wrapper covers all requirements in ~50 lines.

---

## ADR-004: Svelte 5 runes for component state

`$state`, `$derived`, `$effect` for component-level state; Svelte stores for global/cross-component state. Runes are idiomatic Svelte 5.

---

## ADR-005: IndexedDB for currency caching

Currency list changes infrequently; re-fetching every load adds latency. IDB persists across sessions.

---

## ADR-006: Inline modals, no global modal manager

Modals rendered via `{#if showModal}` in parent components with `onClose`/`onSuccess` callbacks. The app has few, well-defined modals — a centralized manager adds complexity without benefit.

---

## ADR-007: Base path via $app/paths

All internal links use `$app/paths` `base` for GitHub Pages subdir hosting (`/dutch/`). Hard-coded root paths break the deployment.

---

## ADR-008: navigator.locks for sync exclusivity

`syncQueue()` acquires `navigator.locks('dutch-sync-queue')` without `ifAvailable`. HMR creates multiple `offline.ts` instances each subscribing to `isOnline`; without a cross-context lock a single online event fires concurrent mutations. Callers queue up (not skip) so the online-restore trigger is never dropped.

---

## ADR-009: Edit coalescing in the offline queue

`enqueueOperation` replaces an existing `editExpense` item for the same expense in-place. Multiple offline edits → only one mutation fires with the latest payload. Prevents stale data if intermediate mutations succeed but later ones fail.

---

## ADR-010: fetchData guards use cache directly, not pendingCount store

`fetchData()` checks `cache.expenses.some(e => e.pendingSync)` rather than `get(pendingCount) > 0`. Layout's `initOffline()` and the page's `onMount` run concurrently; `pendingCount` may be 0 when `fetchData()` first reads it, causing the server response to overwrite locally-pending expenses.

---

## ADR-011: syncing.set(false) before refreshPendingCount()

`syncing.set(false)` called before `refreshPendingCount()` (which increments `syncVersion`). `syncVersion` incrementing triggers `fetchData()` via `$effect`. If `syncing` is still `true` at that point, `fetchData()`'s guard blocks the server fetch.

---

## ADR-012: Signal stores in connectivity.ts, not offline.ts

`pendingCount`, `syncing`, `syncVersion` declared in `connectivity.ts` (re-exported by `offline.ts`). HMR re-executes `offline.ts` on any `api.ts` change, producing fresh store instances. A page subscribed to `syncVersion_B` won't see increments from `syncQueue()` running in instance A. `connectivity.ts` has no user-code deps and is never reloaded by HMR.

---

## ADR-013: Pages call syncQueue() on each data-fetch

Dashboard and group pages call `syncQueue()` at the start of each data-fetch when `isOnline && !syncing`. `initOffline()` runs once on layout mount and is not re-called after SPA re-login. Page-level triggers ensure sync resumes after a 401 interrupts a sync mid-run. Safe because `syncQueue()` no-ops on empty queue; `navigator.locks` prevents concurrency.

---

## ADR-014: group page uses navigator.onLine for fetch guard

`fetchData()` skips the server fetch on `!navigator.onLine`, not `!get(isOnline)`. `isOnline` is only restored by a successful `query()` call; using it as the guard prevents the page from ever making that call, leaving the offline banner stuck permanently after a server-down period.

---

## ADR-015: editExpense-of-pending-add coalesces into the addExpense payload

In `enqueueOperation`, when an `editExpense` `expenseId` matches a pending `addExpense` `tempId`, the `addExpense` payload is updated in-place — no `editExpense` item is added. The expense doesn't exist on the server yet; sending a UUID as `expenseId` would be rejected (server expects integer).

---

## ADR-016: Service worker for offline shell caching

Without a SW, Safari shows "page can't be displayed" for unvisited routes offline — the lazy-loaded route chunk was never fetched. The SW precaches all chunks on install so every route is available immediately. Also resolves stale-chunk errors after deploy (old SW serves old chunks correctly; new SW takes over cleanly on next tab open).

---

## ADR-017: deleteExpense cancels pending add rather than queuing a mutation

If a `deleteExpense` targets an expense whose `addExpense` is still queued (never synced), the net effect is "nothing happened". Cancelling the queued add avoids sending a delete mutation for an ID the server never created. Any queued `editExpense` for the same ID is also dropped.

---

## ADR-018: Sync Now probes network before calling syncQueue

`syncQueue()` early-returns when `isOnline` is false. `isOnline` is only updated by `query()` outcomes or browser events — neither fires reliably from the settings page. Probing explicitly in `handleSync` restores `isOnline` if the server is reachable, clears the offline banner, and allows the sync to proceed — all from one button click.

---

## ADR-019: Currency conversion blocked offline

Converting requires a live exchange-rate fetch from the backend and must atomically create two linked DB records — neither is replayable via the existing offline queue. `openConversion()` checks `get(isOnline)` at click time and shows a toast error if offline. Settle (repayment) continues to work offline unchanged.

---

## ADR-020: Bidirectional rate/amount editing uses oninput, not $effect

`AddConversionModal` lets the user edit either the exchange rate or the target amount, with the other field recalculating. Using `$effect` watching both would cause reactive cycles (writing `rate` triggers the `targetAmount` effect, which writes `targetAmount`, which triggers the `rate` effect…). Plain `oninput` handlers break the cycle cleanly.
