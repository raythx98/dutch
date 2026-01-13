# Project Requirements

## Core Overview
Dutch is an alternative to Splitwise built with SvelteKit (Frontend), IndexedDB (Local Caching), and GraphQL (Backend).

## Active Implementation Phases
### Phase 8: Mobile Responsiveness & Validations (Active)
- [ ] **Validations:**
    - [ ] **Login/Register:**
        - [ ] Email: required, valid email format, max 255 chars.
        - [ ] Password: required, min 6, max 30 chars.
    - [ ] **Register Only:**
        - [ ] Username: required, min 3, max 20 chars.
    - [ ] **Groups:**
        - [ ] Create Group Name: required, min 3, max 20 chars.
        - [ ] Join Token/Code: required, min 3, max 20 chars.
    - [ ] **Members:**
        - [ ] Add Member Email/Username: required, min 3, max 255 chars.
    - [ ] **Expenses/Settlements:**
        - [ ] Name: required, max 100 chars.
        - [ ] Description: optional, max 1000 chars.
        - [ ] Currency: required.
        - [ ] Amount: required, non-negative.
        - [ ] Breakdowns: must sum up to total amount.
        - [ ] Date: required, valid date.
        - [ ] Time: required, valid time.
- [ ] **Mobile Responsiveness:**
    - [ ] **Viewport Support:** Support down to 320px width.
    - [ ] **Modals:** Occupy max 90% vertically and horizontally on small screens.
    - [ ] **Typography:** Minimum 16px font size for all inputs/text to avoid iOS auto-zoom.
    - [ ] **Adaptive Layouts:**
        - [ ] Use hamburger menu or omit details beyond certain widths (Header in Dashboard/Group Details).
        - [ ] Expense/Settlement cards in Group Details: adaptive display.
        - [ ] Group Details Page: Owe/Owed can split into 2 rows, similar to dashboard.
    - [ ] **Screen Fitting:** Ensure all screens fit within the viewport (Fix Group Details page overflow).
- [ ] **Bug Fixes:**
    - [ ] **TypeScript Error:** Fix `Cannot find name 'fetchAndSyncCurrencies'` in `login/+page.svelte`.

## Backend Requirements (For BE Team)
- [ ] **Bug Fixes:**
    - **Owes Aggregation:** Fix bug where owing multiple people results in only one appearing in the summary.
    - **Ghost Debts:** Fix bug where cross-currency debts sometimes result in duplicate or reversed entries (e.g., showing both "You owe A $20" and "A owes You $20" incorrectly), this bug is non-deterministic (it happens on/off after refresh).
- [ ] **Logic Improvements:**
    - **Stable Sorting:** An expense happening at the exact same time should then by sorted based on insertion order (latest at the top), the insertion order must remain the same even when the expense is edited (which is a delete + insert in backend).
    - **Group Currencies:** Instead of tracking currency usage by user, API should return a sorted list of *used* currenciesf (DESC by num of usages) for the group to allow the FE to prioritize them in dropdowns.
    - **Rate Limiting:** Add rate limits to all endpoints.

## Backlog
- [ ] **Offline Mode:** Sync queue for mutations when offline.


## Completed System Foundation
- [x] **Project Scaffolding:** SvelteKit + TypeScript.
- [x] **Authentication:** 
    - [x] JWT in `localStorage` via `auth` store.
    - [x] Login/Register pages & Auth Guards.
- [x] **Network Layer:** 
    - [x] GraphQL wrapper (`fetch`) with error/401 handling.
- [x] **UI Components:** 
    - [x] Toast Notification System.
### Phase 1: Core Data & Settings
- [x] **Currencies & IndexedDB:**
    - [x] Install `idb` library.
    - [x] Create `currencyStore` synced with IndexedDB.
    - [x] **Sync Logic:** Fetch `currencies` on app load/login; Clear on logout.
- [x] **Settings:**
    - [x] Create `/settings` page.
    - [x] Implement "Refresh Currencies" button (fetches latest from API).
    - [x] Add entry point (Settings button) in Dashboard.

### Phase 2: Dashboard & Group Management
- [x] **Group List:**
    - [x] Fetch `groups` query.
    - [x] Display groups as clickable cards navigating to `/groups/[id]`.
- [x] **Group Creation:**
    - [x] UI: Modal with "Group Name" input.
    - [x] Action: `addGroup` mutation.
    - [x] UX: Optimistic update or auto-refetch.
- [x] **Global Dashboard Stats:**
    - [x] Fetch expense summaries for *all* groups.
    - [x] Aggregate "You Owe" and "You are Owed" by currency.
    - [x] Display totals prominently on the dashboard.

### Phase 3: Group Details & Members
- [x] **Layout Structure:**
    - [x] Header: Group Name & **Fixed Balance Summary** (broken down by currency).
    - [x] Navigation: Tabs for "Expenses" and "Members".
- [x] **Member Management:**
    - [x] Action: "Add Member" button opening a Modal.
    - [x] Logic: `addMember` mutation with identifier (email/username) input.
    - [x] List: Show names, labeling the current user as "**You**".

### Phase 4: Expense Management (UX Focused)
- [x] **Expense List:**
    - [x] Display list (API returns pre-sorted DESC).
    - [x] **Visuals:** Distinct styles for Generic Expenses vs. Repayments.
    - [x] **Context:** Show "you lent" / "you borrowed" per item.
    - [x] **Interactions:**
        - [x] Click item -> Open Detail/Edit Modal.
        - [x] Delete button (with confirmation).
- [x] **Add/Edit Expense Modal:**
    - [x] **Form Fields:**
        - [x] **Amount:** Autofocus on open. **Important:** Send as `string` type to API.
        - [x] **Date/Time:** Separate inputs. Default time to 00:00. Convert to UTC for API.
    - [x] **Split Logic:**
        - [x] **Quick Action:** Buttons next to each member to "Allocate Full Amount" (One-click set to 100%).
        - [x] Default: Equal split.
        - [x] Validation: Show specific "hint" (e.g., "Over by $0.05") if totals don't match.
        - [x] "Split Equally" button to auto-fix.
    - [x] **Edit Workflow:**
        - [x] Open in **Read-Only** mode (Details View).
        - [x] "Edit" button enables inputs.
        - [x] Use `editExpense` mutation on save.
- [x] **Repayment:**
    - [x] Modal for `addRepayment`.
    - [x] Inputs: Amount, Currency, Date/Time, Debtor, Creditor.

### Phase 5: Group Lifecycle & Invitations
- [x] **Enhanced Delete Group:**
    - [x] **UI:** Danger-themed button (Trash Icon) in Group Details header.
    - [x] **Confirmation Modal:** Lists current members with tag style, warns about permanent action.
    - [x] **Logic:** Calls `deleteGroup` mutation and redirects to Dashboard.
- [x] **Invite Link & Seamless Join:**
    - [x] **Generation:** "Share" button in Group Details header opens a modal showing the `inviteToken` and copy link/code options.
    - [x] **Link:** Generated absolute URL (`origin + /join/[inviteCode]`).
    - [x] **Join Logic (`/join/[inviteCode]`):**
        - [x] **If Unauthenticated:** Save `inviteCode` to `localStorage` and redirect to `/login`.
        - [x] **If Authenticated:**
            - Call `previewGroup(inviteCode)` to show confirmation with member tags.
            - Clicking "Join" calls `joinGroup` mutation.
            - Redirect to group and show success toast on completion.
    - [x] **Post-Auth Workflow:** Auto-redirects to `/join/[inviteCode]` after Login/Register if pending invite exists.
    - [x] **Dashboard:** Added "Join Group" button to manually enter code.

### Phase 6: Expense & Currency Polish
- [x] **Expense Metadata:**
    - [x] Updated `AddExpenseModal` and `AddRepaymentModal`:
        - [x] **Name (Compulsory):** Text input.
        - [x] **Description (Optional):** Textarea.
    - [x] **Repayment Logic:** Defaults `name` to "Repayment".
- [x] **Currency Ordering:**
    - [x] Trusts Backend order for the `currencies` query.
    - [x] **Refresh Trigger:** Syncs `currencyStore` from API after any successful expense mutation.

### Phase 7: Refinements & Fixes (Active)
- [x] **UI Standardization:**
    - [x] **Widths:** Standardize container width between Dashboard and Group Details (Target: 800px for better readability).
    - [x] **Empty States:** Dashboard should show descriptive text (e.g., "You're all settled up"), standardized with group details page instead of "$0.00" when balances are empty.
- [x] **Components:**
    - [x] **Delete Expense Modal:** Create `DeleteExpenseModal.svelte` to replace browser `confirm()`, this should follow existing style of deleteGroup modal.
- [x] **Logic & UX:**
    - [x] **Member Sorting:** Ensure "You" always appears at the top of member lists, in the following places
      - [x] Delete Group Modal
      - [x] Group Details Page, Members tab
      - [x] Add/View/Edit Expense modal
      - [x] Add/View/Edit Settlement modal, to/from dropdown list
    - [x] **Invite/Delete Group and Delete Expense Modal:** Reduce the big gap between header and next item
    - [x] **Smart Settlement:** Prefill `AddRepaymentModal` with the correct creditor/debtor and amount if a debt exists.
    - [x] **Join Logic:** Handle "Already Joined" scenarios gracefully by redirecting to the Group Details page.
    - [x] **Currency Sorting Bug:** Fix issue where refreshing the page resets the currency list order.
- [x] **Bug Fix::**
  - [x] **Add Settlement/Repayment debtor/creditor:** After adding a settlement/repayment, the resulting expense has the to/from in the reverse order