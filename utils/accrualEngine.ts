import type {
  Account,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  Loan,
  LoanInstallment,
  PayrollEntry,
  PayrollEntryType,
  ReminderSettings,
  Transaction,
} from '../types';
import {
  getJalaliParts,
  getLocalDayKey,
  jalaliToGregorianDate,
  parseLocalIsoDate,
  shiftJalaliMonth,
} from './jalaliPeriod';

/**
 * Pure Accrual & Financial Accounting Engine
 * ------------------------------------------
 * Enforces zero double-counting between accrual documents (Invoices, Payroll Entries,
 * Checks, Loans) and cash-moving bank transactions.
 */

export function isOperatingIncomeTx(tx: Transaction): boolean {
  if (tx.type !== 'income') return false;
  return !tx.linkKind || tx.linkKind === 'regular';
}

export function isOperatingExpenseTx(tx: Transaction): boolean {
  if (tx.type !== 'expense') return false;
  return !tx.linkKind || tx.linkKind === 'regular' || tx.linkKind === 'loan_interest';
}

export type InvoiceSettlementStatus = 'unpaid' | 'partial' | 'paid';

export interface InvoiceSettlementSummary {
  invoice: Invoice;
  paidCash: number;
  pendingChecks: number;
  clearedChecks: number;
  bouncedChecks: number;
  settledTotal: number;
  remaining: number;
  status: InvoiceSettlementStatus;
  linkedTransactions: Transaction[];
  linkedChecks: CheckItem[];
}

/**
 * Computes real-time settlement of a purchase or sale invoice.
 * Rules confirmed by user:
 * - Cash/bank payments linked to the invoice (`linkKind === 'invoice_settlement'`) reduce remaining balance.
 * - Issued/received checks linked to the invoice reduce remaining balance immediately while `pending` or `cleared`.
 * - Bounced or cancelled checks reverse their settlement effect automatically.
 * - Clearing a check creates a `check_clearing` bank transaction; we count cleared checks via the check record
 *   (NOT via `check_clearing` tx) so an invoice settled by a cleared check is NEVER double-counted!
 */
export function computeInvoiceSettlement(
  invoice: Invoice,
  transactions: Transaction[],
  checks: CheckItem[]
): InvoiceSettlementSummary {
  const linkedTransactions = transactions
    .filter((t) => t.invoiceId === invoice.id && t.linkKind === 'invoice_settlement')
    .sort((a, b) => a.date.localeCompare(b.date));

  const linkedChecks = checks
    .filter((c) => c.invoiceId === invoice.id)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));

  const paidCash = linkedTransactions.reduce((sum, t) => sum + t.amount, 0);
  const pendingChecks = linkedChecks
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);
  const clearedChecks = linkedChecks
    .filter((c) => c.status === 'cleared')
    .reduce((sum, c) => sum + c.amount, 0);
  const bouncedChecks = linkedChecks
    .filter((c) => c.status === 'bounced')
    .reduce((sum, c) => sum + c.amount, 0);

  const settledTotal = paidCash + pendingChecks + clearedChecks;
  const remaining = Math.max(0, invoice.amount - settledTotal);
  const status: InvoiceSettlementStatus =
    settledTotal <= 0 ? 'unpaid' : remaining === 0 ? 'paid' : 'partial';

  return {
    invoice,
    paidCash,
    pendingChecks,
    clearedChecks,
    bouncedChecks,
    settledTotal,
    remaining,
    status,
    linkedTransactions,
    linkedChecks,
  };
}

export type PersonLedgerKind =
  | 'purchase_invoice'
  | 'sale_invoice'
  | 'payroll_accrual'
  | 'payment_cash'
  | 'receipt_cash'
  | 'payable_check'
  | 'receivable_check';

export interface PersonLedgerRow {
  id: string;
  date: string;
  kind: PersonLedgerKind;
  title: string;
  description: string;
  /** بدهکار شخص (بدهکار به ما / کاهش طلب شخص) */
  debit: number;
  /** بستانکار شخص (طلبکار از ما / افزایش طلب شخص) */
  credit: number;
  /** Running balance: > 0 means person is creditor (طلبکار از ما), < 0 means person owes us (بدهکار به ما) */
  runningBalance: number;
  invoiceId?: string;
  checkId?: string;
  payrollEntryId?: string;
  statusTag?: string;
}

export interface PersonBalanceSummary {
  contactId: string;
  /** Total credits to person (what we owe them: purchase invoices + payroll accruals + receivable cash/checks reversed) */
  totalCredit: number;
  /** Total debits to person (what they owe us or what we paid them: sale invoices + payments + payable checks) */
  totalDebit: number;
  /**
   * Net Balance:
   *  > 0 => طلبکار از ما (we owe this person / Payable)
   *  < 0 => بدهکار به ما (this person owes us / Receivable / Advance)
   *  = 0 => تسویه‌شده
   */
  netBalance: number;
  status: 'creditor' | 'debtor' | 'settled';
  /** Positive payable amount if creditor */
  payableAmount: number;
  /** Positive receivable amount if debtor */
  receivableAmount: number;
  purchaseInvoicesTotal: number;
  saleInvoicesTotal: number;
  payrollAccruedTotal: number;
  cashPaidTotal: number;
  cashReceivedTotal: number;
  activePayableChecksTotal: number;
  activeReceivableChecksTotal: number;
  rows: PersonLedgerRow[];
}

/**
 * Computes the complete, real running Debit/Credit balance (بدهکار / بستانکار) of a person.
 *
 * Sign convention (standard Iranian طرف‌حساب ledger):
 * - Credit (+): Purchase invoice from person, Payroll/Work-log accrual owed to person
 * - Debit  (-): Sale invoice to person, Cash/bank payment to person, Active (pending/cleared) Payable check issued to person
 * - Credit (+): Cash/bank receipt from person (reduces their debt), Active (pending/cleared) Receivable check received from person
 * - Note on checks:
 *   * Issuing/receiving a check IMMEDIATELY posts to the person's ledger.
 *   * Clearing the check creates a `check_clearing` bank transaction — IGNORED in person ledger so it NEVER double-counts!
 *   * Bouncing or cancelling a check EXCLUDES its settlement effect from the person's running balance (reversing the check).
 * - Note on regular cash transactions:
 *   * If someone records a regular cash income/expense directly with `contactId` (not linked to an invoice/payroll),
 *     it represents an immediate settled cash deal (both accrual & cash happen simultaneously), so it shows in history
 *     without creating phantom debt. Only accrual documents (invoices, payroll) and settlement payments/checks create
 *     running payable/receivable balances!
 */
export function computePersonBalance(
  contactId: string,
  invoices: Invoice[],
  payrollEntries: PayrollEntry[],
  checks: CheckItem[],
  transactions: Transaction[],
  options: { startDate?: string; endDate?: string; accounts?: Account[] } = {}
): PersonBalanceSummary {
  const { startDate, endDate, accounts } = options;
  const inRange = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);
  const accMap = accounts ? new Map(accounts.map((a) => [a.id, a])) : null;

  let purchaseInvoicesTotal = 0;
  let saleInvoicesTotal = 0;
  let payrollAccruedTotal = 0;
  let cashPaidTotal = 0;
  let cashReceivedTotal = 0;
  let activePayableChecksTotal = 0;
  let activeReceivableChecksTotal = 0;

  const rawRows: Omit<PersonLedgerRow, 'runningBalance'>[] = [];

  for (const inv of invoices) {
    if (inv.contactId !== contactId || !inRange(inv.date)) continue;
    if (inv.kind === 'purchase') {
      purchaseInvoicesTotal += inv.amount;
      rawRows.push({
        id: `inv_${inv.id}`,
        date: inv.date,
        kind: 'purchase_invoice',
        title: `فاکتور خرید #${inv.invoiceNumber || '—'}`,
        description: inv.description,
        debit: 0,
        credit: inv.amount,
        invoiceId: inv.id,
      });
    } else {
      saleInvoicesTotal += inv.amount;
      rawRows.push({
        id: `inv_${inv.id}`,
        date: inv.date,
        kind: 'sale_invoice',
        title: `فاکتور فروش #${inv.invoiceNumber || '—'}`,
        description: inv.description,
        debit: inv.amount,
        credit: 0,
        invoiceId: inv.id,
      });
    }
  }

  for (const pe of payrollEntries) {
    if (pe.contactId !== contactId || !inRange(pe.date)) continue;
    payrollAccruedTotal += pe.amount;
    const headingName = accMap?.get(pe.accountId)?.name;
    const fallbackLabel =
      pe.entryType === 'fixed_month'
        ? 'حقوق ثابت ماهانه'
        : pe.entryType === 'irrigation'
          ? 'آبگیری'
          : pe.entryType === 'group_labor'
            ? 'کارگری دسته‌جمعی'
            : pe.entryType === 'daily_work'
              ? 'کارگری روزمزد'
              : 'کارکرد پرسنل';
    rawRows.push({
      id: `pe_${pe.id}`,
      date: pe.date,
      kind: 'payroll_accrual',
      title: headingName || fallbackLabel,
      description: pe.description || `${pe.quantity} ${pe.unitLabel}`,
      debit: 0,
      credit: pe.amount,
      payrollEntryId: pe.id,
    });
  }

  const invMap = new Map(invoices.map((i) => [i.id, i]));

  for (const ch of checks) {
    if (ch.contactId !== contactId || !inRange(ch.issueDate)) continue;
    // Bounced or cancelled checks reverse their effect on person balance
    if (ch.status === 'bounced' || ch.status === 'cancelled') continue;
    const statusTag = ch.status === 'cleared' ? 'پاس‌شده' : 'در جریان';
    const linkedInv = ch.invoiceId ? invMap.get(ch.invoiceId) : undefined;
    const invSuffix = linkedInv ? ` (بابت فاکتور #${linkedInv.invoiceNumber || '—'})` : '';
    if (ch.kind === 'payable') {
      activePayableChecksTotal += ch.amount;
      rawRows.push({
        id: `ch_${ch.id}`,
        date: ch.issueDate,
        kind: 'payable_check',
        title: `چک پرداختی #${ch.checkNumber}${invSuffix}`,
        description: ch.description || `سررسید ${ch.dueDate}`,
        debit: ch.amount,
        credit: 0,
        checkId: ch.id,
        invoiceId: ch.invoiceId,
        statusTag,
      });
    } else {
      activeReceivableChecksTotal += ch.amount;
      rawRows.push({
        id: `ch_${ch.id}`,
        date: ch.issueDate,
        kind: 'receivable_check',
        title: `چک دریافتی #${ch.checkNumber}${invSuffix}`,
        description: ch.description || `سررسید ${ch.dueDate}`,
        debit: 0,
        credit: ch.amount,
        checkId: ch.id,
        invoiceId: ch.invoiceId,
        statusTag,
      });
    }
  }

  for (const tx of transactions) {
    if (tx.contactId !== contactId || !inRange(tx.date)) continue;
    if (tx.type === 'transfer') continue;
    // Check clearing affects BANK only, NEVER person balance again
    if (tx.linkKind === 'check_clearing') continue;
    // Only settlement/payroll payments change the person's running payable/receivable balance
    if (tx.linkKind === 'invoice_settlement' || tx.linkKind === 'payroll_payment') {
      const linkedInv = tx.invoiceId ? invMap.get(tx.invoiceId) : undefined;
      if (tx.type === 'expense') {
        cashPaidTotal += tx.amount;
        const rowTitle =
          tx.linkKind === 'payroll_payment'
            ? 'پرداخت حقوق / مساعده'
            : linkedInv
              ? `پرداخت بابت فاکتور #${linkedInv.invoiceNumber || '—'}`
              : 'پرداخت وجه (علی‌الحساب / تسویه حساب)';
        rawRows.push({
          id: `tx_${tx.id}`,
          date: tx.date,
          kind: 'payment_cash',
          title: rowTitle,
          description: tx.description,
          debit: tx.amount,
          credit: 0,
          invoiceId: tx.invoiceId,
          payrollEntryId: tx.payrollEntryId,
        });
      } else if (tx.type === 'income') {
        cashReceivedTotal += tx.amount;
        const rowTitle = linkedInv
          ? `دریافت وجه بابت فاکتور #${linkedInv.invoiceNumber || '—'}`
          : 'دریافت وجه (علی‌الحساب / تسویه حساب)';
        rawRows.push({
          id: `tx_${tx.id}`,
          date: tx.date,
          kind: 'receipt_cash',
          title: rowTitle,
          description: tx.description,
          debit: 0,
          credit: tx.amount,
          invoiceId: tx.invoiceId,
        });
      }
    }
  }

  const kindOrder = (k: PersonLedgerKind): number => {
    if (k === 'purchase_invoice' || k === 'sale_invoice' || k === 'payroll_accrual') return 0;
    if (k === 'payment_cash' || k === 'receipt_cash') return 1;
    return 2;
  };
  rawRows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      kindOrder(a.kind) - kindOrder(b.kind) ||
      a.id.localeCompare(b.id)
  );

  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows: PersonLedgerRow[] = rawRows.map((r) => {
    totalDebit += r.debit;
    totalCredit += r.credit;
    running += r.credit - r.debit;
    return { ...r, runningBalance: running };
  });

  const netBalance = totalCredit - totalDebit;
  const status: 'creditor' | 'debtor' | 'settled' =
    netBalance > 0 ? 'creditor' : netBalance < 0 ? 'debtor' : 'settled';

  return {
    contactId,
    totalCredit,
    totalDebit,
    netBalance,
    status,
    payableAmount: netBalance > 0 ? netBalance : 0,
    receivableAmount: netBalance < 0 ? Math.abs(netBalance) : 0,
    purchaseInvoicesTotal,
    saleInvoicesTotal,
    payrollAccruedTotal,
    cashPaidTotal,
    cashReceivedTotal,
    activePayableChecksTotal,
    activeReceivableChecksTotal,
    rows,
  };
}

/**
 * Generates an exact Jalali installment schedule for a loan.
 * Splits principalAmount and totalInterest evenly across installmentCount, putting
 * any integer remainder on the final installment so totals sum with 100% precision.
 */
export function buildLoanInstallments(params: {
  loanId: string;
  firstDueDate: string;
  principalAmount: number;
  totalInterest: number;
  installmentCount: number;
  intervalMonths?: number;
}): LoanInstallment[] {
  const count = Math.max(1, Math.round(params.installmentCount || 1));
  const interval = Math.max(1, Math.round(params.intervalMonths || 1));
  const principalTotal = Math.max(0, Math.round(params.principalAmount || 0));
  const interestTotal = Math.max(0, Math.round(params.totalInterest || 0));

  const basePrincipal = Math.floor(principalTotal / count);
  const baseInterest = Math.floor(interestTotal / count);

  const firstParts = getJalaliParts(params.firstDueDate);
  const list: LoanInstallment[] = [];

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const principalShare = isLast ? principalTotal - basePrincipal * (count - 1) : basePrincipal;
    const interestShare = isLast ? interestTotal - baseInterest * (count - 1) : baseInterest;

    let dueDate = params.firstDueDate;
    if (firstParts && i > 0) {
      const shifted = shiftJalaliMonth(firstParts.year, firstParts.month, i * interval);
      // Clamp day to valid range for target Jalali month (29/30/31)
      const maxDay = shifted.month <= 6 ? 31 : shifted.month <= 11 ? 30 : 29;
      const clampedDay = Math.min(firstParts.day, maxDay);
      dueDate = getLocalDayKey(jalaliToGregorianDate(shifted.year, shifted.month, clampedDay));
    }

    list.push({
      id: `li_${params.loanId}_${i + 1}`,
      loanId: params.loanId,
      number: i + 1,
      dueDate,
      principalShare,
      interestShare,
      totalAmount: principalShare + interestShare,
      status: 'pending',
    });
  }

  return list;
}

export interface LoanSummary {
  loan: Loan;
  installments: LoanInstallment[];
  totalPayable: number;
  paidPrincipal: number;
  remainingPrincipal: number;
  paidInterest: number;
  remainingInterest: number;
  paidTotal: number;
  remainingTotal: number;
  paidCount: number;
  pendingCount: number;
  progressPct: number;
  nextDue?: LoanInstallment;
}

export function computeLoanSummary(loan: Loan, allInstallments: LoanInstallment[]): LoanSummary {
  const installments = allInstallments
    .filter((i) => i.loanId === loan.id)
    .sort((a, b) => a.number - b.number);

  const paid = installments.filter((i) => i.status === 'paid');
  const pending = installments.filter((i) => i.status === 'pending');

  const paidPrincipal = paid.reduce((s, i) => s + i.principalShare, 0);
  const paidInterest = paid.reduce((s, i) => s + i.interestShare, 0);
  const remainingPrincipal = Math.max(0, loan.principalAmount - paidPrincipal);
  const remainingInterest = Math.max(0, loan.totalInterest - paidInterest);
  const totalPayable = loan.principalAmount + loan.totalInterest;
  const paidTotal = paidPrincipal + paidInterest;
  const remainingTotal = remainingPrincipal + remainingInterest;
  const progressPct = totalPayable > 0 ? Math.min(100, Math.round((paidTotal / totalPayable) * 100)) : 100;

  return {
    loan,
    installments,
    totalPayable,
    paidPrincipal,
    remainingPrincipal,
    paidInterest,
    remainingInterest,
    paidTotal,
    remainingTotal,
    paidCount: paid.length,
    pendingCount: pending.length,
    progressPct,
    nextDue: pending[0],
  };
}

export interface UpcomingReminderItem {
  id: string;
  kind: 'check_payable' | 'check_receivable' | 'loan_installment';
  title: string;
  subtitle: string;
  dueDate: string;
  daysUntilDue: number;
  amount: number;
  overdue: boolean;
  targetView: 'checks' | 'loans';
  entityId: string;
}

function diffDaysIso(fromIso: string, toIso: string): number {
  const a = parseLocalIsoDate(fromIso);
  const b = parseLocalIsoDate(toIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 9999;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeUpcomingReminders(
  checks: CheckItem[],
  loans: Loan[],
  installments: LoanInstallment[],
  contacts: Contact[],
  settings: ReminderSettings,
  todayIso: string = getLocalDayKey(new Date())
): UpcomingReminderItem[] {
  if (!settings.enabled) return [];
  const leadDays = Math.max(0, Number(settings.leadDays ?? 2) || 0);
  const contactName = (id: string) => contacts.find((c) => c.id === id)?.fullName || 'شخص';
  const loanMap = new Map(loans.map((l) => [l.id, l]));

  const items: UpcomingReminderItem[] = [];

  for (const ch of checks) {
    if (ch.status !== 'pending') continue;
    const days = diffDaysIso(todayIso, ch.dueDate);
    if (days <= leadDays) {
      items.push({
        id: `rem_check_${ch.id}`,
        kind: ch.kind === 'payable' ? 'check_payable' : 'check_receivable',
        title:
          ch.kind === 'payable'
            ? `چک پرداختی #${ch.checkNumber} به ${contactName(ch.contactId)}`
            : `چک دریافتی #${ch.checkNumber} از ${contactName(ch.contactId)}`,
        subtitle:
          days < 0
            ? `${Math.abs(days)} روز گذشته از سررسید`
            : days === 0
              ? 'سررسید امروز'
              : `${days} روز تا سررسید`,
        dueDate: ch.dueDate,
        daysUntilDue: days,
        amount: ch.amount,
        overdue: days < 0,
        targetView: 'checks',
        entityId: ch.id,
      });
    }
  }

  for (const li of installments) {
    if (li.status !== 'pending') continue;
    const loan = loanMap.get(li.loanId);
    if (!loan || loan.status === 'paid_off') continue;
    const days = diffDaysIso(todayIso, li.dueDate);
    if (days <= leadDays) {
      items.push({
        id: `rem_loan_${li.id}`,
        kind: 'loan_installment',
        title: `قسط #${li.number} وام ${loan.title}`,
        subtitle:
          days < 0
            ? `${Math.abs(days)} روز گذشته از سررسید (${loan.lenderName})`
            : days === 0
              ? `سررسید امروز (${loan.lenderName})`
              : `${days} روز تا سررسید (${loan.lenderName})`,
        dueDate: li.dueDate,
        daysUntilDue: days,
        amount: li.totalAmount,
        overdue: days < 0,
        targetView: 'loans',
        entityId: loan.id,
      });
    }
  }

  return items.sort((a, b) => a.daysUntilDue - b.daysUntilDue || b.amount - a.amount);
}

// --- Monthly Detailed 3-Level Breakdown Report Engine ---

export interface BreakdownDetailItem {
  id: string;
  source: 'invoice' | 'payroll' | 'transaction';
  sequenceNumber?: number; // فاکتور شماره ۱، ۲، ۳ برای هر شخص در سرفصل
  date: string;
  title: string;
  description: string;
  amount: number;
  invoice?: Invoice;
  settlement?: InvoiceSettlementSummary;
  payrollEntry?: PayrollEntry;
  transaction?: Transaction;
}

export interface BreakdownPersonGroup {
  contactId: string;
  contactName: string;
  totalAmount: number;
  invoiceCount: number;
  items: BreakdownDetailItem[];
}

export interface BreakdownHeadingGroup {
  accountId: string;
  accountCode: string;
  accountName: string;
  module: 'income' | 'expense';
  totalAmount: number;
  sharePct: number;
  persons: BreakdownPersonGroup[];
}

export interface LaborHeadingBreakdown {
  accountId: string;
  accountCode: string;
  label: string;
  amount: number;
  count: number;
}

export interface MonthlyBreakdownReport {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  profitMarginPct: number;
  incomeHeadings: BreakdownHeadingGroup[];
  expenseHeadings: BreakdownHeadingGroup[];
  laborBreakdown: LaborHeadingBreakdown[];
  loanInterestTotal: number;
}

const FALLBACK_LABOR_LABELS: Record<PayrollEntryType, string> = {
  fixed_month: 'حقوق ثابت پرسنل',
  work_log: 'کارکرد پرسنل',
  daily_work: 'کارگری روزمزد',
  irrigation: 'آبگیری',
  group_labor: 'کارگری دسته‌جمعی',
};

/**
 * Builds the 3-level drill-down Monthly Detailed Breakdown Report:
 *   Level 1: Heading (e.g. سم و کود، حقوق و دستمزد، فروش پسته، هزینه سود وام)
 *   Level 2: Person under that heading (e.g. خانم مهندس قلیچی، مهندس ذوالفقاری، مهندس خسروی)
 *   Level 3: Numbered Invoices (فاکتور شماره ۱، ۲، ۳...) + Payroll entries + Regular transactions
 * Zero double-counting: ignores invoice_settlement, payroll_payment, check_clearing, loan_disbursement, loan_principal.
 */
export function buildMonthlyBreakdownReport(
  accounts: Account[],
  contacts: Contact[],
  transactions: Transaction[],
  invoices: Invoice[],
  payrollEntries: PayrollEntry[],
  checks: CheckItem[],
  options: { startDate?: string; endDate?: string } = {}
): MonthlyBreakdownReport {
  const { startDate, endDate } = options;
  const inRange = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);

  const accMap = new Map(accounts.map((a) => [a.id, a]));
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  type AccBucket = {
    accountId: string;
    module: 'income' | 'expense';
    persons: Map<string, BreakdownDetailItem[]>;
  };

  const buckets = new Map<string, AccBucket>();

  const pushItem = (
    module: 'income' | 'expense',
    accountId: string,
    contactId: string | undefined,
    item: BreakdownDetailItem
  ) => {
    const key = `${module}:${accountId}`;
    let b = buckets.get(key);
    if (!b) {
      b = { accountId, module, persons: new Map() };
      buckets.set(key, b);
    }
    const pKey = contactId || '__unassigned__';
    const arr = b.persons.get(pKey) || [];
    arr.push(item);
    b.persons.set(pKey, arr);
  };

  // 1. Invoices (Accrual)
  for (const inv of invoices) {
    if (!inRange(inv.date)) continue;
    const settlement = computeInvoiceSettlement(inv, transactions, checks);
    const mod: 'income' | 'expense' = inv.kind === 'sale' ? 'income' : 'expense';
    pushItem(mod, inv.accountId, inv.contactId, {
      id: `inv_${inv.id}`,
      source: 'invoice',
      date: inv.date,
      title: inv.invoiceNumber ? `فاکتور #${inv.invoiceNumber}` : 'فاکتور',
      description: inv.description,
      amount: inv.amount,
      invoice: inv,
      settlement,
    });
  }

  // 2. Payroll & Work-Logs (Accrual Expense — grouped by actual Chart of Accounts Heading)
  const laborHeadingMap = new Map<
    string,
    { accountId: string; accountCode: string; label: string; amount: number; count: number }
  >();
  for (const pe of payrollEntries) {
    if (!inRange(pe.date)) continue;
    const acc = accMap.get(pe.accountId);
    const headingLabel = acc?.name || FALLBACK_LABOR_LABELS[pe.entryType] || 'کارکرد پرسنل';
    const prev = laborHeadingMap.get(pe.accountId) || {
      accountId: pe.accountId,
      accountCode: acc?.code || '—',
      label: headingLabel,
      amount: 0,
      count: 0,
    };
    laborHeadingMap.set(pe.accountId, {
      ...prev,
      amount: prev.amount + pe.amount,
      count: prev.count + 1,
    });

    pushItem('expense', pe.accountId, pe.contactId, {
      id: `pe_${pe.id}`,
      source: 'payroll',
      date: pe.date,
      title: headingLabel,
      description: pe.description || `${pe.quantity} ${pe.unitLabel}`,
      amount: pe.amount,
      payrollEntry: pe,
    });
  }

  // 3. Regular operating transactions & Loan interest
  let loanInterestTotal = 0;
  for (const tx of transactions) {
    if (!inRange(tx.date)) continue;
    if (isOperatingIncomeTx(tx)) {
      pushItem('income', tx.accountId, tx.contactId, {
        id: `tx_${tx.id}`,
        source: 'transaction',
        date: tx.date,
        title: 'دریافت نقدی / بانکی',
        description: tx.description,
        amount: tx.amount,
        transaction: tx,
      });
    } else if (isOperatingExpenseTx(tx)) {
      if (tx.linkKind === 'loan_interest') loanInterestTotal += tx.amount;
      pushItem('expense', tx.accountId, tx.contactId, {
        id: `tx_${tx.id}`,
        source: 'transaction',
        date: tx.date,
        title: tx.linkKind === 'loan_interest' ? 'سود قسط وام' : 'پرداخت مستقیم هزینه',
        description: tx.description,
        amount: tx.amount,
        transaction: tx,
      });
    }
  }

  const finalize = (mod: 'income' | 'expense'): BreakdownHeadingGroup[] => {
    const groups: BreakdownHeadingGroup[] = [];
    for (const b of buckets.values()) {
      if (b.module !== mod) continue;
      const acc = accMap.get(b.accountId);
      const persons: BreakdownPersonGroup[] = [];
      for (const [pKey, rawItems] of b.persons.entries()) {
        rawItems.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
        let invSeq = 0;
        const numbered = rawItems.map((it) => {
          if (it.source === 'invoice') {
            invSeq += 1;
            return { ...it, sequenceNumber: invSeq };
          }
          return it;
        });
        const total = numbered.reduce((s, it) => s + it.amount, 0);
        const contactName =
          pKey === '__unassigned__'
            ? 'بدون طرف‌حساب مشخص'
            : contactMap.get(pKey)?.fullName || 'شخص حذف‌شده';
        persons.push({
          contactId: pKey,
          contactName,
          totalAmount: total,
          invoiceCount: invSeq,
          items: numbered,
        });
      }
      persons.sort((a, b) => b.totalAmount - a.totalAmount);
      const headingTotal = persons.reduce((s, p) => s + p.totalAmount, 0);
      groups.push({
        accountId: b.accountId,
        accountCode: acc?.code || '—',
        accountName: acc?.name || 'سرفصل نامشخص',
        module: mod,
        totalAmount: headingTotal,
        sharePct: 0,
        persons,
      });
    }
    const grand = groups.reduce((s, g) => s + g.totalAmount, 0);
    return groups
      .map((g) => ({
        ...g,
        sharePct: grand > 0 ? Math.round((g.totalAmount / grand) * 100) : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  };

  const incomeHeadings = finalize('income');
  const expenseHeadings = finalize('expense');
  const totalIncome = incomeHeadings.reduce((s, g) => s + g.totalAmount, 0);
  const totalExpense = expenseHeadings.reduce((s, g) => s + g.totalAmount, 0);
  const netProfit = totalIncome - totalExpense;
  const profitMarginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  const laborBreakdown: LaborHeadingBreakdown[] = [...laborHeadingMap.values()].sort(
    (a, b) => b.amount - a.amount
  );

  return {
    totalIncome,
    totalExpense,
    netProfit,
    profitMarginPct,
    incomeHeadings,
    expenseHeadings,
    laborBreakdown,
    loanInterestTotal,
  };
}
