# Modules

Per-file summaries — what each module owns and its public interface.

---

## `src/lib/api.ts`

`query<T>(gql, variables?)` — POST to GraphQL with 5 s AbortController timeout and Bearer token. Returns `null` on any failure. Handles: 401 (logout + redirect), 429 (toast), GQL error code 401, network errors (`isOnline.set(false)`), success (`isOnline.set(true)`).

---

## `src/lib/auth.ts`

`auth` store — `{ token, user }`. Persists to `localStorage` key `dutch_auth`. `logout()` clears both.

---

## `src/lib/connectivity.ts`

Connectivity state and offline sync signals. All stores here are HMR singletons (no user-code deps).

- `isOnline` — initialised from `navigator.onLine`; updated by window events and `api.ts`.
- `pendingCount` / `syncing` / `syncVersion` — offline engine signals; declared here so HMR reloads of `offline.ts` don't create fresh instances. Re-exported by `offline.ts`.

---

## `src/lib/offline.ts`

Core offline engine: IDB cache helpers, write queue, sync runner.

- `getDashboardCache()` / `saveDashboardCache(data)`
- `getGroupCache(id)` / `saveGroupCache(id, data)`
- `addExpenseToGroupCache(id, expense)` — optimistic prepend.
- `updateExpenseInGroupCache(id, expense)` — replace by id.
- `enqueueOperation(item)` — adds to `offline-queue`. Coalesces edits; handles `deleteExpense` cancellation of pending adds/edits (see architecture).
- `removePendingOperation(expenseId)` — removes queue items + cache entry; cancels pending changes.
- `syncQueue()` — drains queue; `navigator.locks('dutch-sync-queue')` for single execution.
- `initOffline()` — call once on layout mount; refreshes `pendingCount` and runs `syncQueue()`.

Re-exports: `pendingCount`, `syncing`, `syncVersion` (from `connectivity.ts`).

---

## `src/lib/db.ts`

Single shared IndexedDB connection (`dutch-db` v2). Stores: `currencies`, `dashboard-cache`, `group-cache`, `offline-queue`.

---

## `src/lib/currency.ts`

- `currencyStore` — list of available currencies.
- `loadCurrencies()` — fetch + IDB cache; subsequent calls return from cache.
- `guessUserCurrency()` — timezone → currency code via `currency-config.json`.

---

## `src/lib/toast.ts`

`toast` store + `showToast(message, type)`.

---

## `src/lib/types.ts`

All shared TypeScript interfaces. Key types: `User`, `Group`, `Expense` (`pendingSync?: boolean`, `conversionDetails?: ConversionDetails`), `Share`, `ConversionDetails`, `ExchangeRate`, `ExchangeRateSnapshot`, `ExpenseSummary`, `OfflineQueueItem`, `DashboardCacheEntry`, `GroupCacheEntry`. `OfflineOperation` = `'addExpense' | 'editExpense' | 'deleteExpense'`; `payload` is optional (not needed for `deleteExpense`).

---

## `src/lib/components/AddExpenseModal.svelte`

Add or edit expense. Multi-payer/share UI with checkbox + ratio inputs.

- Toggle "Use ratios": ON → amounts auto-calculated; OFF → manual.
- Defaults: only current user as payer, everyone in split, ratio 1, toggle ON.
- Edit mode: toggle starts OFF, amounts loaded from saved data.
- Toggling ON reverse-engineers integer ratios from current amounts (`reverseEngineerRatios`).
- Rounding: integer cents, remainder distributed randomly.
- Offline: queues `addExpense` or `editExpense` via `enqueueOperation`.

**Props:** `groupId`, `members`, `expense?`, `usedCurrencies?`, `onClose`, `onSuccess`.

---

## `src/lib/components/AddConversionModal.svelte`

Currency conversion modal. Pre-fills source currency and amount from the balance row. Fetches live exchange rates via `exchangeRates` query on mount and computes the cross-rate (`rates[target] / rates[source]`). Bidirectional editing: typing in the rate field recalculates the target amount and vice versa (implemented with `oninput` handlers, not `$effect`, to avoid reactive cycles). Shows "Updated Xh ago" metadata and a warning when a currency is absent from the API snapshot. Blocked when offline — handled by the parent before the modal opens.

**Props:** `groupId`, `creditorId`, `debtorId`, `sourceAmount`, `sourceCurrencyCode`, `usedCurrencies?`, `onClose`, `onSuccess`.

---

## `src/lib/components/AddMemberModal.svelte`

**Props:** `groupId`, `onClose`, `onSuccess`.

## `src/lib/components/AddRepaymentModal.svelte`

**Props:** `groupId`, `members`, `expense?`, `prefill?`, `usedCurrencies?`, `onClose`, `onSuccess`.

## `src/lib/components/DeleteExpenseModal.svelte`

**Props:** `expense`, `onClose`, `onSuccess`.

## `src/lib/components/DeleteGroupModal.svelte`

**Props:** `groupId`, `onClose`, `onSuccess`.

## `src/lib/components/InviteModal.svelte`

**Props:** `inviteToken`, `onClose`.

## `src/lib/components/LogoutModal.svelte`

**Props:** `onClose`, `onConfirm`.

## `src/lib/components/Toast.svelte`

Renders global toast. Consumed in `+layout.svelte`.

---

## `src/routes/+layout.svelte`

Auth guard (redirect to `/login` if no token). Renders `Toast`. Owns offline banner (`!$isOnline` on auth pages), "All changes synced" toast (`pendingCount` >0→0 transition). Calls `initOffline()` on mount.

## `src/routes/dashboard/+page.svelte`

Groups list. Calls `syncQueue()` on each data-fetch when online. Refresh button in header re-fetches and re-syncs unconditionally. Join Group guarded offline (toast error).

## `src/routes/groups/[id]/+page.svelte`

Group detail. Guards server fetch with `hasPendingItems` (cache check, not `pendingCount` store). Uses `navigator.onLine` (not `$isOnline`) for offline guard. Calls `syncQueue()` when pending items detected. Intercepts delete on `pendingSync` expenses via `removePendingOperation`. Add Member and Delete Group blocked offline (toast). Delete Expense offline queues `deleteExpense` and removes from cache optimistically. Refresh button in header. Conversion: "Convert" button per balance row opens `AddConversionModal` (blocked offline). Conversion expenses styled with an orange left border and amber icon; cannot be edited (toast). `GROUP_QUERY` includes `conversionDetails { sourceCurrency sourceAmount rate }`.

## `src/routes/settings/+page.svelte`

Currency refresh + "Sync Offline Data" (pending count + Sync Now button). Probes server on mount and via `$effect` when `$isOnline` is false to keep banner accurate. Sync Now always probes network before calling `syncQueue()`; enabled whenever `pendingCount > 0`.

## `src/service-worker.ts`

Precaches `build` (hashed chunks) and `files` (static assets) on install. Cache-first for build assets; network-first with cache fallback for navigation. Evicts old versioned caches on activate. Skips non-GET and cross-origin (API) requests.

## `src/hooks.client.ts`

`handleError` — catches stale-chunk import failures (`"Importing a module script failed"` etc.) after a deploy. Navigates to `pathname?_r=<timestamp>` (cache-bust) once per session (guarded by `sessionStorage`).

## `src/routes/login/+page.svelte` / `register/+page.svelte`

Auth forms → store JWT → redirect to `/dashboard`.

## `src/routes/join/[code]/+page.svelte`

Public group preview before joining.
