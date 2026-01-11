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
