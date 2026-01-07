# Project Requirements

## Core Overview
Dutch is an alternative to Splitwise built with SvelteKit (Frontend), IndexedDB (Local Caching), and GraphQL (Backend).

## Active Implementation Phases

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
    - [x] Logic: `addMember` mutation with email input.
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

## Backlog
- [ ] **Offline Mode:** Sync queue for mutations when offline.
- [ ] **Delete Group:** Backend support needed.
- [ ] **Expense Description:** Schema update needed for "Name/Description".
- [ ] **Invite Link:**
- [ ] **List of Currency:** Should push frequently used ones to the top

## Completed System Foundation
- [x] **Project Scaffolding:** SvelteKit + TypeScript.
- [x] **Authentication:** 
    - [x] JWT in `localStorage` via `auth` store.
    - [x] Login/Register pages & Auth Guards.
- [x] **Network Layer:** 
    - [x] GraphQL wrapper (`fetch`) with error/401 handling.
- [x] **UI Components:** 
    - [x] Toast Notification System.