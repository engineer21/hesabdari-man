import type { Account, Invoice, PayrollEntry, Transaction } from '../types';
import { getDescendantIds } from './accountTree';
import { isOperatingExpenseTx, isOperatingIncomeTx } from './accrualEngine';

export interface LedgerRow {
  entryId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  accountId: string;
  accountName: string;
}

export interface LedgerReport {
  openingBalance: number;
  turnoverDebit: number;
  turnoverCredit: number;
  closingBalance: number;
  rows: LedgerRow[];
}

function relevantIds(account: Account, accounts: Account[], includeChildren: boolean): Set<string> {
  if (account.kind === 'postable' && !includeChildren) return new Set([account.id]);
  const leaves = getDescendantIds(accounts, account.id).filter((id) => {
    const a = accounts.find((x) => x.id === id);
    return a?.kind === 'postable';
  });
  return new Set(leaves.length ? leaves : [account.id]);
}

export function buildAccountLedger(
  account: Account,
  accounts: Account[],
  transactions: Transaction[],
  options: {
    startDate?: string;
    endDate?: string;
    includeChildren?: boolean;
    invoices?: Invoice[];
    payrollEntries?: PayrollEntry[];
  } = {}
): LedgerReport {
  const { startDate, endDate, includeChildren = true, invoices = [], payrollEntries = [] } = options;
  const ids = relevantIds(account, accounts, includeChildren);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name || id;

  let openingDebit = 0;
  let openingCredit = 0;
  if (account.module === 'bank') {
    for (const bankId of ids) {
      const bank = accounts.find((a) => a.id === bankId);
      openingDebit += bank?.openingBalance || 0;
    }
  }

  const period: {
    entryId: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    accountId: string;
  }[] = [];

  const pushEntry = (
    txDate: string,
    entryId: string,
    description: string,
    debit: number,
    credit: number,
    refId: string
  ) => {
    if (startDate && txDate < startDate) {
      openingDebit += debit;
      openingCredit += credit;
    } else if ((!startDate || txDate >= startDate) && (!endDate || txDate <= endDate)) {
      period.push({ entryId, date: txDate, description, debit, credit, accountId: refId });
    }
  };

  for (const tx of transactions) {
    if (account.module === 'bank') {
      if (tx.type === 'transfer') {
        const fromMatch = ids.has(tx.bankAccountId);
        const toMatch = ids.has(tx.accountId);
        if (fromMatch && toMatch) {
          const fromName = accountName(tx.bankAccountId);
          const toName = accountName(tx.accountId);
          const baseDesc = tx.description ? `${tx.description} — ` : '';
          pushEntry(tx.date, `${tx.id}:out`, `${baseDesc}انتقال به ${toName}`, 0, tx.amount, tx.bankAccountId);
          pushEntry(tx.date, `${tx.id}:in`, `${baseDesc}انتقال از ${fromName}`, tx.amount, 0, tx.accountId);
        } else if (fromMatch) {
          const toName = accountName(tx.accountId);
          const desc = tx.description ? `${tx.description} (انتقال به ${toName})` : `انتقال به ${toName}`;
          pushEntry(tx.date, tx.id, desc, 0, tx.amount, tx.bankAccountId);
        } else if (toMatch) {
          const fromName = accountName(tx.bankAccountId);
          const desc = tx.description ? `${tx.description} (انتقال از ${fromName})` : `انتقال از ${fromName}`;
          pushEntry(tx.date, tx.id, desc, tx.amount, 0, tx.accountId);
        }
        continue;
      }

      if (!ids.has(tx.bankAccountId)) continue;
      const debit = tx.type === 'income' ? tx.amount : 0;
      const credit = tx.type === 'expense' ? tx.amount : 0;
      pushEntry(tx.date, tx.id, tx.description, debit, credit, tx.bankAccountId);
    } else {
      if (tx.type === 'transfer') continue;
      if (!ids.has(tx.accountId)) continue;
      if (account.module === 'income' && !isOperatingIncomeTx(tx)) continue;
      if (account.module === 'expense' && !isOperatingExpenseTx(tx)) continue;
      const debit = account.module === 'expense' ? tx.amount : 0;
      const credit = account.module === 'income' ? tx.amount : 0;
      pushEntry(tx.date, tx.id, tx.description, debit, credit, tx.accountId);
    }
  }

  // Include accrual invoices & payroll entries in income/expense ledgers
  if (account.module !== 'bank') {
    for (const inv of invoices) {
      if (!ids.has(inv.accountId)) continue;
      if (account.module === 'income' && inv.kind === 'sale') {
        const desc = inv.description
          ? `فاکتور فروش #${inv.invoiceNumber || '—'} — ${inv.description}`
          : `فاکتور فروش #${inv.invoiceNumber || '—'}`;
        pushEntry(inv.date, `inv_${inv.id}`, desc, 0, inv.amount, inv.accountId);
      } else if (account.module === 'expense' && inv.kind === 'purchase') {
        const desc = inv.description
          ? `فاکتور خرید #${inv.invoiceNumber || '—'} — ${inv.description}`
          : `فاکتور خرید #${inv.invoiceNumber || '—'}`;
        pushEntry(inv.date, `inv_${inv.id}`, desc, inv.amount, 0, inv.accountId);
      }
    }

    if (account.module === 'expense') {
      for (const pe of payrollEntries) {
        if (!ids.has(pe.accountId)) continue;
        const desc = pe.description || `کارکرد پرسنل (${pe.quantity} ${pe.unitLabel})`;
        pushEntry(pe.date, `pe_${pe.id}`, desc, pe.amount, 0, pe.accountId);
      }
    }
  }

  const openingBalance = openingDebit - openingCredit;
  period.sort((a, b) => a.date.localeCompare(b.date) || a.entryId.localeCompare(b.entryId));

  let running = openingBalance;
  let turnoverDebit = 0;
  let turnoverCredit = 0;
  const rows: LedgerRow[] = period.map((line) => {
    turnoverDebit += line.debit;
    turnoverCredit += line.credit;
    running += line.debit - line.credit;
    return {
      entryId: line.entryId,
      date: line.date,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      balance: running,
      accountId: line.accountId,
      accountName: accountName(line.accountId),
    };
  });

  return {
    openingBalance,
    turnoverDebit,
    turnoverCredit,
    closingBalance: running,
    rows,
  };
}
