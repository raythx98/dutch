# Architecture

## Overview

Dutch is a SvelteKit single-page application (SPA) for group expense management — a Splitwise alternative. It connects to a separate Go/GraphQL backend (`go-dutch`). The frontend is fully static (SSR disabled, `adapter-static`) and can be hosted on GitHub Pages or any static host.

## Layer Structure

```
┌─────────────────────────────────────────────────────────┐
│  Routes  (src/routes/)                                   │
│  SvelteKit file-based routing — pages and layouts       │
├─────────────────────────────────────────────────────────┤
│  Components  (src/lib/components/)                       │
│  Modal components for expenses, members, groups         │
├─────────────────────────────────────────────────────────┤
│  Lib  (src/lib/)                                         │
│  api · auth · currency · toast · types                  │
├─────────────────────────────────────────────────────────┤
│  Backend (external — go-dutch)                           │
│  GraphQL API at /query                                  │
└─────────────────────────────────────────────────────────┘
```

## Routing

SvelteKit file-based routing under `src/routes/`:

| Route          | Purpose                      | Auth Required |
| -------------- | ---------------------------- | ------------- |
| `/`            | Landing page                 | No            |
| `/login`       | Login form                   | No            |
| `/register`    | Registration form            | No            |
| `/dashboard`   | User's groups list           | Yes           |
| `/groups/[id]` | Group detail with expenses   | Yes           |
| `/join/[code]` | Preview group before joining | No            |
| `/settings`    | User settings                | Yes           |

Auth guard is enforced in `src/routes/+layout.svelte` — unauthenticated users are redirected to `/login`.

## Authentication Flow

```
1. User logs in → POST to /mutation (login GraphQL)
2. Backend returns JWT access token
3. Token stored in localStorage under key: dutch_auth
4. All subsequent GraphQL requests: Authorization: Bearer <token>
5. On 401 (HTTP or GQL error code) → auto-redirect to /login
6. On logout → clear localStorage entry
```

The auth store (`src/lib/auth.ts`) wraps a Svelte writable store with localStorage persistence. It is the single source of truth for the current user's token and identity.

## Data Flow

```
Svelte Component
  │
  ├── calls query<T>(gql, variables) from src/lib/api.ts
  │     │
  │     ├── reads token from auth store
  │     ├── POST to GraphQL endpoint
  │     └── returns typed response or throws
  │
  ├── updates local $state (Svelte 5 runes)
  └── shows toast on error via toast store
```

## State Management

| State                 | Where                  | Mechanism                             |
| --------------------- | ---------------------- | ------------------------------------- |
| Auth token + user     | `src/lib/auth.ts`      | Svelte writable store + localStorage  |
| Currency list         | `src/lib/currency.ts`  | Svelte writable store + IndexedDB     |
| Toast notifications   | `src/lib/toast.ts`     | Svelte writable store                 |
| Component-level state | Inside `.svelte` files | Svelte 5 runes (`$state`, `$derived`) |

## Currency System

Currencies are fetched from the backend on first load and cached in **IndexedDB** for offline-first read access. Auto-detection of the user's preferred currency uses a timezone-to-currency mapping in `src/lib/currency-config.json`.

## Static Deployment

- Adapter: `@sveltejs/adapter-static`
- SSR is disabled globally in `src/routes/+layout.ts` (`ssr = false`)
- SPA routing: all paths fall back to `index.html`
- GitHub Pages subdir hosting: base path managed via `$app/paths`
