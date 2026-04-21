# Currency Exchange Feature Plan

**Date:** 2026-04-21  
**Feature:** Currency Convert — convert a balance from one currency to another using live market rates

---

## Inputs

- Frontend repo: `/Users/raytoh/code/js/dutch`
- Backend repo: `/Users/raytoh/code/go/src/github.com/raythx98/go-dutch`
- Exchange rate API: `https://v6.exchangerate-api.com/v6/{API_KEY}/latest/USD` (standard request)
- API key stored in env var (no preferred name)

## Constraints

- Max ~1,500 API calls/month → call API at most once per day; cache result in DB
- Only fetch necessary currencies (the 31 already in the app)
- If API call fails (rate limit / network error), silently fall back to previous day's values
- Do not install new npm or Go dependencies without approval
- Follow existing code style: Svelte 5 runes, TypeScript strict, `$lib` aliases, `query<T>()` wrapper

## Success Criteria

- "Convert" button appears next to "Settle" on every balance row
- Clicking it opens `AddConversionModal` with source prefilled and target defaulting to top suggested currency
- Market exchange rate is auto-populated; user can edit rate or target amount (bidirectional)
- Conversion creates an amber-styled expense in the list; source + target balances update correctly
- Deleting a Conversion expense undoes both legs
- Conversion is blocked offline with a toast message

---

## Architecture Decision

A conversion creates **two linked expense records** atomically:

| Leg    | type           | currency        | payer    | share  | amount        | Visible in list? |
| ------ | -------------- | --------------- | -------- | ------ | ------------- | ---------------- |
| Source | Repayment (1)  | source_currency | creditor | debtor | source_amount | No (hidden)      |
| Target | Conversion (2) | target_currency | creditor | debtor | target_amount | Yes (amber)      |

The two legs are linked via a new `conversions` table. The existing balance algorithm (sum payer/share amounts per currency per user) handles both legs correctly with no changes.

**Offline behaviour:** Block. Conversion opens a modal that fetches rates from backend (fails offline), and creates two atomically linked records that the offline queue cannot represent.

---

## files_to_change

### Backend (`/Users/raytoh/code/go/src/github.com/raythx98/go-dutch`)

| File                                         | Action                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `migrations/000004_add_conversions.up.sql`   | New — `exchange_rate_snapshots` + `conversions` tables                                                      |
| `migrations/000004_add_conversions.down.sql` | New — drop both tables                                                                                      |
| `sqlc/query.sql`                             | Add 9 new queries                                                                                           |
| `tools/config/config.go`                     | Add `ExchangeRateApiKey` field                                                                              |
| `tools/resources/resources.go`               | Expose key on `Tools` struct                                                                                |
| `tools/exchangerate/service.go`              | **New** — fetch/cache service with distributed lock                                                         |
| `graphql/resolver.go`                        | Add `ExchangeRateSvc` field + wire in `NewResolver`                                                         |
| `graphql/expensetype.go`                     | Add `ExpenseTypeConversion = 2`                                                                             |
| `graphql/schema/types.graphqls`              | Add `ConversionDetails`, `ExchangeRate`, `ExchangeRateSnapshot` types; add `conversionDetails` to `Expense` |
| `graphql/schema/inputs.graphqls`             | Add `ConversionInput`                                                                                       |
| `graphql/schema/endpoint.graphqls`           | Add `addConversion` mutation + `exchangeRates` query                                                        |
| `graphql/endpoint.resolvers.go`              | Add `AddConversion`, `ExchangeRates`; modify `DeleteExpense`, `Expenses`                                    |

### Frontend (`/Users/raytoh/code/js/dutch`)

| File                                           | Action                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/lib/types.ts`                             | Add `ConversionDetails`, `ConversionInput`, `ExchangeRate`, `ExchangeRateSnapshot`; extend `Expense` |
| `src/lib/components/AddConversionModal.svelte` | **New** — conversion modal                                                                           |
| `src/routes/groups/[id]/+page.svelte`          | Add Convert button, amber styling, modal wiring, update `GROUP_QUERY`                                |

## new_files

- `migrations/000004_add_conversions.up.sql`
- `migrations/000004_add_conversions.down.sql`
- `tools/exchangerate/service.go`
- `src/lib/components/AddConversionModal.svelte`

---

## Technical Approach

### 1. Database Migration (`000004`)

Follow existing conventions: lowercase identifiers, `timestamp default timezone('UTC', now())`, named `fk_` constraints.

```sql
create table if not exists exchange_rate_snapshots
(
    id                 bigserial primary key,
    base_currency_code varchar(3)                               not null,
    rates              jsonb                                    not null,
    fetched_at         timestamp default timezone('UTC', now()) not null,
    unique (base_currency_code)
);

create table if not exists conversions
(
    id                bigserial primary key,
    source_expense_id bigint                                   not null,
    target_expense_id bigint                                   not null,
    rate              decimal(20, 6)                           not null,
    created_at        timestamp default timezone('UTC', now()) not null,
    unique (source_expense_id),
    unique (target_expense_id),
    constraint fk_source_expense_id foreign key (source_expense_id) references expenses (id)
        on delete cascade on update cascade,
    constraint fk_target_expense_id foreign key (target_expense_id) references expenses (id)
        on delete cascade on update cascade
);

create index idx_conversions_target_expense_id on conversions (target_expense_id);
```

- `decimal(20, 6)` for rate: 6 decimal places handle small cross-rates (e.g. VND/JPY ≈ 0.003)
- `unique` on both expense IDs prevents double-linking in concurrent creation

### 2. SQLC Queries (append to `sqlc/query.sql`)

```sql
-- name: UpsertExchangeRateSnapshot :one
INSERT INTO exchange_rate_snapshots (base_currency_code, rates, fetched_at)
VALUES ($1, $2, NOW())
ON CONFLICT (base_currency_code)
DO UPDATE SET rates = EXCLUDED.rates, fetched_at = EXCLUDED.fetched_at
RETURNING *;

-- name: GetExchangeRateSnapshot :one
SELECT * FROM exchange_rate_snapshots WHERE base_currency_code = $1;

-- name: AcquireExchangeRateLock :exec
SELECT pg_advisory_lock($1);

-- name: ReleaseExchangeRateLock :exec
SELECT pg_advisory_unlock($1);

-- name: CreateConversion :one
INSERT INTO conversions (source_expense_id, target_expense_id, rate)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetConversionByTargetExpenseId :one
SELECT * FROM conversions WHERE target_expense_id = $1;

-- name: GetConversionBySourceExpenseId :one
SELECT * FROM conversions WHERE source_expense_id = $1;

-- name: GetConversionsByExpenseIds :many
SELECT * FROM conversions
WHERE target_expense_id = ANY($1::bigint[]);

-- name: GetSourceExpenseIdsForGroup :many
SELECT c.source_expense_id
FROM conversions c
JOIN expenses e ON e.id = c.source_expense_id
WHERE e.group_id = $1 AND e.is_deleted = false;

-- name: SoftDeleteConversionLegs :exec
UPDATE expenses SET is_deleted = true
WHERE id IN (
  SELECT source_expense_id FROM conversions WHERE target_expense_id = $1
  UNION ALL
  SELECT $1
);
```

Run `make sqlc` after adding queries.

### 3. Exchange Rate Service (`tools/exchangerate/service.go`)

**Distributed locking** via PostgreSQL advisory locks — protects against concurrent API calls across multiple server instances. Connection pinning ensures lock/upsert/unlock run on the same session.

```go
const exchangeRateLockKey int64 = 8200001

type Service struct {
    pool    *pgxpool.Pool
    poolQry *db.Queries  // for fast path (unowned connection)
    apiKey  string
    log     logger.ILogger
}

func (s *Service) GetOrRefresh(ctx context.Context) (*Result, error) {
    // 1. Fast path — check freshness without acquiring lock
    if snap, err := s.poolQry.GetExchangeRateSnapshot(ctx, "USD"); err == nil {
        if time.Since(snap.FetchedAt) < 24*time.Hour {
            return s.build(ctx, snap)
        }
    }

    // 2. Acquire dedicated connection for advisory lock
    conn, err := s.pool.Acquire(ctx)
    if err != nil { return nil, err }
    defer conn.Release()
    qtx := db.New(conn)

    // 3. Acquire distributed advisory lock (blocking — other instances wait here)
    if err := qtx.AcquireExchangeRateLock(ctx, exchangeRateLockKey); err != nil { return nil, err }
    defer qtx.ReleaseExchangeRateLock(ctx, exchangeRateLockKey)

    // 4. Double-check inside lock
    if snap, err := qtx.GetExchangeRateSnapshot(ctx, "USD"); err == nil {
        if time.Since(snap.FetchedAt) < 24*time.Hour {
            return s.build(ctx, snap)
        }
    }

    // 5. Fetch from API
    snap, fetchErr := s.fetchFromAPI(ctx)
    if fetchErr != nil {
        // On failure: log warning, fall back to stale snapshot
        s.log.Warn("exchange rate fetch failed, using cached values", "error", fetchErr)
        if stale, err := qtx.GetExchangeRateSnapshot(ctx, "USD"); err == nil {
            return s.build(ctx, stale)
        }
        return nil, fetchErr
    }

    // 6. Upsert into DB
    stored, err := qtx.UpsertExchangeRateSnapshot(ctx, db.UpsertExchangeRateSnapshotParams{
        BaseCurrencyCode: "USD",
        Rates:            snap,
    })
    if err != nil { return nil, err }
    return s.build(ctx, stored)
}
```

`build()` parses JSONB rates, fetches app currencies via `s.poolQry.GetCurrencies(ctx)`, computes `UnsupportedCurrencies` (currencies in DB not found in API response), and logs each at WARN.

`fetchFromAPI()` calls `https://v6.exchangerate-api.com/v6/{apiKey}/latest/USD` with a 10-second HTTP timeout, returns `json.RawMessage` of the `conversion_rates` object.

### 4. GraphQL Schema Changes

**`types.graphqls`** — append:

```graphql
type ConversionDetails {
	sourceCurrency: Currency!
	sourceAmount: Decimal!
	rate: Decimal!
}

type ExchangeRate {
	code: String!
	rate: Decimal!
}

type ExchangeRateSnapshot {
	base: String!
	rates: [ExchangeRate!]!
	fetchedAt: Time!
	unsupportedCurrencies: [String!]!
}
```

Also add `conversionDetails: ConversionDetails` to existing `Expense` type.

**`inputs.graphqls`** — append:

```graphql
input ConversionInput {
	name: String!
	description: String!
	sourceAmount: Decimal!
	sourceCurrencyId: ID!
	targetAmount: Decimal!
	targetCurrencyId: ID!
	expenseAt: Time!
	debtorId: ID!
	creditorId: ID!
}
```

**`endpoint.graphqls`** — add:

```graphql
# Mutation:
addConversion(groupId: ID!, input: ConversionInput!): Expense! @auth
# Query:
exchangeRates: ExchangeRateSnapshot! @auth
```

Run `make gqlgen` after all schema changes. No `gqlgen.yml` changes needed — `conversionDetails` is a nullable struct field, gqlgen uses the value set directly on `model.Expense`.

### 5. Expense Type

**`graphql/expensetype.go`**:

```go
const (
    ExpenseTypeGeneric    int16 = iota // 0
    ExpenseTypeRepayment               // 1
    ExpenseTypeConversion              // 2
)
```

Update `expenseTypeString` and `expenseTypeFromString` to handle `"Conversion"`.

### 6. Resolver Changes (`graphql/endpoint.resolvers.go`)

**`AddConversion`** (new stub from gqlgen):

1. Auth check via `checkIsGroupMember`
2. Validate `sourceCurrencyId != targetCurrencyId`
3. Begin DB transaction
4. Create source expense: `type=Repayment`, `name="[Conversion Source]"`, `currency=sourceCurrencyId`, `amount=sourceAmount`, payer=creditorId, share=debtorId
5. Create target expense: `type=Conversion`, `name=input.Name`, `currency=targetCurrencyId`, `amount=targetAmount`, payer=creditorId, share=debtorId
6. Compute rate: `shopspring/decimal` — `targetAmount.Div(sourceAmount)`
7. Insert `conversions` record linking both expense IDs
8. Commit; return target expense with `ConversionDetails` populated inline

**`DeleteExpense`** (modify existing):

```go
// Before existing DeleteExpense logic:
if expense.Type == ExpenseTypeConversion {
    // Cascade: atomically soft-delete both legs
    tx, _ := r.Db.Pool().Begin(ctx)
    defer tx.Rollback(ctx)
    r.DbQuery.WithTx(tx).SoftDeleteConversionLegs(ctx, expenseID)
    tx.Commit(ctx)
    return true, nil
}
// Block direct deletion of a hidden source leg
if expense.Type == ExpenseTypeRepayment {
    if _, err := r.DbQuery.GetConversionBySourceExpenseId(ctx, expenseID); err == nil {
        return false, errorhelper.NewAppError(/* ExpenseNotConvertible */)
    }
}
```

**`Expenses`** (modify existing — two additions):

_After fetching raw expenses, before building display list:_

```go
// Collect source leg IDs to hide
sourceIds, _ := r.DbQuery.GetSourceExpenseIdsForGroup(ctx, groupID)
sourceIdSet := map[int64]bool{}
for _, id := range sourceIds { sourceIdSet[id] = true }

// Collect conversion details for Conversion expenses
var convTargetIds []int64
for _, e := range expenses {
    if e.Type == ExpenseTypeConversion { convTargetIds = append(convTargetIds, e.ID) }
}
conversions, _ := r.DbQuery.GetConversionsByExpenseIds(ctx, convTargetIds)
convMap := map[int64]db.Conversion{}
for _, c := range conversions { convMap[c.TargetExpenseID] = c }
```

_Balance computation uses ALL expenses (including source legs). Display list skips source legs:_

```go
// In display loop:
if sourceIdSet[expense.ID] { continue }

// For Conversion type, attach details:
if expense.Type == ExpenseTypeConversion {
    if conv, ok := convMap[expense.ID]; ok {
        srcExp, _ := r.DbQuery.GetExpense(ctx, conv.SourceExpenseID)
        expModel.ConversionDetails = &model.ConversionDetails{
            SourceCurrency: toCurrencyModel(currencyMap[srcExp.CurrencyID]),
            SourceAmount:   pghelper.Decimal(srcExp.Amount),
            Rate:           pghelper.Decimal(conv.Rate),
        }
    }
}
```

**`ExchangeRates`** (new):

```go
func (r *queryResolver) ExchangeRates(ctx context.Context) (*model.ExchangeRateSnapshot, error) {
    result, err := r.ExchangeRateSvc.GetOrRefresh(ctx)
    if err != nil { return nil, err }
    rates := make([]*model.ExchangeRate, 0, len(result.Rates))
    for code, rate := range result.Rates {
        rates = append(rates, &model.ExchangeRate{Code: code, Rate: decimal.NewFromFloat(rate)})
    }
    sort.Slice(rates, func(i, j int) bool { return rates[i].Code < rates[j].Code })
    return &model.ExchangeRateSnapshot{
        Base: "USD", Rates: rates, FetchedAt: result.FetchedAt,
        UnsupportedCurrencies: result.UnsupportedCurrencies,
    }, nil
}
```

### 7. Frontend Types (`src/lib/types.ts`)

Append:

```typescript
export interface ConversionDetails {
	sourceCurrency: Currency;
	sourceAmount: string;
	rate: string;
}

export interface ConversionInput {
	name: string;
	description: string;
	sourceAmount: string;
	sourceCurrencyId: string;
	targetAmount: string;
	targetCurrencyId: string;
	expenseAt: string;
	debtorId: string;
	creditorId: string;
}

export interface ExchangeRate {
	code: string;
	rate: string;
}

export interface ExchangeRateSnapshot {
	base: string;
	rates: ExchangeRate[];
	fetchedAt: string;
	unsupportedCurrencies: string[];
}
```

Add `conversionDetails?: ConversionDetails` to existing `Expense` interface.

### 8. `AddConversionModal.svelte` (new)

**Props:**

```typescript
interface Props {
	groupId: string;
	members: User[];
	creditorId: string; // person owed
	debtorId: string; // person owing
	sourceAmount: string; // read-only
	sourceCurrencyCode: string;
	usedCurrencies?: Currency[];
	onClose: () => void;
	onSuccess: () => void;
}
```

**Currency dropdown:** Same `displayCurrencies` derived pattern as `AddExpenseModal.svelte` (used + guessed + separator + others), but with source currency excluded everywhere. Default target = first non-separator entry.

**Rate fetch on mount:**

```typescript
onMount(async () => {
	fetchingRates = true;
	const data = await query<{ exchangeRates: ExchangeRateSnapshot }>(EXCHANGE_RATES_QUERY);
	if (data) {
		rateSnapshot = data.exchangeRates;
		updateRateForCurrentPair();
	}
	fetchingRates = false;
});
```

**Cross-rate computation** (both rates relative to USD base):

```typescript
function computeRate(fromCode: string, toCode: string): string | null {
	const from = rateSnapshot?.rates.find((r) => r.code === fromCode)?.rate;
	const to = rateSnapshot?.rates.find((r) => r.code === toCode)?.rate;
	if (!from || !to) return null;
	return (parseFloat(to) / parseFloat(from)).toFixed(6);
}
```

**Bidirectional editing:** `lastEdited: 'rate' | 'amount' | null` flag prevents circular `$effect` updates.

- Edit rate → `targetAmount = (sourceAmount * rate).toFixed(2)`
- Edit amount → `rate = (targetAmount / sourceAmount).toFixed(6)`

**"Last updated" display:**

```typescript
const lastUpdatedText = $derived.by(() => {
	if (!rateSnapshot) return '';
	const h = Math.floor((Date.now() - new Date(rateSnapshot.fetchedAt).getTime()) / 3_600_000);
	return h < 1 ? 'Updated recently' : `Updated ${h}h ago`;
});
```

**Unsupported currency warning:** Show inline text if either source or target code appears in `rateSnapshot.unsupportedCurrencies`.

**Visual style:** Amber theme — modal header accent `#f59e0b`, same layout structure as `AddRepaymentModal.svelte`.

**Submit mutation:**

```graphql
mutation AddConversion($groupId: ID!, $input: ConversionInput!) {
	addConversion(groupId: $groupId, input: $input) {
		id
	}
}
```

### 9. Group Page Changes (`src/routes/groups/[id]/+page.svelte`)

**New state:**

```typescript
let showAddConversion = $state(false);
let conversionPrefill = $state<
	| {
			creditorId: string;
			debtorId: string;
			sourceAmount: string;
			sourceCurrencyCode: string;
	  }
	| undefined
>(undefined);
```

**`openConversion` handler:**

```typescript
function openConversion(
	creditorId: string,
	debtorId: string,
	amount: string,
	currencyCode: string
) {
	if (!get(isOnline)) {
		toast.error('Currency conversion requires an internet connection');
		return;
	}
	conversionPrefill = {
		creditorId,
		debtorId,
		sourceAmount: amount,
		sourceCurrencyCode: currencyCode
	};
	showAddConversion = true;
}
```

**Convert button** (after each Settle button in both balance sections):

```svelte
<!-- "You are owed" section — creditor = current user, debtor = o.user -->
<button
	class="btn btn-xs btn-outline btn-amber"
	onclick={() => openConversion($auth.user?.id || '', o.user.id, o.amount, o.currency.code)}
	>Convert</button
>

<!-- "You owe" section — creditor = o.user, debtor = current user -->
<button
	class="btn btn-xs btn-outline btn-amber"
	onclick={() => openConversion(o.user.id, $auth.user?.id || '', o.amount, o.currency.code)}
	>Convert</button
>
```

**Conversion expense styling:**

- Border: `#f59e0b` (amber-400)
- Background: `#fffbeb` (amber-50)
- Icon: arrows-exchange SVG in amber circle (`#fef3c7` bg, `#d97706` color)
- Detail row: `{sourceCurrency.symbol}{sourceAmount} {sourceCurrency.code} → {currency.symbol}{amount} {currency.code}`
- Balance label: `"CONVERTED"` (mirrors `"SENT"` / `"RECEIVED"` pattern)
- Edit: blocked — show toast `"Conversion expenses cannot be edited. Delete and re-create if needed."`

**`GROUP_QUERY` update:** Add to expenses fragment:

```graphql
conversionDetails {
    sourceCurrency { id code symbol name }
    sourceAmount
    rate
}
```

**Modal mount** (same pattern as other modals):

```svelte
{#if showAddConversion && group && conversionPrefill}
	<AddConversionModal ... />
{/if}
```

Include `showAddConversion` in `anyModalOpen` Escape-key check.

**Scoped CSS:**

```css
.conversion-item {
	background-color: #fffbeb;
	border-left-color: #f59e0b;
}
.conversion-icon-bg {
	background-color: #fef3c7;
	color: #d97706;
}
.btn-amber {
	border-color: #d97706;
	color: #d97706;
}
.btn-amber:hover {
	background-color: #fef3c7;
}
```

---

## Implementation Order

1. Migration `000004` + SQLC queries → `make sqlc`
2. Config: `ExchangeRateApiKey` in `config.go` + `resources.go`
3. `tools/exchangerate/service.go` (self-contained)
4. GraphQL schema edits → `make gqlgen`
5. `expensetype.go`: add `ExpenseTypeConversion = 2`
6. Wire `ExchangeRateSvc` into `resolver.go`
7. `AddConversion` resolver
8. `DeleteExpense` cascade logic
9. `Expenses` query: filter source legs + populate `conversionDetails`
10. `ExchangeRates` query resolver
11. `go build ./...` — fix all compile errors
12. `src/lib/types.ts` additions
13. `AddConversionModal.svelte`
14. `+page.svelte` (Convert button, amber styling, modal wiring)
15. `npm run check && npm run lint`
16. End-to-end browser test

---

## Edge Cases

| Case                                         | Handling                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Source = target currency                     | Return validation error before DB                                                                                   |
| sourceAmount = 0                             | Block — division by zero for rate                                                                                   |
| API key missing                              | Skip API call; use stale snapshot; if none, error in modal (manual rate entry still works)                          |
| Supported currency missing from API response | Logged at WARN; shown in `unsupportedCurrencies`; frontend warns user but allows manual rate entry                  |
| Direct delete of hidden source leg           | Blocked via `GetConversionBySourceExpenseId` check in `DeleteExpense`                                               |
| Balance calculation includes source legs     | Compute balance from ALL expenses; only filter source legs from the display list                                    |
| Concurrent API fetch (multiple instances)    | Distributed advisory lock (`pg_advisory_lock`) serialises fetches; double-check inside lock avoids duplicate calls  |
| Conversion expense displayed offline         | Loads from cache with amber styling — no special handling needed                                                    |
| Rate precision                               | `decimal(20, 6)` in DB; 6 decimal places displayed; computed via `shopspring/decimal` (no float64 in critical path) |

---

## Future Work

- Allow editing a conversion (currently blocked; user must delete and re-create)
- Support partial conversion (convert only part of an outstanding balance)
- Show conversion history / audit trail in expense detail view
- Push notification when exchange rates are refreshed
