# Gotchas

Traps, quirks, and things not to change without care.

---

## 401 comes as HTTP status AND as a GraphQL error

Handled centrally in `api.ts`. Do not add 401 handling in components.

---

## Toast suppression on auth logout

On 401-triggered logout, toasts are suppressed to avoid a duplicate "unauthorized" toast on the login page. Don't add toasts inside the 401 path in `api.ts`.

---

## Base path affects all internal navigation

Use `$app/paths` `base` for all programmatic navigation. Hard-coding `/` breaks GitHub Pages deployment.

---

## Currency auto-detection is timezone-based, not IP-based

`guessUserCurrency()` uses `Intl.DateTimeFormat().resolvedOptions().timeZone`. VPN users may get wrong defaults.

---

## auth store is the only source of JWT

Never read `dutch_auth` from `localStorage` directly — always use the `auth` store from `src/lib/auth.ts`.

---

## SvelteMap for reactive collections

Dashboard uses `SvelteMap` not `Map` for fine-grained reactivity on individual key mutations. Do not replace with plain `Map`.

---

## $state initialised from $effect causes first-render flicker

```typescript
// ✅ synchronous — no flicker
const _init = buildInitialSplit();
let payerIncluded = $state(_init.pInc);

// ❌ $effect fires after mount — first render sees empty {}
let payerIncluded = $state({});
$effect(() => {
	payerIncluded = buildInitialSplit().pInc;
});
```

Use `get(store)` from `svelte/store` when reading store values outside reactive context.

---

## Svelte 5 reactive proxies cannot be serialized to IndexedDB

`$state` values and `$props()` array lookups are reactive proxies — IDB's structured-clone throws `DataCloneError`. Use `$state.snapshot(value)` for `$state` variables; manually copy needed fields for `$props()` results.

---

## HMR creates multiple offline.ts instances; signal stores must be in connectivity.ts

HMR re-executes `offline.ts` on any `api.ts` change, producing fresh store instances. A page subscribed to `syncVersion_B` won't see increments from `syncQueue()` running in instance A — post-sync UI refresh silently fails. `pendingCount`, `syncing`, `syncVersion` live in `connectivity.ts` (no user-code deps, never HMR-reloaded) making them true singletons. `navigator.locks('dutch-sync-queue')` prevents concurrent mutation firing across instances. Never replace the lock with a module-level boolean.

---

## navigator.locks { ifAvailable: true } silently drops sync on reconnect

With `ifAvailable`, a busy lock causes the call to skip silently. The reconnect trigger is dropped if startup sync holds the lock. Always use the default queuing behaviour.

---

## pendingCount store races with fetchData on mount

`initOffline()` and `fetchData()` both run from `onMount` concurrently. `fetchData()` may read `pendingCount = 0` before `refreshPendingCount()` runs. Guard server fetches by checking `cache.expenses.some(e => e.pendingSync)` directly.

---

## Cancelling a pending edit removes the expense from the UI temporarily

`removePendingOperation` removes the cache entry. For pending edits (expense exists on server), it reappears on the next server fetch. Intentional — the UI reverts to server state.

---

## Editing a pending-add expense would send a UUID as expenseId

If a user adds offline then edits offline, `AddExpenseModal` enqueues `editExpense` with `expenseId = tempId (UUID)`. The server expects an integer. `enqueueOperation` coalesces this into the `addExpense` payload instead — never enqueue `editExpense` for an expense that hasn't synced yet.

---

## Pages without natural API calls must probe explicitly for connectivity

`isOnline` is only updated by `query()` outcomes. Pages that make no API calls (e.g. settings) must fire an unconditional probe on mount and a `$effect` probe when `$isOnline` is false — otherwise the offline banner never appears/disappears correctly.

---

## syncQueue not re-triggered after re-login (SPA navigation)

`initOffline()` runs once on layout mount; re-login via SPA navigation doesn't remount the layout. Dashboard and group pages call `syncQueue()` at the start of each data-fetch to cover this case.

---

## Stale-chunk errors after deploy (GitHub Pages)

After a new deploy, tabs with cached old HTML try to import old chunk hashes that no longer exist → `"Importing a module script failed"`. `window.location.reload()` re-serves cached HTML, causing an infinite loop. `hooks.client.ts` catches this, sets a `sessionStorage` guard, then navigates with `?_r=<timestamp>` to force a fresh HTML fetch.

---

## Safari shows "offline" for unvisited routes when actually offline

SvelteKit lazy-loads route JS chunks on first visit. Without a service worker, Safari hits the network for the chunk, fails offline, and shows its native offline page instead of a JS error. The service worker precaches all chunks on install — every route is available from first load.

---

## Conversion expenses cannot be edited

`openEditExpense` checks `expense.type === 'Conversion'` and shows a toast instead of opening `AddExpenseModal`. Editing is not supported — delete and re-create instead.

---

## Conversion source legs are hidden from the expense list but included in balance

The `Expenses` resolver returns all DB expense rows for balance calculation, then filters out source legs (type=Repayment, linked via the `conversions` table) from the display list. If you ever compute balance only from display-list expenses, source legs won't cancel the old-currency debt and balances will be wrong.

---

## Toggling "Use ratios" ON with stale manual amounts produces garbage ratios

If the user changes the total while ratio mode is OFF, manual amounts no longer sum to the new total. Calling `reverseEngineerRatios` on those stale amounts against the new total fails all scale checks and falls back to GCD, yielding huge ratios (e.g. 555:556). `handleUseRatiosToggle` guards against this by skipping reverse-engineering when `|sum(amounts) − total| ≥ 0.02` — existing ratios are kept and the `$effect` applies them to the new total instead.
