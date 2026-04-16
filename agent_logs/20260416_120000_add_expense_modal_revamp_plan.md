# Plan: AddExpenseModal Split UI Revamp

**Date:** 2026-04-16  
**Task:** Revamp the Paid by / Split among sections with checkboxes, ratio inputs, and a use-ratios toggle.

---

## Inputs

- File: `src/lib/components/AddExpenseModal.svelte`
- Types: `src/lib/types.ts` (no changes needed)

## Constraints

- No new dependencies
- Svelte 5 runes only
- TypeScript strict mode — no `any`
- Must preserve view-only (isViewOnly) and edit modes
- Must still produce the same `payers`/`shares` arrays for the GraphQL mutation
- Rounding errors must be handled: total must always sum exactly

---

## Success Criteria

- [x] Checkboxes replace the 100%/split-equally buttons
- [x] "Paid by" defaults to only current user checked
- [x] "Split among" defaults to all members checked
- [x] Each row has a ratio input (default: 1), disabled/greyed for unchecked members
- [x] "Use ratios" toggle per section, enabled by default
- [x] Toggle ON: ratio inputs editable, amounts are read-only (auto-calculated)
- [x] Toggle OFF: ratio inputs greyed/disabled, amounts become manually editable inputs
- [x] Amounts are **never** editable while "Use ratios" is ON — user must uncheck the toggle first
- [x] Every checkbox tick/untick, ratio change, or toggle recalculates amounts
- [x] Rounding handled: totals sum exactly, extra pennies distributed randomly
- [x] View-only mode: checkboxes non-interactive, amounts displayed cleanly

---

## Technical Approach

### New State (replaces `payers` / `shares` arrays)

**Per section (payer & share):**

```typescript
// Included flags
let payerIncluded = $state<Record<string, boolean>>({});
let shareIncluded = $state<Record<string, boolean>>({});

// Ratios (always 1 by default, independent of toggle)
let payerRatios = $state<Record<string, number>>({});
let shareRatios = $state<Record<string, number>>({});

// Use-ratio toggle
let payerUseRatios = $state(true);
let shareUseRatios = $state(true);

// Computed amounts (strings for display/submit)
let payerAmounts = $state<Record<string, string>>({});
let shareAmounts = $state<Record<string, string>>({});
```

### Initialization

**New expense:**
- `payerIncluded`: only `$auth.user?.id` → true; rest → false
- `shareIncluded`: all → true
- `payerRatios` / `shareRatios`: all → 1
- `payerUseRatios` / `shareUseRatios`: true
- Initial `payerAmounts` / `shareAmounts`: auto-calculated on first render

**Editing existing expense:**
- `payerIncluded`: true if amount > 0 in expense.payers
- `shareIncluded`: true if amount > 0 in expense.shares
- `payerRatios` / `shareRatios`: all → 1 (can't reverse-engineer original ratios)
- `payerUseRatios` / `shareUseRatios`: **false** (existing expenses use manual amounts)
- `payerAmounts` / `shareAmounts`: from expense.payers / expense.shares

### Core Logic: `distributeByRatio`

```typescript
function distributeByRatio(
  totalStr: string,
  included: Record<string, string[]>,  // just the included userId list
  ratios: Record<string, number>
): Record<string, string>
```

1. Parse total as cents (integer)
2. Compute total ratio weight for included users
3. Each included user gets `floor(ratio/totalRatio * totalCents)` cents
4. Track remainder (`totalCents - sum`)
5. Shuffle indices randomly, distribute extra pennies one-by-one
6. Return as `Record<userId, "X.XX">`; excluded users get "0.00"

### Recalculation Triggers (`$effect`)

Two separate effects:

```typescript
$effect(() => {
  if (!payerUseRatios) return;
  const total = parseFloat(amount || '0');
  const includedIds = sortedMembers
    .filter(m => payerIncluded[m.id])
    .map(m => m.id);
  payerAmounts = distributeByRatio(total, includedIds, payerRatios);
});

$effect(() => {
  if (!shareUseRatios) return;
  const total = parseFloat(amount || '0');
  const includedIds = sortedMembers
    .filter(m => shareIncluded[m.id])
    .map(m => m.id);
  shareAmounts = distributeByRatio(total, includedIds, shareRatios);
});
```

Dependencies tracked: `payerUseRatios`, `payerIncluded`, `payerRatios`, `amount`

### Amount Manual Edit Handler

Amount inputs are only rendered when `useRatios` is **false** — no auto-toggle logic needed. The input simply binds directly:

```typescript
// In template (manual mode only, amounts rendered as <input>):
bind:value={payerAmounts[userId]}
// The input is not rendered at all when payerUseRatios is true.
```

No `handlePayerAmountChange` function required. The `$effect` that recalculates amounts only runs when `useRatios` is true, so manual edits to `payerAmounts` while the toggle is OFF are never overwritten.

### Main Amount Input Change

When total amount changes:
- If `payerUseRatios` is true → effect recalculates automatically (reads new `amount`)
- If `payerUseRatios` is false → only update single-payer shortcut: if exactly 1 included payer, set their amount to the new total

### Computed `payers` / `shares` arrays for Submit

```typescript
const payers = $derived(
  sortedMembers.map(m => ({
    userId: m.id,
    amount: payerAmounts[m.id] || '0.00'
  }))
);

const shares = $derived(
  sortedMembers.map(m => ({
    userId: m.id,
    amount: shareAmounts[m.id] || '0.00'
  }))
);
```

Existing `payersDiff` / `sharesDiff` / `filteredPayers` / `filteredShares` derived values remain with minor adjustments.

### Template Changes

**Each row in "Paid by":**
```
[checkbox] [name] [me-tag]         [ratio input]  [amount display/input]
```

- Checkbox: `bind:checked={payerIncluded[payer.userId]}`
- Ratio input: `bind:value={payerRatios[payer.userId]}`, disabled if `!payerIncluded[payer.userId] || !payerUseRatios`
- Amount: when `payerUseRatios` is true → `<span class="amount-display">` (read-only); when false → `<input type="number" bind:value={payerAmounts[m.id]}>` (editable, disabled if member excluded)

**Section header addition:**
```
<label class="ratio-toggle">
  <input type="checkbox" bind:checked={payerUseRatios} />
  Use ratios
</label>
```

**Remove:** 100% buttons, "Split equally" buttons

### View-Only Mode

- Checkboxes rendered as disabled
- Ratios hidden
- Amounts displayed as plain text
- Only members with amount > 0 shown (existing `filteredPayers`/`filteredShares` behavior)

---

## Files to Change

| File | Changes |
|------|---------|
| `src/lib/components/AddExpenseModal.svelte` | Major — script state refactor + template update |

## New Files

None.

---

## Tradeoffs / Assumptions

1. **Editing an existing expense** starts in manual mode (`useRatios = false`) — original ratios can't be reverse-engineered from saved amounts. Ratios reset to 1 for all included users.
2. Amounts are **only** editable when "Use ratios" is OFF — no auto-toggle on amount edit; the user must explicitly uncheck the toggle to enter manual mode.
3. When the ratio toggle is flipped back ON, it immediately recalculates from the current ratios (does not reset ratios to 1).
4. Both "Paid by" and "Split among" have independent ratio toggles.

---

## Future Work (out of scope)

- Per-expense currency conversion display
- Saving/restoring ratio presets across sessions
- Smart ratio suggestions (e.g., 2:1 based on history)
