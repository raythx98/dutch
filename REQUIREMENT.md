# Project Requirements

## Active Tasks

### Data & State Management
- [ ] **Currencies & IndexedDB:**
    - [ ] Install `idb` (lightweight wrapper) for IndexedDB interactions.
    - [ ] Create a `currencyStore` that syncs with IndexedDB.
    - [ ] On App Load (or Dashboard mount): Fetch `currencies` via GraphQL and update the store/IndexedDB.
    - [ ] 
    - [ ] On Logout: Clear the `currencies` store/IndexedDB to ensure a fresh state for the next user.

### Dashboard (Group Management)
- [ ] **Settings**
    - [ ] Add a settings button which navigates to a page with basic settings
    - [ ] There should be a button that allows to pull latest set of currencies and update IndexedDb
        - [ ] On success or failure should trigger the global toast
- [ ] **View Groups:**
    - [ ] Fetch `groups` query on mount.
    - [ ] Display groups as cards/list items showing the group name.
    - [ ] Clicking a group navigates to `/groups/[id]`.
- [ ] **Create Group:**
    - [ ] UI: Simple form (inline or modal) with a "Group Name" input.
    - [ ] Action: Call `addGroup` mutation.
    - [ ] UX: Optimistically update the list or refetch groups upon success.

### Group Detail Page (`/groups/[id]`)
- [ ] **Layout & State:**
    - [ ] Fetch `expenses(groupId)` summary on mount.
    - [ ] Store group context (members, current user ID) for easy access in sub-components.
- [ ] **Members Management:**
    - [ ] UI: List current members (names).
    - [ ] Action: "Add Member" input taking an email.
    - [ ] Mutation: Call `addMember`.
- [ ] **Expense List:**
    - [ ] Display `expenses` list, which is already sorted by expenseAt DESC (newest first).
    - [ ] Distinguish visually between 'generic' (Expense) and 'repayment' (Settlement).
    - [ ] Show key details: Amount, Currency, Payer(s), Description/Type.
    - [ ] Action: "Delete" button per item (calls `deleteExpense`).

### Expense Creation
- [ ] **Add Expense Form:**
    - [ ] Inputs: Amount, Currency (dropdown from store), Date, Split details.
    - [ ] Split Payer Logic: Default to simple "Equal Split" between all payers. Use 2d.p as the lowest precision which must sum up to the total amount. Randomize the people that pays more/less
      - [ ] User can override by keying in a custom amount
    - [ ] Split Share Logic: Default to simple "Equal Split" between all members. se 2d.p as the lowest precision which must sum up to the total amount. Randomize the people that pays more/less
      - [ ] User can override by keying in a custom amount
    - [ ] Mutation: Call `addExpense`.
- [ ] **Add Repayment Form:**
    - [ ] Inputs: Amount, Currency, Debtor (Who paid), Creditor (Who got paid).
    - [ ] Mutation: Call `addRepayment`.

## Backlog
- [ ] Offline functionality using IndexedDB
- [ ] Edit Expenses

## Completed
- [x] Initial Project Setup
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