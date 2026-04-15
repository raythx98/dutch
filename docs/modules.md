# Modules

Per-file summaries — what each module owns and its public interface.

---

## `src/lib/api.ts`

GraphQL client wrapper. All backend communication goes through this module.

**Exports:**
- `query<T>(gql: string, variables?: Record<string, unknown>): Promise<T>` — sends a POST request to the GraphQL endpoint, attaches the Bearer token from the auth store, and throws a typed error on failure.

**Handles:** 401 (unauthorized), 429 (rate limited), GraphQL-level errors (error code `401`).

---

## `src/lib/auth.ts`

Authentication state store. Single source of truth for the logged-in user.

**Exports:**
- `auth` — Svelte writable store containing `{ token: string | null, user: User | null }`.
- Persists to `localStorage` under key `dutch_auth`.
- `logout()` — clears the store and localStorage entry.

---

## `src/lib/currency.ts`

Currency data fetching and caching.

**Exports:**
- `currencyStore` — Svelte writable store containing the list of available currencies.
- `loadCurrencies()` — fetches from the backend and caches in IndexedDB; returns from cache on subsequent calls.
- `guessUserCurrency()` — maps the browser's timezone/locale to a currency code using `currency-config.json`.

---

## `src/lib/toast.ts`

Toast notification system.

**Exports:**
- `toast` — Svelte writable store for the current toast message.
- `showToast(message: string, type: 'success' | 'error' | 'info')` — triggers a toast.

---

## `src/lib/types.ts`

All shared TypeScript interfaces. Define new types here — don't scatter them in component files.

**Key types:** `User`, `Group`, `Member`, `Expense`, `Share`, `Currency`, `Owe`.

---

## `src/lib/index.ts`

Barrel export for `src/lib/`. Import from `$lib` rather than individual files where possible.

---

## `src/lib/components/AddExpenseModal.svelte`

Modal for adding a new expense to a group. Supports multi-payer and multi-share splitting.

**Props:** `groupId`, `currencies`, `members`, `onClose`, `onSuccess`.

---

## `src/lib/components/AddMemberModal.svelte`

Modal for adding a member to a group by username.

**Props:** `groupId`, `onClose`, `onSuccess`.

---

## `src/lib/components/AddRepaymentModal.svelte`

Modal for recording a repayment between two members.

**Props:** `groupId`, `currencies`, `members`, `onClose`, `onSuccess`.

---

## `src/lib/components/DeleteExpenseModal.svelte`

Confirmation dialog for deleting an expense.

**Props:** `expenseId`, `onClose`, `onSuccess`.

---

## `src/lib/components/DeleteGroupModal.svelte`

Confirmation dialog for deleting a group.

**Props:** `groupId`, `onClose`, `onSuccess`.

---

## `src/lib/components/InviteModal.svelte`

Displays the group's invite link/code for sharing.

**Props:** `inviteToken`, `onClose`.

---

## `src/lib/components/LogoutModal.svelte`

Confirmation dialog for logout.

**Props:** `onClose`, `onConfirm`.

---

## `src/lib/components/Toast.svelte`

Renders the global toast notification. Consumed in `+layout.svelte`.

---

## `src/routes/+layout.svelte`

Root layout. Contains the auth guard — redirects unauthenticated users to `/login`. Renders the `Toast` component globally.

---

## `src/routes/+layout.ts`

Disables SSR globally (`export const ssr = false`). Required for static SPA deployment.

---

## `src/routes/dashboard/+page.svelte`

The main dashboard showing all groups the user belongs to.

---

## `src/routes/groups/[id]/+page.svelte`

Group detail page. Shows expenses, member balances, and settlement summary for a specific group.

---

## `src/routes/join/[code]/+page.svelte`

Public group preview page. Shown before a user joins via invite link.

---

## `src/routes/login/+page.svelte` / `register/+page.svelte`

Auth forms. On success, store the JWT and redirect to `/dashboard`.

---

## `src/routes/settings/+page.svelte`

User settings (currency preference, profile details).
