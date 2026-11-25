import type { Account, Invoice, PayrollEntry, Transaction } from '../types';
import { getDescendantIds, getPostableLeaves } from './accountTree';
import { isOperatingExpenseTx, isOperatingIncomeTx } from './accrualEngine';

function leafIdsUnder(accounts: Account[], rootId: string): Set<string> {
  const ids = getDescendantIds(accounts, rootId).filter((id) => {
    const a = accounts.find((x) => x.id === id);
    return a?.kind === 'postable';
  });
  return new Set(ids.length ? ids : []);
}

export function bankCashEffectForAccount(tx: Transaction, bankAccountId: string): number {
  if (tx.type === 'transfer') {
    let net = 0;
    if (tx.bankAccountId === bankAccountId) net -= tx.amount;
    if (tx.accountId === bankAccountId) net += tx.amount;
    return net;
  }
  if (tx.bankAccountId !== bankAccountId) return 0;
  return tx.type === 'income' ? tx.amount : -tx.amount;
}

export function bankCashEffect(tx: Transaction): number {
  if (tx.type === 'transfer') return -tx.amount;
  return tx.type === 'income' ? tx.amount : -tx.amount;
}

export function computeBankBalance(bankAccount: Account, transactions: Transaction[]): number {
  const opening = bankAccount.openingBalance || 0;
  let delta = 0;
  for (const tx of transactions) {
    delta += bankCashEffectForAccount(tx, bankAccount.id);
  }
  return opening + delta;
}

export function totalBankBalance(accounts: Account[], transactions: Transaction[]): number {
  return getPostableLeaves(accounts, 'acc_bank').reduce(
    (s, a) => s + computeBankBalance(a, transactions),
    0
  );
}

export function totalIncome(
  accounts: Account[],
  transactions: Transaction[],
  invoices: Invoice[] = []
): number {
  const ids = leafIdsUnder(accounts, 'acc_income');
  const cashDirect = transactions
    .filter((t) => isOperatingIncomeTx(t) && ids.has(t.accountId))
    .reduce((s, t) => s + t.amount, 0);
  const accrualSales = invoices
    .filter((i) => i.kind === 'sale' && ids.has(i.accountId))
    .reduce((s, i) => s + i.amount, 0);
  return cashDirect + accrualSales;
}

export function totalExpenses(
  accounts: Account[],
  transactions: Transaction[],
  invoices: Invoice[] = [],
  payrollEntries: PayrollEntry[] = []
): number {
  const ids = leafIdsUnder(accounts, 'acc_expense');
  const cashDirect = transactions
    .filter((t) => isOperatingExpenseTx(t) && ids.has(t.accountId))
    .reduce((s, t) => s + t.amount, 0);
  const accrualPurchases = invoices
    .filter((i) => i.kind === 'purchase' && ids.has(i.accountId))
    .reduce((s, i) => s + i.amount, 0);
  const accrualPayroll = payrollEntries
    .filter((p) => ids.has(p.accountId))
    .reduce((s, p) => s + p.amount, 0);
  return cashDirect + accrualPurchases + accrualPayroll;
}

export function computeHeadingBalance(
  account: Account,
  accounts: Account[],
  transactions: Transaction[],
  invoices: Invoice[] = [],
  payrollEntries: PayrollEntry[] = []
): number {
  if (account.module === 'bank' && account.kind === 'postable') {
    return computeBankBalance(account, transactions);
  }
  if (account.module === 'bank' && account.kind === 'group') {
    return getPostableLeaves(accounts, account.id).reduce(
      (s, a) => s + computeBankBalance(a, transactions),
      0
    );
  }

  const ids =
    account.kind === 'group' ? leafIdsUnder(accounts, account.id) : new Set([account.id]);

  let sum = 0;
  for (const tx of transactions) {
    if (!ids.has(tx.accountId)) continue;
    if (account.module === 'income' && isOperatingIncomeTx(tx)) sum += tx.amount;
    else if (account.module === 'expense' && isOperatingExpenseTx(tx)) sum += tx.amount;
  }
  for (const inv of invoices) {
    if (!ids.has(inv.accountId)) continue;
    if (account.module === 'income' && inv.kind === 'sale') sum += inv.amount;
    else if (account.module === 'expense' && inv.kind === 'purchase') sum += inv.amount;
  }
  if (account.module === 'expense') {
    for (const pe of payrollEntries) {
      if (ids.has(pe.accountId)) sum += pe.amount;
    }
  }
  return sum;
}
