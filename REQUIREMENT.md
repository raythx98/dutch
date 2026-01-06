# Project Requirements

## Active Tasks

- [ ] **Backlog Tasks:**
  - [ ] Offline functionality using IndexedDB
  - [ ] Dashboard Building
  - [ ] Groups, Expenses, Members

## Completed

- [x] **Routing & Guards:**
  - [x] Redirect `/` to `/dashboard`.
  - [x] Implement client-side Auth Guard: Redirect to `/login` if not authenticated (except for `/register`).
  - [x] Redirect to `/dashboard` if already authenticated and trying to access `/login` or `/register`.
- [x] **Auth Storage:**
  - [x] Implement a Svelte store (`auth`) that persists the JWT to `localStorage`.
  - [x] Provide `login`, `logout`, and `register` methods.
- [x] **GraphQL API Client:**
  - [x] Create a lightweight fetch wrapper for `http://localhost:8080/query`.
  - [x] Auto-inject `Authorization: Bearer <token>` header if token exists.
  - [x] Global `401 Unauthorized` handling: Clear store and redirect to `/login`.
  - [x] Standardized error handling: Capture and return GraphQL `errors` array messages.
- [x] **Pages:**
  - [x] `login`: Email/Password form.
  - [x] `register`: Username/Email/Password form with FE validation and inline errors.
  - [x] `dashboard`: Placeholder page accessible only when logged in.
- [x] **UI/UX:**
  - [x] Implement inline error message for FE validation errors.
  - [x] Implement a simple global error notification system (transient toast).
- [x] Initial Project Setup
