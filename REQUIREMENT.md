# Project Requirements

## Core Overview
Dutch is an alternative to Splitwise built with SvelteKit (Frontend), IndexedDB (Local Caching), and GraphQL (Backend).

## Active Implementation Phases

### Phase 1: Core Data & Settings
- [ ] **Currencies & IndexedDB:**
    - [ ] Install `idb` library.
    - [ ] Create `currencyStore` synced with IndexedDB.
    - [ ] **Sync Logic:** Fetch `currencies` on app load/login; Clear on logout.
- [ ] **Settings:**
    - [ ] Create `/settings` page.
    - [ ] Implement "Refresh Currencies" button (fetches latest from API).
    - [ ] Add entry point (Settings button) in Dashboard.

### Phase 2: Dashboard & Group Management
- [ ] **Group List:**
    - [ ] Fetch `groups` query.
    - [ ] Display groups as clickable cards navigating to `/groups/[id]`.
- [ ] **Group Creation:**
    - [ ] UI: Modal with "Group Name" input.
    - [ ] Action: `addGroup` mutation.
    - [ ] UX: Optimistic update or auto-refetch.
- [ ] **Global Dashboard Stats:**
    - [ ] Fetch expense summaries for *all* groups.
    - [ ] Aggregate "You Owe" and "You are Owed" by currency.
    - [ ] Display totals prominently on the dashboard.

### Phase 3: Group Details & Members
- [ ] **Layout Structure:**
    - [ ] Header: Group Name & **Fixed Balance Summary** (broken down by currency).
    - [ ] Navigation: Tabs for "Expenses" and "Members".
- [ ] **Member Management:**
    - [ ] Action: "Add Member" button opening a Modal.
    - [ ] Logic: `addMember` mutation with email input.
    - [ ] List: Show names, labeling the current user as "**You**".

### Phase 4: Expense Management (UX Focused)
- [ ] **Expense List:**
    - [ ] Display list (API returns pre-sorted DESC).
    - [ ] **Visuals:** Distinct styles for General Expenses vs. Settlements.
    - [ ] **Context:** Show "you lent" / "you borrowed" per item.
    - [ ] **Interactions:**
        - [ ] Click item -> Open Detail/Edit Modal.
        - [ ] Delete button (with confirmation).
- [ ] **Add/Edit Expense Modal:**
    - [ ] **Form Fields:**
        - [ ] **Amount:** Autofocus on open. **Important:** Send as `string` type to API.
        - [ ] **Date/Time:** Separate inputs. Default time to 00:00. Convert to UTC for API.
    - [ ] **Split Logic:**
        - [ ] **Quick Action:** Buttons next to each member to "Allocate Full Amount" (One-click set to 100%).
        - [ ] Default: Equal split.
        - [ ] Validation: Show specific "hint" (e.g., "Over by $0.05") if totals don't match.
        - [ ] "Split Equally" button to auto-fix.
    - [ ] **Edit Workflow:**
        - [ ] Open in **Read-Only** mode (Details View).
        - [ ] "Edit" button enables inputs.
        - [ ] Use `editExpense` mutation on save.
- [ ] **Settlement (Repayment):**
    - [ ] Modal for `addRepayment`.
    - [ ] Inputs: Amount, Currency, Date/Time, Debtor, Creditor.

## Backlog
- [ ] **Offline Mode:** Sync queue for mutations when offline.
- [ ] **Delete Group:** Backend support needed.
- [ ] **Expense Description:** Schema update needed for "Name/Description".

## Completed System Foundation
- [x] **Project Scaffolding:** SvelteKit + TypeScript.
- [x] **Authentication:** 
    - [x] JWT in `localStorage` via `auth` store.
    - [x] Login/Register pages & Auth Guards.
- [x] **Network Layer:** 
    - [x] GraphQL wrapper (`fetch`) with error/401 handling.
- [x] **UI Components:** 
    - [x] Toast Notification System.