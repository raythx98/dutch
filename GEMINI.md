# Dutch Project Context

This file serves as a persistent brain for the Dutch project, documenting architecture, state management, and implementation patterns.

## Architecture Overview

Dutch is a modern SPA (Single Page Application) built as an alternative to Splitwise.

- **Frontend:** SvelteKit 2 (Svelte 5 Runes)
- **State Management:** Svelte Stores (legacy) + Svelte 5 Runes (modern)
- **API:** GraphQL (POST based)
- **Local Storage:** IndexedDB (for currency caching) and LocalStorage (for auth)
- **Deployment:** Static Site (GitHub Pages compatible)

## Implementation Details

### 1. Reactivity & State

- **Svelte 5 Runes:** Used within components for local state (`$state`, `$derived`, `$effect`).
- **Global Stores:** Global state like `auth`, `currencyStore`, and `toast` still use Svelte's `writable` stores for broad accessibility across the app.
- **SvelteMap:** Used in dashboard and modals for reactive collections that require fine-grained updates in Svelte 5.

### 2. Authentication Flow

- **Storage:** Persisted in `localStorage` under the key `dutch_auth`.
- **JWT:** Injected into GraphQL requests as a `Bearer` token via the `query` wrapper.
- **Auth Guard:** Managed in `src/routes/+layout.svelte`. Unauthenticated users are redirected to the login page (`/login`), while authenticated users are redirected away from login/register pages. Redirection logic explicitly accounts for the `base` path to support subfolder hosting.

### 3. Data & API

- **GraphQL Wrapper:** `src/lib/api.ts` provides a `query<T>` function that handles:
  - Token injection.
  - **401 (Unauthorized) Handling:** Detects both HTTP 401 status and GraphQL error codes (`extensions.code === 401`).
  - **Toast Suppression:** To prevent multiple "Session expired" or irrelevant errors (e.g., "Group not found") when a session ends, the wrapper checks the synchronous state of the `auth` store. If the token is already cleared, subsequent toasts are suppressed.
  - 429 (Rate limiting) toast warnings.
  - Global error reporting via toasts.
- **Currency Handling:**
    - Currencies are fetched from the API and cached in **IndexedDB** (`dutch-db`) to minimize network usage.
    - `currencyStore` is hydrated from IndexedDB on app load if the user is authenticated.
    - **Currency Guessing:** The app attempts to guess the user's preferred currency based on their timezone and locale using a mapping in `src/lib/currency-config.json`. This is used to pre-select currencies in expense modals.

### 4. Routing & Paths
- **Static Hosting:** The app uses `@sveltejs/adapter-static` with `ssr = false` and `prerender = false`.
- **Base Path:** Support for subdirectories (like GitHub Pages `/dutch/`) is handled via `$app/paths` and the `base` variable.
- **Join Flow:** The `join/[code]` route previews group details. If a user is already a member of the group, they are automatically redirected to the group's dashboard instead of showing the join preview.
- **Auth Guard:** Managed in `src/routes/+layout.svelte`. Unauthenticated users are redirected to the login page (`/login`), while authenticated users are redirected away from login/register pages. Logout explicitly clears auth state and redirects to the home/login page.

### 5. Design System & Styling
- **Global CSS:** `src/app.css` defines the core design system:
    - **Variables:** Defined in `:root` (e.g., `--primary-color: #2563eb`).
    - **Components:** Standardized classes for `.btn`, `.btn-primary`, `.btn-outline`, `.card`, and `.logo`.
    - **Layout:** Mobile-first approach with container queries (`@container`) used for adaptive balance rows.
- **Branding:** Consistent "Dutch." logo with a primary-colored dot.

## Coding Standards & Rules

- **Strict Type Safety:** Avoid `any`. All API responses and shared objects should have interfaces in `src/lib/types.ts`.
- **Component Keys:** Always use keys in `{#each}` blocks for stability (e.g., `{#each items as item (item.id)}`).
- **Standardized UI:** Use the global utility classes from `app.css` instead of writing local styles for buttons, cards, and inputs.
- **Runes First:** Prefer `$state` and `$derived` for all new component-level logic.
- **Async API:** Use the `query` utility for all backend interactions.
