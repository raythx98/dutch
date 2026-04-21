export interface User {
	id: string;
	name: string;
}

export interface Currency {
	id: string;
	code: string;
	symbol: string;
	name: string;
	sortOrder?: number;
}

export interface Group {
	id: string;
	name: string;
	inviteToken?: string;
	members: User[];
	usedCurrencies?: Currency[];
}

export interface Share {
	user: User;
	amount: string;
}

export interface ConversionDetails {
	sourceCurrency: Currency;
	sourceAmount: string;
	rate: string;
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

export interface Expense {
	id: string;
	type: string;
	name: string;
	description: string;
	amount: string;
	expenseAt: string;
	currency: Currency;
	payers: Share[];
	shares: Share[];
	conversionDetails?: ConversionDetails;
	/** True when this expense exists only in local cache, not yet synced to server. */
	pendingSync?: boolean;
}

export interface Owe {
	user: User;
	amount: string;
	currency: { code: string; symbol: string; name: string };
}

export interface ExpenseSummary {
	expenses: Expense[];
	owes: Owe[];
	owed: Owe[];
}

// ---- Offline / cache types ----

export interface ShareInput {
	userId: string;
	amount: string;
}

export interface ExpenseInput {
	name: string;
	description: string;
	type: string;
	amount: string;
	currencyId: string;
	expenseAt: string;
	payers: ShareInput[];
	shares: ShareInput[];
}

export type OfflineOperation = 'addExpense' | 'editExpense' | 'deleteExpense';

export interface OfflineQueueItem {
	id?: number;
	operation: OfflineOperation;
	groupId: string;
	expenseId?: string;
	/** Not required for deleteExpense operations. */
	payload?: ExpenseInput;
	tempId?: string;
	createdAt: number;
}

export interface BalanceItem {
	amount: string;
	currency: { symbol: string; code: string };
}

export interface DashboardData {
	groups: Group[];
	balances: Record<string, { owes: BalanceItem[]; owed: BalanceItem[] }>;
}

export interface DashboardCacheEntry {
	data: DashboardData;
	cachedAt: number;
}

export interface GroupCacheEntry {
	data: { group: Group; summary: ExpenseSummary };
	cachedAt: number;
}
