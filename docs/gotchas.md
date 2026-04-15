# Gotchas

Traps, quirks, and things not to change without care.

---

## Svelte 5 runes only work in `.svelte` and `.svelte.ts` files

`$state`, `$derived`, `$effect` etc. are compile-time macros. They will fail silently or throw if used in regular `.ts` files. Cross-component shared state must use Svelte `writable` stores (`src/lib/auth.ts`, `src/lib/toast.ts`).

---

## `{#each}` without keys causes diffing bugs

Always use keyed each blocks: `{#each items as item (item.id)}`. Without keys, Svelte reuses DOM nodes in-place during updates, which causes stale state in interactive components (especially modal trigger buttons inside lists).

---

## 401 comes as both HTTP status AND GraphQL error

The backend can return a 401 in two ways:
1. HTTP 401 status code.
2. HTTP 200 with a GraphQL error containing code `401`.

Both cases are handled in `src/lib/api.ts`. Do not add 401 handling in individual components — it is already centralized.

---

## Toast suppression on auth logout

When a 401 triggers an automatic logout + redirect to `/login`, the toast system is intentionally suppressed to prevent a duplicate "unauthorized" toast appearing on the login page after the redirect. Do not add toasts inside the 401 path in `api.ts`.

---

## Base path affects all internal navigation

The SvelteKit base path (set in `svelte.config.js`) prefixes all `href` attributes. Use `$app/paths`'s `base` variable for programmatic navigation and link construction. Hard-coding paths like `href="/"` will break on GitHub Pages.

---

## Currency auto-detection is timezone-based, not IP-based

`guessUserCurrency()` uses `Intl.DateTimeFormat().resolvedOptions().timeZone` mapped through `currency-config.json`. It does not do any IP geolocation. Users in unexpected timezones (e.g., VPN) may get a wrong default currency — the setting can be changed in `/settings`.

---

## auth store must be the only source of JWT

Never read the JWT from `localStorage` directly in components. Always use the `auth` store from `src/lib/auth.ts`. The store is initialized from `localStorage` on app start but components should not know about the storage mechanism.

---

## SvelteMap vs plain Map for reactive collections

Dashboard and group pages use `SvelteMap` (a reactive Map wrapper from Svelte 5) instead of plain `Map`. Using a plain `Map` with `$state` works for simple cases but `SvelteMap` ensures fine-grained reactivity for complex updates (individual key mutations). Do not replace `SvelteMap` with `Map` in the dashboard.

---

## Modal `onClose` must always be called on Escape

Modals handle the Escape key via `onkeydown` on the backdrop element. If you add a new modal, ensure the Escape key calls `onClose()`. Missing this creates a UX trap where the modal can't be closed with the keyboard.
