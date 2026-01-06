# Project Requirements

## Active Tasks
- [ ] **Routing & Guards:**
    - [ ] Redirect `/` to `/dashboard`.
    - [ ] Implement client-side Auth Guard: Redirect to `/login` if not authenticated (except for `/register`).
    - [ ] Redirect to `/dashboard` if already authenticated and trying to access `/login` or `/register`.
- [ ] **Auth Storage:**
    - [ ] Implement a Svelte store (`auth`) that persists the JWT to `localStorage`.
    - [ ] Provide `login`, `logout`, and `register` methods within the store or as helpers.
- [ ] **GraphQL API Client:**
    - [ ] Create a lightweight fetch wrapper for `http://localhost:8080/query`.
    - [ ] Auto-inject `Authorization: Bearer <token>` header if token exists.
    - [ ] Global `401 Unauthorized` handling: Clear store and redirect to `/login`.
    - [ ] Standardized error handling: Capture and return GraphQL `errors` array messages.
- [ ] **Pages:**
    - [ ] `login`: Email/Password form
    - [ ] `register`: Username/Email/Password form with validation and error display.
        - Validation for username length (3-20)
        - Validation for password length (6-24)
        - Validation for email validity and length (max 255)
    - [ ] `dashboard`: Placeholder page accessible only when logged in.
- [ ] **UI/UX:**
    - [ ] Implement inline error message for FE validation errors
    - [ ] Implement a simple global error notification system (transient toast).

## Backlog
- [ ] Offline functionality using IndexedDB
- [ ] Dashboard Building
- [ ] Groups, Expenses, Members

## Completed
- [x] Initial Project Setup