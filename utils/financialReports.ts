import type {
  Account,
  AccountModule,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  PayrollEntry,
  Transaction,
} from '../types';
import { getBankAccounts, getPostableLeaves } from './accountTree';
import { buildAccountLedger } from './accountLedger';
import { computePersonBalance } from './accrualEngine';

export interface DateRangeOptions {
  startDate?: string;
  endDate?: string;
}

export interface TrialBalanceRow {
  account: Account;
  module: AccountModule;
  openingBalance: number;
  turnoverDebit: number;
  turnoverCredit: number;
  closingDebit: number;
  closingCredit: number;
  netClosing: number;
  txCount: number;
}

export interface ProfitLossItem {
  account: Account;
  amount: number;
  sharePct: number;
}

export interface TrialBalanceSummary {
  rows: TrialBalanceRow[];
  byModule: Record<AccountModule, TrialBalanceRow[]>;
  totalTurnoverDebit: number;
  totalTurnoverCredit: number;
  totalClosingDebit: number;
  totalClosingCredit: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  profitMarginPct: number;
  incomeBreakdown: ProfitLossItem[];
  expenseBreakdown: ProfitLossItem[];
}

/**
 * Pure Iranian 4-column Trial Balance + Income Statement (P&L) engine.
 * Bank transfers update bank turnover debit/credit accurately without inflating income or expense.
 */
export function buildTrialBalance(
  accounts: Account[],
  transactions: Transaction[],
  options: DateRangeOptions & {
    invoices?: Invoice[];
    payrollEntries?: PayrollEntry[];
  } = {}
): TrialBalanceSummary {
  const { startDate, endDate, invoices = [], payrollEntries = [] } = options;
  const leaves = getPostableLeaves(accounts).sort((a, b) =>
    a.code.localeCompare(b.code, 'fa', { numeric: true })
  );

  const rows: TrialBalanceRow[] = [];
  const byModule: Record<AccountModule, TrialBalanceRow[]> = {
    bank: [],
    income: [],
    expense: [],
  };

  let totalTurnoverDebit = 0;
  let totalTurnoverCredit = 0;
  let totalClosingDebit = 0;
  let totalClosingCredit = 0;

  for (const acc of leaves) {
    const ledger = buildAccountLedger(acc, accounts, transactions, {
      startDate,
      endDate,
      includeChildren: false,
      invoices,
      payrollEntries,
    });

    const closingDebit = ledger.closingBalance > 0 ? ledger.closingBalance : 0;
    const closingCredit = ledger.closingBalance < 0 ? Math.abs(ledger.closingBalance) : 0;

    const row: TrialBalanceRow = {
      account: acc,
      module: acc.module,
      openingBalance: ledger.openingBalance,
      turnoverDebit: ledger.turnoverDebit,
      turnoverCredit: ledger.turnoverCredit,
      closingDebit,
      closingCredit,
      netClosing: ledger.closingBalance,
      txCount: ledger.rows.length,
    };

    rows.push(row);
    byModule[acc.module].push(row);

    totalTurnoverDebit += row.turnoverDebit;
    totalTurnoverCredit += row.turnoverCredit;
    totalClosingDebit += row.closingDebit;
    totalClosingCredit += row.closingCredit;
  }

  const incomeRows = byModule.income.filter((r) => r.turnoverCredit > 0);
  const expenseRows = byModule.expense.filter((r) => r.turnoverDebit > 0);

  const totalIncome = incomeRows.reduce((s, r) => s + r.turnoverCredit, 0);
  const totalExpense = expenseRows.reduce((s, r) => s + r.turnoverDebit, 0);
  const netProfit = totalIncome - totalExpense;
  const profitMarginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  const incomeBreakdown: ProfitLossItem[] = incomeRows
    .map((r) => ({
      account: r.account,
      amount: r.turnoverCredit,
      sharePct: totalIncome > 0 ? Math.round((r.turnoverCredit / totalIncome) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const expenseBreakdown: ProfitLossItem[] = expenseRows
    .map((r) => ({
      account: r.account,
      amount: r.turnoverDebit,
      sharePct: totalExpense > 0 ? Math.round((r.turnoverDebit / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    rows,
    byModule,
    totalTurnoverDebit,
    totalTurnoverCredit,
    totalClosingDebit,
    totalClosingCredit,
    totalIncome,
    totalExpense,
    netProfit,
    profitMarginPct,
    incomeBreakdown,
    expenseBreakdown,
  };
}

export interface PersonReportRow {
  contact: Contact;
  groupName: string;
  income: number;
  expense: number;
  net: number;
  /** Positive = طلبکار از ما (we owe them); Negative = بدهکار به ما (they owe us) */
  accrualNetBalance: number;
  payableAmount: number;
  receivableAmount: number;
  txCount: number;
  lastDate?: string;
}

export interface PersonGroupSummary {
  groupId: string;
  groupName: string;
  count: number;
  income: number;
  expense: number;
  net: number;
}

export interface PersonsReportSummary {
  rows: PersonReportRow[];
  groupSummaries: PersonGroupSummary[];
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
  totalPayable: number;
  totalReceivable: number;
  activeCount: number;
}

/**
 * Pure Persons Statement Report — excludes bank-to-bank transfers and merges accrual balances.
 */
export function buildPersonsReport(
  contacts: Contact[],
  groups: ContactGroup[],
  transactions: Transaction[],
  options: DateRangeOptions & {
    groupId?: string;
    query?: string;
    invoices?: Invoice[];
    payrollEntries?: PayrollEntry[];
    checks?: CheckItem[];
  } = {}
): PersonsReportSummary {
  const {
    startDate,
    endDate,
    groupId,
    query,
    invoices = [],
    payrollEntries = [],
    checks = [],
  } = options;
  const q = (query || '').trim().toLowerCase();
  const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));

  const scopedTxs = transactions.filter((t) => {
    if (t.type !== 'income' && t.type !== 'expense') return false;
    if (!t.contactId) return false;
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    return true;
  });

  const statsMap = new Map<
    string,
    { income: number; expense: number; txCount: number; lastDate?: string }
  >();

  for (const tx of scopedTxs) {
    const cid = tx.contactId!;
    const cur = statsMap.get(cid) || { income: 0, expense: 0, txCount: 0, lastDate: undefined };
    if (tx.type === 'income') cur.income += tx.amount;
    else cur.expense += tx.amount;
    cur.txCount += 1;
    if (!cur.lastDate || tx.date > cur.lastDate) cur.lastDate = tx.date;
    statsMap.set(cid, cur);
  }

  const rows: PersonReportRow[] = [];
  const groupAcc = new Map<string, PersonGroupSummary>();

  for (const g of groups) {
    groupAcc.set(g.id, {
      groupId: g.id,
      groupName: g.name,
      count: 0,
      income: 0,
      expense: 0,
      net: 0,
    });
  }

  for (const c of contacts) {
    const gName = groupNameMap.get(c.groupId) || 'سایر';
    const st = statsMap.get(c.id) || { income: 0, expense: 0, txCount: 0, lastDate: undefined };
    const net = st.income - st.expense;
    const bal = computePersonBalance(c.id, invoices, payrollEntries, checks, transactions, {
      startDate,
      endDate,
    });
    const combinedCount = st.txCount + bal.rows.length;
    const lastAccrualDate = bal.rows[bal.rows.length - 1]?.date;
    const lastDate =
      st.lastDate && lastAccrualDate
        ? st.lastDate > lastAccrualDate
          ? st.lastDate
          : lastAccrualDate
        : st.lastDate || lastAccrualDate;

    const gEntry = groupAcc.get(c.groupId);
    if (gEntry) {
      gEntry.count += 1;
      gEntry.income += st.income;
      gEntry.expense += st.expense;
      gEntry.net += net;
    }

    if (groupId && c.groupId !== groupId) continue;
    if (q) {
      const hay = `${c.fullName} ${c.mobile || ''} ${gName}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    rows.push({
      contact: c,
      groupName: gName,
      income: st.income,
      expense: st.expense,
      net,
      accrualNetBalance: bal.netBalance,
      payableAmount: bal.payableAmount,
      receivableAmount: bal.receivableAmount,
      txCount: combinedCount,
      lastDate,
    });
  }

  rows.sort(
    (a, b) =>
      Math.abs(b.accrualNetBalance) + b.income + b.expense -
        (Math.abs(a.accrualNetBalance) + a.income + a.expense) ||
      a.contact.fullName.localeCompare(b.contact.fullName, 'fa')
  );

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const totalPayable = rows.reduce((s, r) => s + r.payableAmount, 0);
  const totalReceivable = rows.reduce((s, r) => s + r.receivableAmount, 0);

  return {
    rows,
    groupSummaries: [...groupAcc.values()].filter((g) => g.count > 0),
    totalIncome,
    totalExpense,
    totalNet: totalIncome - totalExpense,
    totalPayable,
    totalReceivable,
    activeCount: rows.filter((r) => r.txCount > 0).length,
  };
}

export interface TreasuryBankRow {
  account: Account;
  openingBalance: number;
  inflow: number;
  outflow: number;
  transferIn: number;
  transferOut: number;
  closingBalance: number;
  txCount: number;
}

export interface TreasuryReportSummary {
  banks: TreasuryBankRow[];
  transfers: Transaction[];
  totalOpening: number;
  totalInflow: number;
  totalOutflow: number;
  totalTransfersAmount: number;
  totalClosing: number;
}

/**
 * Pure Treasury & Banks Cashflow Report — tracks real inflow, outflow, transfers, and balances.
 */
export function buildTreasuryReport(
  accounts: Account[],
  transactions: Transaction[],
  options: DateRangeOptions & { bankId?: string } = {}
): TreasuryReportSummary {
  const { startDate, endDate, bankId } = options;
  const allBanks = getBankAccounts(accounts);
  const scopedBanks = bankId ? allBanks.filter((b) => b.id === bankId) : allBanks;

  const banks: TreasuryBankRow[] = scopedBanks.map((bank) => {
    const ledger = buildAccountLedger(bank, accounts, transactions, {
      startDate,
      endDate,
      includeChildren: false,
    });

    let transferIn = 0;
    let transferOut = 0;
    for (const tx of transactions) {
      if (tx.type !== 'transfer') continue;
      if (startDate && tx.date < startDate) continue;
      if (endDate && tx.date > endDate) continue;
      if (tx.accountId === bank.id) transferIn += tx.amount;
      if (tx.bankAccountId === bank.id) transferOut += tx.amount;
    }

    return {
      account: bank,
      openingBalance: ledger.openingBalance,
      inflow: ledger.turnoverDebit,
      outflow: ledger.turnoverCredit,
      transferIn,
      transferOut,
      closingBalance: ledger.closingBalance,
      txCount: ledger.rows.length,
    };
  });

  const transfers = transactions
    .filter((t) => {
      if (t.type !== 'transfer') return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      if (bankId && t.bankAccountId !== bankId && t.accountId !== bankId) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    banks,
    transfers,
    totalOpening: banks.reduce((s, b) => s + b.openingBalance, 0),
    totalInflow: banks.reduce((s, b) => s + b.inflow, 0),
    totalOutflow: banks.reduce((s, b) => s + b.outflow, 0),
    totalTransfersAmount: transfers.reduce((s, t) => s + t.amount, 0),
    totalClosing: banks.reduce((s, b) => s + b.closingBalance, 0),
  };
}
