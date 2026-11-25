import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  Account,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  Loan,
  LoanInstallment,
  PayrollEntry,
  Product,
  ReminderSettings,
  Transaction,
  Warehouse,
} from '../types';
import {
  DAILY_LABOR_ACCOUNT_ID,
  FIXED_SALARY_ACCOUNT_ID,
  IRRIGATION_ACCOUNT_ID,
  LABOR_GROUP_ACCOUNT_ID,
  LOAN_INTEREST_ACCOUNT_ID,
  PERSONNEL_GROUP_ID,
} from '../constants';
import {
  filterPersonnelContacts,
  isPersonnelContact,
  suggestUnitForHeadingName,
} from './contactStats';
import {
  buildLoanInstallments,
  buildMonthlyBreakdownReport,
  computeInvoiceSettlement,
  computeLoanSummary,
  computePersonBalance,
  computeUpcomingReminders,
} from './accrualEngine';
import {
  computeBankBalance,
  totalBankBalance,
  totalIncome,
  totalExpenses,
  computeHeadingBalance,
} from './accountBalance';
import { buildAccountLedger } from './accountLedger';
import {
  buildPersonsReport,
  buildTreasuryReport,
  buildTrialBalance,
} from './financialReports';
import {
  formatJalaliLong,
  formatJalaliShort,
  getJalaliMonthGrid,
  getJalaliMonthKey,
  getLocalDayKey,
  getPreviousJalaliMonthKey,
  isInJalaliMonth,
  isWithinLastDays,
  jalaliToGregorianDate,
  parseLocalIsoDate,
  shiftJalaliMonth,
} from './jalaliPeriod';
import { monthTrend, sparklineSeries } from './dashboardTrends';
import { brochureSections, filterBrochureSections } from '../components/brochure/brochureSections';
import { viewToBrochureId } from './pageHelp';
import {
  computeInvoiceTotals,
  computeLineTotal,
  computeProductCardex,
  computeProductStock,
  computeProductStockByWarehouse,
  computeWarehouseSummary,
  isLowStock,
} from './inventoryEngine';

const sampleAccounts: Account[] = [
  { id: 'acc_income', code: '4', name: 'درآمد', module: 'income', kind: 'group', parentId: null, isSystem: true, isActive: true },
  { id: 'acc_expense', code: '5', name: 'هزینه', module: 'expense', kind: 'group', parentId: null, isSystem: true, isActive: true },
  { id: 'acc_bank', code: '1', name: 'بانک‌ها و صندوق', module: 'bank', kind: 'group', parentId: null, isSystem: true, isActive: true },
  { id: 'inc_sales', code: '401', name: 'فروش پسته اکبری', module: 'income', kind: 'postable', parentId: 'acc_income', isActive: true },
  { id: 'inc_kernel', code: '402', name: 'فروش مغز درجه یک', module: 'income', kind: 'postable', parentId: 'acc_income', isActive: true },
  { id: 'exp_salary', code: '501', name: 'حقوق و دستمزد', module: 'expense', kind: 'postable', parentId: 'acc_expense', isActive: true },
  { id: 'exp_pack', code: '502', name: 'بسته‌بندی و ارسال', module: 'expense', kind: 'postable', parentId: 'acc_expense', isActive: true },
  { id: 'bank_mellat', code: '101', name: 'بانک ملت', module: 'bank', kind: 'postable', parentId: 'acc_bank', openingBalance: 500_000_000, isActive: true },
  { id: 'bank_saderat', code: '102', name: 'بانک صادرات', module: 'bank', kind: 'postable', parentId: 'acc_bank', openingBalance: 250_000_000, isActive: true },
  { id: 'bank_cash', code: '103', name: 'صندوق نقدی', module: 'bank', kind: 'postable', parentId: 'acc_bank', openingBalance: 35_000_000, isActive: true },
];

const sampleTransactions: Transaction[] = [
  {
    id: 'tx_1',
    type: 'income',
    amount: 120_000_000,
    date: '2026-11-22',
    description: 'فروش محموله پسته اکبری',
    accountId: 'inc_sales',
    bankAccountId: 'bank_mellat',
  },
  {
    id: 'tx_2',
    type: 'income',
    amount: 45_000_000,
    date: '2026-11-20',
    description: 'فروش مغز پسته',
    accountId: 'inc_kernel',
    bankAccountId: 'bank_saderat',
  },
  {
    id: 'tx_3',
    type: 'expense',
    amount: 30_000_000,
    date: '2026-11-22',
    description: 'پرداخت حقوق کارگاه',
    accountId: 'exp_salary',
    bankAccountId: 'bank_mellat',
  },
  {
    id: 'tx_4',
    type: 'expense',
    amount: 12_500_000,
    date: '2026-10-25',
    description: 'کارتن و لیبل صادراتی',
    accountId: 'exp_pack',
    bankAccountId: 'bank_cash',
  },
  {
    id: 'tx_5',
    type: 'income',
    amount: 60_000_000,
    date: '2026-10-26',
    description: 'فروش ماه قبل',
    accountId: 'inc_sales',
    bankAccountId: 'bank_mellat',
  },
];

test('account balances and totals match exact arithmetic', () => {
  const mellat = sampleAccounts.find((a) => a.id === 'bank_mellat')!;
  const saderat = sampleAccounts.find((a) => a.id === 'bank_saderat')!;
  const cash = sampleAccounts.find((a) => a.id === 'bank_cash')!;

  // 500M + 120M - 30M + 60M = 650M
  assert.equal(computeBankBalance(mellat, sampleTransactions), 650_000_000);
  // 250M + 45M = 295M
  assert.equal(computeBankBalance(saderat, sampleTransactions), 295_000_000);
  // 35M - 12.5M = 22.5M
  assert.equal(computeBankBalance(cash, sampleTransactions), 22_500_000);

  // Total across all banks = 650M + 295M + 22.5M = 967.5M
  assert.equal(totalBankBalance(sampleAccounts, sampleTransactions), 967_500_000);

  // Income = 120M + 45M + 60M = 225M
  assert.equal(totalIncome(sampleAccounts, sampleTransactions), 225_000_000);
  // Expenses = 30M + 12.5M = 42.5M
  assert.equal(totalExpenses(sampleAccounts, sampleTransactions), 42_500_000);

  // Group heading rollup equals individual sums
  const bankGroup = sampleAccounts.find((a) => a.id === 'acc_bank')!;
  const incGroup = sampleAccounts.find((a) => a.id === 'acc_income')!;
  assert.equal(computeHeadingBalance(bankGroup, sampleAccounts, sampleTransactions), 967_500_000);
  assert.equal(computeHeadingBalance(incGroup, sampleAccounts, sampleTransactions), 225_000_000);
});

test('account ledger preserves accounting equation: opening + debit - credit = closing', () => {
  const mellat = sampleAccounts.find((a) => a.id === 'bank_mellat')!;
  const full = buildAccountLedger(mellat, sampleAccounts, sampleTransactions);
  assert.equal(full.openingBalance, 500_000_000);
  assert.equal(full.turnoverDebit, 180_000_000);
  assert.equal(full.turnoverCredit, 30_000_000);
  assert.equal(full.closingBalance, 650_000_000);
  assert.equal(
    full.openingBalance + full.turnoverDebit - full.turnoverCredit,
    full.closingBalance
  );

  // Period filtered ledger rolls prior transactions into openingBalance
  const filtered = buildAccountLedger(mellat, sampleAccounts, sampleTransactions, {
    startDate: '2026-11-01',
    endDate: '2026-11-30',
  });
  // Prior: 500M opening + 60M tx_5 = 560M
  assert.equal(filtered.openingBalance, 560_000_000);
  assert.equal(filtered.turnoverDebit, 120_000_000);
  assert.equal(filtered.turnoverCredit, 30_000_000);
  assert.equal(filtered.closingBalance, 650_000_000);
  assert.equal(filtered.rows.length, 2);
});

test('jalaliPeriod parses ISO dates without UTC day shift and computes Jalali month keys', () => {
  const d = parseLocalIsoDate('2026-11-22');
  assert.equal(getLocalDayKey(d), '2026-11-22');
  assert.equal(getLocalDayKey('2026-11-22'), '2026-11-22');

  // 2026-11-22 is Azar 1, 1405 (1405-09); 2026-11-20 is Aban 29, 1405 (1405-08)
  const azarKey = getJalaliMonthKey('2026-11-22');
  const prevKey = getPreviousJalaliMonthKey(parseLocalIsoDate('2026-11-22'));
  assert.equal(azarKey, '1405-09');
  assert.equal(prevKey, '1405-08');
  assert.equal(isInJalaliMonth('2026-11-22', azarKey), true);
  assert.equal(isInJalaliMonth('2026-11-20', prevKey), true);
  assert.equal(isInJalaliMonth('2026-10-26', prevKey), true);

  // Rolling 30 days window
  const ref = parseLocalIsoDate('2026-11-22');
  assert.equal(isWithinLastDays('2026-11-22', 30, ref), true);
  assert.equal(isWithinLastDays('2026-10-24', 30, ref), true);
  assert.equal(isWithinLastDays('2026-10-20', 30, ref), false);
});

test('monthTrend and sparklineSeries use Jalali months and local days accurately', () => {
  const ref = parseLocalIsoDate('2026-11-22'); // 1405-09-01
  const incTrend = monthTrend(sampleTransactions, 'income', ref);
  // Current Jalali month (1405-09): tx_1 = 120M
  // Previous Jalali month (1405-08): tx_2 (45M) + tx_5 (60M) = 105M
  assert.equal(incTrend.current, 120_000_000);
  assert.equal(incTrend.previous, 105_000_000);
  assert.equal(incTrend.up, true);
  assert.equal(incTrend.pct, 14); // round((15/105)*100) = 14

  const series = sparklineSeries(sampleTransactions, 'income', 7, ref);
  assert.equal(series.length, 7);
  // Index 6 is 2026-11-22 (120M -> 1.0), index 4 is 2026-11-20 (45M -> 0.375)
  assert.equal(series[6], 1);
  assert.equal(series[4], 45_000_000 / 120_000_000);
  assert.equal(series[5], 0);
});

test('bank-to-bank transfers preserve total balance, keep income/expense unchanged, and update both ledgers', () => {
  const transferTx: Transaction = {
    id: 'tx_transfer_1',
    type: 'transfer',
    amount: 50_000_000,
    date: '2026-11-22',
    description: 'انتقال وجه جهت تسویه تامین‌کننده',
    bankAccountId: 'bank_mellat', // source
    accountId: 'bank_saderat', // destination
  };
  const withTransfer = [...sampleTransactions, transferTx];

  const mellat = sampleAccounts.find((a) => a.id === 'bank_mellat')!;
  const saderat = sampleAccounts.find((a) => a.id === 'bank_saderat')!;

  // Source bank decreases by 50M: 650M -> 600M
  assert.equal(computeBankBalance(mellat, withTransfer), 600_000_000);
  // Destination bank increases by 50M: 295M -> 345M
  assert.equal(computeBankBalance(saderat, withTransfer), 345_000_000);

  // Total across all banks is strictly invariant: still 967.5M
  assert.equal(totalBankBalance(sampleAccounts, withTransfer), 967_500_000);

  // Income and expense totals are strictly unaffected by internal transfers
  assert.equal(totalIncome(sampleAccounts, withTransfer), 225_000_000);
  assert.equal(totalExpenses(sampleAccounts, withTransfer), 42_500_000);

  // Source bank ledger reflects outgoing credit; destination bank ledger reflects incoming debit
  const mellatLedger = buildAccountLedger(mellat, sampleAccounts, withTransfer);
  assert.equal(mellatLedger.closingBalance, 600_000_000);
  assert.equal(mellatLedger.turnoverCredit, 80_000_000); // 30M expense + 50M transfer out

  const saderatLedger = buildAccountLedger(saderat, sampleAccounts, withTransfer);
  assert.equal(saderatLedger.closingBalance, 345_000_000);
  assert.equal(saderatLedger.turnoverDebit, 95_000_000); // 45M income + 50M transfer in
});

test('buildTrialBalance computes 4-column trial balance and P&L without transfer inflation', () => {
  const transferTx: Transaction = {
    id: 'tx_tr_tb',
    type: 'transfer',
    amount: 40_000_000,
    date: '2026-11-22',
    description: 'انتقال داخلی',
    bankAccountId: 'bank_mellat',
    accountId: 'bank_saderat',
  };
  const tb = buildTrialBalance(sampleAccounts, [...sampleTransactions, transferTx]);

  // P&L totals must ignore internal bank transfer
  assert.equal(tb.totalIncome, 225_000_000);
  assert.equal(tb.totalExpense, 42_500_000);
  assert.equal(tb.netProfit, 182_500_000);
  assert.equal(tb.profitMarginPct, 81); // round(182.5/225 * 100) = 81

  // Double-entry invariant: total turnover debit === total turnover credit across all accounts
  assert.equal(tb.totalTurnoverDebit, tb.totalTurnoverCredit);
});

test('buildPersonsReport aggregates contacts & groups cleanly and excludes transfers', () => {
  const groups: ContactGroup[] = [
    { id: 'g1', name: 'مشتریان' },
    { id: 'g2', name: 'پرسنل' },
  ];
  const contacts: Contact[] = [
    { id: 'c1', groupId: 'g1', fullName: 'حاج آقا احمد' },
    { id: 'c2', groupId: 'g2', fullName: 'حسن جواهری' },
  ];
  const txs: Transaction[] = [
    { ...sampleTransactions[0], contactId: 'c1' },
    { ...sampleTransactions[2], contactId: 'c2' },
    {
      id: 'tx_tr_ignore',
      type: 'transfer',
      amount: 99_000_000,
      date: '2026-11-22',
      description: 'انتقال',
      bankAccountId: 'bank_mellat',
      accountId: 'bank_saderat',
      contactId: 'c1',
    },
  ];
  const rep = buildPersonsReport(contacts, groups, txs);
  assert.equal(rep.totalIncome, 120_000_000);
  assert.equal(rep.totalExpense, 30_000_000);
  assert.equal(rep.totalNet, 90_000_000);
  assert.equal(rep.activeCount, 2);
  assert.equal(rep.groupSummaries.length, 2);
});

test('buildTreasuryReport summarizes bank cashflows and inter-bank transfer ledger accurately', () => {
  const transferTx: Transaction = {
    id: 'tx_tr_treasury',
    type: 'transfer',
    amount: 25_000_000,
    date: '2026-11-22',
    description: 'تامین موجودی صادرات',
    bankAccountId: 'bank_mellat',
    accountId: 'bank_saderat',
  };
  const tr = buildTreasuryReport(sampleAccounts, [...sampleTransactions, transferTx]);
  assert.equal(tr.totalClosing, 967_500_000);
  assert.equal(tr.transfers.length, 1);
  assert.equal(tr.totalTransfersAmount, 25_000_000);
  const mellatRow = tr.banks.find((b) => b.account.id === 'bank_mellat')!;
  const saderatRow = tr.banks.find((b) => b.account.id === 'bank_saderat')!;
  assert.equal(mellatRow.transferOut, 25_000_000);
  assert.equal(saderatRow.transferIn, 25_000_000);
});

test('getJalaliMonthGrid renders exact Jalali days 1..29/30/31 with leap years and zero UTC shift', () => {
  // Azar 1405: 30 days starting strictly at day 1 (2026-11-22) and ending at day 30
  const azar1405 = getJalaliMonthGrid(1405, 9);
  assert.equal(azar1405.daysInMonth, 30);
  assert.equal(azar1405.days[0].day, 1);
  assert.equal(azar1405.days[0].iso, '2026-11-22');
  assert.equal(azar1405.days[29].day, 30);
  assert.equal(azar1405.days[1].iso, '2026-11-23');
  // Every day must be strictly sequential 1..30 (never 10..30..1..9 Gregorian wrap)
  azar1405.days.forEach((d, idx) => {
    assert.equal(d.day, idx + 1);
    assert.equal(d.month, 9);
    assert.equal(d.year, 1405);
  });

  // Farvardin 1405: 31 days
  const farvardin1405 = getJalaliMonthGrid(1405, 1);
  assert.equal(farvardin1405.daysInMonth, 31);
  assert.equal(farvardin1405.days[0].day, 1);
  assert.equal(farvardin1405.days[30].day, 31);

  // Leap year check: Esfand 1403 has 30 days; Esfand 1404 has 29 days
  assert.equal(getJalaliMonthGrid(1403, 12).daysInMonth, 30);
  assert.equal(getJalaliMonthGrid(1404, 12).daysInMonth, 29);

  // Month shifting across year boundary
  assert.deepEqual(shiftJalaliMonth(1405, 1, -1), { year: 1404, month: 12 });
  assert.deepEqual(shiftJalaliMonth(1405, 12, 1), { year: 1406, month: 1 });

  // Exact bijection & timezone-safe formatting (2026-11-23 -> ۲ آذر ۱۴۰۵, never shifted to ۱ آذر)
  assert.equal(getLocalDayKey(jalaliToGregorianDate(1405, 9, 2)), '2026-11-23');
  assert.equal(formatJalaliLong('2026-11-23'), '۲ آذر ۱۴۰۵');
  assert.equal(formatJalaliShort('2026-11-23'), '۱۴۰۵/۰۹/۰۲');
});

test('filterBrochureSections and viewToBrochureId cover all 10 redesigned accounting chapters', () => {
  assert.equal(filterBrochureSections('').length, 10);
  assert.equal(filterBrochureSections('   ').length, brochureSections.length);

  const transferHits = filterBrochureSections('انتقال');
  assert.ok(transferHits.some((s) => s.id === 'transfers'));

  const backupHits = filterBrochureSections('بکاپ');
  assert.ok(backupHits.some((s) => s.id === 'backup'));

  const arabicVariantHits = filterBrochureSections('كسب');
  assert.ok(arabicVariantHits.length > 0);

  assert.equal(filterBrochureSections('عبارت‌ناموجود۱۲۳۴۵').length, 0);

  const validIds = new Set(brochureSections.map((s) => s.id));
  assert.equal(viewToBrochureId('transfers'), 'transfers');
  assert.equal(viewToBrochureId('chartOfAccounts'), 'chartOfAccounts');
  assert.equal(viewToBrochureId('login'), 'dashboard');
  for (const v of [
    'dashboard',
    'income',
    'expense',
    'transfers',
    'banks',
    'persons',
    'chartOfAccounts',
    'reports',
    'access',
    'settingsBackup',
    'login',
  ]) {
    const target = viewToBrochureId(v);
    assert.ok(
      target && validIds.has(target as any),
      `Expected valid brochure target for ${v}, got ${target}`
    );
  }
});



const agriAccounts: Account[] = [
  ...sampleAccounts,
  {
    id: LABOR_GROUP_ACCOUNT_ID,
    code: '201',
    name: 'هزینه‌های نیروی انسانی و کارکرد',
    module: 'expense',
    kind: 'group',
    parentId: 'acc_expense',
    isSystem: true,
    isActive: true,
  },
  {
    id: FIXED_SALARY_ACCOUNT_ID,
    code: '20101',
    name: 'حقوق ثابت پرسنل',
    module: 'expense',
    kind: 'postable',
    parentId: LABOR_GROUP_ACCOUNT_ID,
    isActive: true,
  },
  {
    id: DAILY_LABOR_ACCOUNT_ID,
    code: '20102',
    name: 'کارگری روزمزد',
    module: 'expense',
    kind: 'postable',
    parentId: LABOR_GROUP_ACCOUNT_ID,
    isActive: true,
  },
  {
    id: IRRIGATION_ACCOUNT_ID,
    code: '20103',
    name: 'آبگیری',
    module: 'expense',
    kind: 'postable',
    parentId: LABOR_GROUP_ACCOUNT_ID,
    isActive: true,
  },
  {
    id: 'exp_pesticide',
    code: '503',
    name: 'سم و کود',
    module: 'expense',
    kind: 'postable',
    parentId: 'acc_expense',
    isActive: true,
  },
  {
    id: LOAN_INTEREST_ACCOUNT_ID,
    code: '299',
    name: 'هزینه سود وام',
    module: 'expense',
    kind: 'postable',
    parentId: 'acc_expense',
    isSystem: true,
    isActive: true,
  },
];

test('purchase invoice + partial settlements + 2nd invoice match Ghelichi 2B scenario with zero double-counting', () => {
  // خانم مهندس قلیچی: فاکتور ۱ دو میلیارد، پرداخت ۵۰۰م + ۲۰۰م، فاکتور ۲ پانصد میلیون
  const invoices: Invoice[] = [
    {
      id: 'inv_g1',
      kind: 'purchase',
      invoiceNumber: '۱۰۰۱',
      date: '2026-11-22',
      contactId: 'c_ghelichi',
      accountId: 'exp_pesticide',
      amount: 2_000_000_000,
      description: 'سم و کود نوبت اول',
    },
    {
      id: 'inv_g2',
      kind: 'purchase',
      invoiceNumber: '۱۰۰۲',
      date: '2026-11-23',
      contactId: 'c_ghelichi',
      accountId: 'exp_pesticide',
      amount: 500_000_000,
      description: 'سم و کود نوبت دوم',
    },
  ];
  const txs: Transaction[] = [
    {
      id: 'tx_s1',
      type: 'expense',
      amount: 500_000_000,
      date: '2026-11-22',
      description: 'پرداخت علی‌الحساب فاکتور ۱۰۰۱',
      accountId: 'exp_pesticide',
      bankAccountId: 'bank_mellat',
      contactId: 'c_ghelichi',
      linkKind: 'invoice_settlement',
      invoiceId: 'inv_g1',
    },
    {
      id: 'tx_s2',
      type: 'expense',
      amount: 200_000_000,
      date: '2026-11-23',
      description: 'پرداخت دوم فاکتور ۱۰۰۱',
      accountId: 'exp_pesticide',
      bankAccountId: 'bank_mellat',
      contactId: 'c_ghelichi',
      linkKind: 'invoice_settlement',
      invoiceId: 'inv_g1',
    },
  ];

  // Invoice #1 settlement: 700M paid, 1.3B remaining, partial
  const s1 = computeInvoiceSettlement(invoices[0], txs, []);
  assert.equal(s1.paidCash, 700_000_000);
  assert.equal(s1.remaining, 1_300_000_000);
  assert.equal(s1.status, 'partial');

  // Person balance: 2.5B invoices - 700M paid = 1.8B creditor (طلبکار از ما)
  const bal = computePersonBalance('c_ghelichi', invoices, [], [], txs);
  assert.equal(bal.status, 'creditor');
  assert.equal(bal.payableAmount, 1_800_000_000);
  assert.equal(bal.receivableAmount, 0);

  // Bank decreased strictly by cash paid (500M opening - 700M = -200M)
  const mellat = agriAccounts.find((a) => a.id === 'bank_mellat')!;
  assert.equal(computeBankBalance(mellat, txs), -200_000_000);

  // Operating expense equals strictly 2.5B (invoices ONLY; zero double-counting from settlements!)
  assert.equal(totalExpenses(agriAccounts, txs, invoices, []), 2_500_000_000);
  const tb = buildTrialBalance(agriAccounts, txs, { invoices, payrollEntries: [] });
  assert.equal(tb.totalExpense, 2_500_000_000);
});

test('sale invoice + partial receipts match pistachio buyer 200M scenario', () => {
  const invoices: Invoice[] = [
    {
      id: 'inv_sale1',
      kind: 'sale',
      invoiceNumber: '۲۰۰۱',
      date: '2026-11-22',
      contactId: 'c_buyer',
      accountId: 'inc_sales',
      amount: 200_000_000,
      description: 'فروش پسته فله',
    },
  ];
  const txs: Transaction[] = [
    {
      id: 'tx_r1',
      type: 'income',
      amount: 50_000_000,
      date: '2026-11-22',
      description: 'دریافت اول',
      accountId: 'inc_sales',
      bankAccountId: 'bank_mellat',
      contactId: 'c_buyer',
      linkKind: 'invoice_settlement',
      invoiceId: 'inv_sale1',
    },
    {
      id: 'tx_r2',
      type: 'income',
      amount: 30_000_000,
      date: '2026-11-23',
      description: 'دریافت دوم',
      accountId: 'inc_sales',
      bankAccountId: 'bank_mellat',
      contactId: 'c_buyer',
      linkKind: 'invoice_settlement',
      invoiceId: 'inv_sale1',
    },
  ];

  // Buyer owes us 120M (debtor / بدهکار به ما)
  const bal = computePersonBalance('c_buyer', invoices, [], [], txs);
  assert.equal(bal.status, 'debtor');
  assert.equal(bal.receivableAmount, 120_000_000);

  // Bank increased by 80M (500M -> 580M)
  const mellat = agriAccounts.find((a) => a.id === 'bank_mellat')!;
  assert.equal(computeBankBalance(mellat, txs), 580_000_000);

  // Operating income strictly 200M (zero double-counting!)
  assert.equal(totalIncome(agriAccounts, txs, invoices), 200_000_000);
});

test('payroll fixed monthly salary (Morteza 30M/mo) + advance + daily/irrigation labor math', () => {
  const entries: PayrollEntry[] = [
    {
      id: 'pe_m1',
      contactId: 'c_morteza',
      accountId: 'exp_salary',
      entryType: 'fixed_month',
      date: '2026-10-25',
      jalaliYear: 1405,
      jalaliMonth: 8,
      quantity: 1,
      unitLabel: 'ماه',
      unitRate: 30_000_000,
      amount: 30_000_000,
      description: 'حقوق آبان ۱۴۰۵',
    },
    {
      id: 'pe_m2',
      contactId: 'c_morteza',
      accountId: 'exp_salary',
      entryType: 'fixed_month',
      date: '2026-11-22',
      jalaliYear: 1405,
      jalaliMonth: 9,
      quantity: 1,
      unitLabel: 'ماه',
      unitRate: 30_000_000,
      amount: 30_000_000,
      description: 'حقوق آذر ۱۴۰۵',
    },
    {
      id: 'pe_w1',
      contactId: 'c_worker',
      accountId: 'exp_salary',
      entryType: 'irrigation',
      date: '2026-11-22',
      quantity: 1,
      unitLabel: 'شبانه‌روز',
      unitRate: 1_000_000,
      amount: 1_000_000,
      description: 'یک شبانه‌روز آبگیری',
    },
    {
      id: 'pe_w2',
      contactId: 'c_worker',
      accountId: 'exp_salary',
      entryType: 'daily_work',
      date: '2026-11-23',
      quantity: 2,
      unitLabel: 'روز',
      unitRate: 800_000,
      amount: 1_600_000,
      description: 'دو روز کارگری',
    },
  ];
  const txs: Transaction[] = [
    {
      id: 'tx_pm1',
      type: 'expense',
      amount: 30_000_000,
      date: '2026-10-28',
      description: 'پرداخت حقوق آبان',
      accountId: 'exp_salary',
      bankAccountId: 'bank_mellat',
      contactId: 'c_morteza',
      linkKind: 'payroll_payment',
    },
    {
      id: 'tx_pm2',
      type: 'expense',
      amount: 10_000_000,
      date: '2026-11-22',
      description: 'علی‌الحساب حقوق آذر',
      accountId: 'exp_salary',
      bankAccountId: 'bank_mellat',
      contactId: 'c_morteza',
      linkKind: 'payroll_payment',
    },
    {
      id: 'tx_pw1',
      type: 'expense',
      amount: 2_000_000,
      date: '2026-11-23',
      description: 'پرداخت کارکرد کارگر',
      accountId: 'exp_salary',
      bankAccountId: 'bank_cash',
      contactId: 'c_worker',
      linkKind: 'payroll_payment',
    },
  ];

  // Morteza: 60M accrued - 40M paid = 20M creditor
  const m1 = computePersonBalance('c_morteza', [], entries, [], txs);
  assert.equal(m1.status, 'creditor');
  assert.equal(m1.payableAmount, 20_000_000);

  // Pay Morteza 25M more -> he now owes 5M advance (debtor / مساعده)
  const withAdvance: Transaction[] = [
    ...txs,
    {
      id: 'tx_pm3',
      type: 'expense',
      amount: 25_000_000,
      date: '2026-11-23',
      description: 'پرداخت و مساعده',
      accountId: 'exp_salary',
      bankAccountId: 'bank_mellat',
      contactId: 'c_morteza',
      linkKind: 'payroll_payment',
    },
  ];
  const m2 = computePersonBalance('c_morteza', [], entries, [], withAdvance);
  assert.equal(m2.status, 'debtor');
  assert.equal(m2.receivableAmount, 5_000_000);

  // Daily/irrigation worker: 1M + 1.6M = 2.6M accrued - 2M paid = 600k creditor
  const wBal = computePersonBalance('c_worker', [], entries, [], txs);
  assert.equal(wBal.status, 'creditor');
  assert.equal(wBal.payableAmount, 600_000);

  // Total payroll expense = 62.6M (zero double counting from payroll_payment txs)
  assert.equal(totalExpenses(agriAccounts, withAdvance, [], entries), 62_600_000);
});

test('check lifecycle: issue reduces person balance only, clear updates bank only, bounce reverses person balance', () => {
  const inv: Invoice = {
    id: 'inv_chk',
    kind: 'purchase',
    invoiceNumber: '۱۱۰',
    date: '2026-11-22',
    contactId: 'c_ghelichi',
    accountId: 'exp_pesticide',
    amount: 1_800_000_000,
    description: 'مانده فاکتور',
  };
  const pendingCheck: CheckItem = {
    id: 'chk_500m',
    kind: 'payable',
    checkNumber: '۹۸۷۶۵۴',
    amount: 500_000_000,
    issueDate: '2026-11-22',
    dueDate: '2026-12-22',
    contactId: 'c_ghelichi',
    bankAccountId: 'bank_mellat',
    invoiceId: 'inv_chk',
    status: 'pending',
    description: 'چک ۱ ماهه',
  };
  const mellat = agriAccounts.find((a) => a.id === 'bank_mellat')!;

  // Step 1: Issued (pending) -> person balance drops 1.8B -> 1.3B, bank UNCHANGED (500M)
  assert.equal(computePersonBalance('c_ghelichi', [inv], [], [pendingCheck], []).payableAmount, 1_300_000_000);
  assert.equal(computeBankBalance(mellat, []), 500_000_000);

  // Step 2: Cleared -> bank drops 500M -> 0 via check_clearing tx, person balance STAYS 1.3B (zero double count!)
  const clearedCheck: CheckItem = {
    ...pendingCheck,
    status: 'cleared',
    settledDate: '2026-12-22',
    clearedTxId: 'tx_clr_1',
  };
  const clearTx: Transaction = {
    id: 'tx_clr_1',
    type: 'expense',
    amount: 500_000_000,
    date: '2026-12-22',
    description: 'پاس شدن چک ۹۸۷۶۵۴',
    accountId: 'exp_pesticide',
    bankAccountId: 'bank_mellat',
    contactId: 'c_ghelichi',
    linkKind: 'check_clearing',
    checkId: 'chk_500m',
  };
  assert.equal(computeBankBalance(mellat, [clearTx]), 0);
  assert.equal(computePersonBalance('c_ghelichi', [inv], [], [clearedCheck], [clearTx]).payableAmount, 1_300_000_000);

  // Step 3: Second check 100M issued then bounced -> person balance rebounds +100M, bank untouched
  const bouncedCheck: CheckItem = {
    id: 'chk_100m',
    kind: 'payable',
    checkNumber: '۹۸۷۶۵۵',
    amount: 100_000_000,
    issueDate: '2026-11-23',
    dueDate: '2026-12-25',
    contactId: 'c_ghelichi',
    bankAccountId: 'bank_mellat',
    invoiceId: 'inv_chk',
    status: 'bounced',
    description: 'چک برگشتی',
  };
  assert.equal(
    computePersonBalance('c_ghelichi', [inv], [], [clearedCheck, bouncedCheck], [clearTx]).payableAmount,
    1_300_000_000
  );
  assert.equal(computeBankBalance(mellat, [clearTx]), 0);
});

test('loan disbursement, installment payment, and early payoff split principal vs loan interest cleanly', () => {
  const loan: Loan = {
    id: 'loan_1',
    title: 'وام بانک کشاورزی',
    lenderName: 'بانک کشاورزی',
    bankAccountId: 'bank_mellat',
    interestAccountId: LOAN_INTEREST_ACCOUNT_ID,
    principalAmount: 2_000_000_000,
    totalInterest: 500_000_000,
    installmentCount: 10,
    intervalMonths: 1,
    startDate: '2026-11-22',
    firstDueDate: '2026-12-22',
    disbursementTxId: 'tx_loan_disb',
    status: 'active',
  };
  const schedule = buildLoanInstallments({
    loanId: loan.id,
    firstDueDate: loan.firstDueDate,
    principalAmount: loan.principalAmount,
    totalInterest: loan.totalInterest,
    installmentCount: loan.installmentCount,
    intervalMonths: loan.intervalMonths,
  });
  assert.equal(schedule.length, 10);
  assert.equal(schedule.reduce((s, i) => s + i.principalShare, 0), 2_000_000_000);
  assert.equal(schedule.reduce((s, i) => s + i.interestShare, 0), 500_000_000);

  // Disbursement tx: Bank increases +2B (500M -> 2.5B), P&L income stays 0!
  const disbTx: Transaction = {
    id: 'tx_loan_disb',
    type: 'income',
    amount: 2_000_000_000,
    date: '2026-11-22',
    description: 'واریز اصل وام',
    accountId: 'inc_sales',
    bankAccountId: 'bank_mellat',
    linkKind: 'loan_disbursement',
    loanId: 'loan_1',
  };
  const mellat = agriAccounts.find((a) => a.id === 'bank_mellat')!;
  assert.equal(computeBankBalance(mellat, [disbTx]), 2_500_000_000);
  assert.equal(totalIncome(agriAccounts, [disbTx]), 0);

  // Pay installment #1 (200M principal + 50M interest)
  const inst1 = schedule[0];
  const paidSchedule: LoanInstallment[] = schedule.map((i, idx) =>
    idx === 0
      ? {
          ...i,
          status: 'paid',
          paidDate: '2026-12-22',
          principalTxId: 'tx_lp_1',
          interestTxId: 'tx_li_1',
        }
      : i
  );
  const txsAfter1: Transaction[] = [
    disbTx,
    {
      id: 'tx_lp_1',
      type: 'expense',
      amount: inst1.principalShare,
      date: '2026-12-22',
      description: 'اصل قسط ۱',
      accountId: LOAN_INTEREST_ACCOUNT_ID,
      bankAccountId: 'bank_mellat',
      linkKind: 'loan_principal',
      loanId: 'loan_1',
      loanInstallmentId: inst1.id,
    },
    {
      id: 'tx_li_1',
      type: 'expense',
      amount: inst1.interestShare,
      date: '2026-12-22',
      description: 'سود قسط ۱',
      accountId: LOAN_INTEREST_ACCOUNT_ID,
      bankAccountId: 'bank_mellat',
      linkKind: 'loan_interest',
      loanId: 'loan_1',
      loanInstallmentId: inst1.id,
    },
  ];

  // Bank decreased by 250M (2.5B -> 2.25B), remaining principal = 1.8B, P&L expense = ONLY 50M!
  assert.equal(computeBankBalance(mellat, txsAfter1), 2_250_000_000);
  const sum1 = computeLoanSummary(loan, paidSchedule);
  assert.equal(sum1.remainingPrincipal, 1_800_000_000);
  assert.equal(sum1.paidInterest, 50_000_000);
  assert.equal(totalExpenses(agriAccounts, txsAfter1), 50_000_000);

  // Early payoff remaining 9 installments (1.8B principal + 450M interest)
  const settledSchedule: LoanInstallment[] = paidSchedule.map((i) => ({
    ...i,
    status: 'paid',
    paidDate: i.paidDate || '2026-12-25',
  }));
  const txsAfterPayoff: Transaction[] = [
    ...txsAfter1,
    {
      id: 'tx_lp_all',
      type: 'expense',
      amount: 1_800_000_000,
      date: '2026-12-25',
      description: 'تسویه یکجا اصل وام',
      accountId: LOAN_INTEREST_ACCOUNT_ID,
      bankAccountId: 'bank_mellat',
      linkKind: 'loan_principal',
      loanId: 'loan_1',
    },
    {
      id: 'tx_li_all',
      type: 'expense',
      amount: 450_000_000,
      date: '2026-12-25',
      description: 'تسویه یکجا سود وام',
      accountId: LOAN_INTEREST_ACCOUNT_ID,
      bankAccountId: 'bank_mellat',
      linkKind: 'loan_interest',
      loanId: 'loan_1',
    },
  ];
  const sumFinal = computeLoanSummary(loan, settledSchedule);
  assert.equal(sumFinal.remainingPrincipal, 0);
  assert.equal(sumFinal.remainingTotal, 0);
  assert.equal(totalExpenses(agriAccounts, txsAfterPayoff), 500_000_000);
});

test('monthly breakdown report drills down Heading -> Person -> numbered invoices, labor split, and upcoming reminders', () => {
  const contacts: Contact[] = [
    { id: 'c_gh', groupId: 'g1', fullName: 'خانم مهندس قلیچی' },
    { id: 'c_zo', groupId: 'g1', fullName: 'مهندس ذوالفقاری' },
    { id: 'c_kh', groupId: 'g1', fullName: 'مهندس خسروی' },
    { id: 'c_mo', groupId: 'g2', fullName: 'مرتضی' },
    { id: 'c_wa', groupId: 'g2', fullName: 'کارگر آبگیری' },
  ];
  const invoices: Invoice[] = [
    {
      id: 'i1',
      kind: 'purchase',
      invoiceNumber: '۱',
      date: '2026-11-22',
      contactId: 'c_gh',
      accountId: 'exp_pesticide',
      amount: 100_000_000,
      description: 'فاکتور ۱ قلیچی',
    },
    {
      id: 'i2',
      kind: 'purchase',
      invoiceNumber: '۲',
      date: '2026-11-23',
      contactId: 'c_gh',
      accountId: 'exp_pesticide',
      amount: 50_000_000,
      description: 'فاکتور ۲ قلیچی',
    },
    {
      id: 'i3',
      kind: 'purchase',
      invoiceNumber: '۳',
      date: '2026-11-23',
      contactId: 'c_zo',
      accountId: 'exp_pesticide',
      amount: 40_000_000,
      description: 'فاکتور ذوالفقاری',
    },
    {
      id: 'i4',
      kind: 'purchase',
      invoiceNumber: '۴',
      date: '2026-11-23',
      contactId: 'c_kh',
      accountId: 'exp_pesticide',
      amount: 30_000_000,
      description: 'فاکتور خسروی',
    },
  ];
  const payroll: PayrollEntry[] = [
    {
      id: 'p1',
      contactId: 'c_mo',
      accountId: FIXED_SALARY_ACCOUNT_ID,
      entryType: 'fixed_month',
      date: '2026-11-22',
      quantity: 1,
      unitLabel: 'ماه',
      unitRate: 30_000_000,
      amount: 30_000_000,
      description: 'حقوق آذر',
    },
    {
      id: 'p2',
      contactId: 'c_wa',
      accountId: IRRIGATION_ACCOUNT_ID,
      entryType: 'work_log',
      date: '2026-11-22',
      quantity: 2,
      unitLabel: 'شبانه‌روز',
      unitRate: 1_000_000,
      amount: 2_000_000,
      description: 'آبگیری باغ شمالی',
    },
    {
      id: 'p3',
      contactId: 'c_wa',
      accountId: DAILY_LABOR_ACCOUNT_ID,
      entryType: 'work_log',
      date: '2026-11-23',
      quantity: 3,
      unitLabel: 'روز',
      unitRate: 800_000,
      amount: 2_400_000,
      description: 'کارگری روزمزد',
    },
  ];

  const report = buildMonthlyBreakdownReport(
    agriAccounts,
    contacts,
    [],
    invoices,
    payroll,
    [],
    { startDate: '2026-11-22', endDate: '2026-12-21' }
  );

  // Pesticide heading: 100M + 50M + 40M + 30M = 220M across 3 persons
  const pest = report.expenseHeadings.find((h) => h.accountId === 'exp_pesticide')!;
  assert.equal(pest.totalAmount, 220_000_000);
  assert.equal(pest.persons.length, 3);
  const ghRow = pest.persons.find((p) => p.contactId === 'c_gh')!;
  assert.equal(ghRow.totalAmount, 150_000_000);
  assert.equal(ghRow.items.length, 2);
  assert.equal(ghRow.items[0].sequenceNumber, 1);
  assert.equal(ghRow.items[1].sequenceNumber, 2);

  // آبگیری appears as its own real Level-1 expense heading in the 3-level breakdown!
  const irrigationHeading = report.expenseHeadings.find((h) => h.accountId === IRRIGATION_ACCOUNT_ID)!;
  assert.equal(irrigationHeading.accountName, 'آبگیری');
  assert.equal(irrigationHeading.totalAmount, 2_000_000);
  assert.equal(irrigationHeading.persons[0].contactName, 'کارگر آبگیری');

  // Labor breakdown grouped dynamically by actual expense heading
  const fixedLabor = report.laborBreakdown.find((l) => l.accountId === FIXED_SALARY_ACCOUNT_ID)!;
  const irrigLabor = report.laborBreakdown.find((l) => l.accountId === IRRIGATION_ACCOUNT_ID)!;
  const dailyLabor = report.laborBreakdown.find((l) => l.accountId === DAILY_LABOR_ACCOUNT_ID)!;
  assert.equal(fixedLabor.label, 'حقوق ثابت پرسنل');
  assert.equal(fixedLabor.amount, 30_000_000);
  assert.equal(irrigLabor.label, 'آبگیری');
  assert.equal(irrigLabor.amount, 2_000_000);
  assert.equal(dailyLabor.label, 'کارگری روزمزد');
  assert.equal(dailyLabor.amount, 2_400_000);
  assert.equal(
    report.laborBreakdown.reduce((s, l) => s + l.amount, 0),
    34_400_000
  );

  // Upcoming reminders within leadDays = 2
  const settings: ReminderSettings = {
    enabled: true,
    leadDays: 2,
    recipientMobile: '09120000000',
    smsEnabled: false,
  };
  const checks: CheckItem[] = [
    {
      id: 'chk_due_soon',
      kind: 'payable',
      checkNumber: '۱۲۳',
      amount: 500_000_000,
      issueDate: '2026-11-01',
      dueDate: '2026-11-25', // 2 days after ref 2026-11-23
      contactId: 'c_gh',
      bankAccountId: 'bank_mellat',
      status: 'pending',
      description: 'چک نزدیک سررسید',
    },
    {
      id: 'chk_far',
      kind: 'payable',
      checkNumber: '۱۲۴',
      amount: 100_000_000,
      issueDate: '2026-11-01',
      dueDate: '2026-12-10', // 17 days out -> excluded
      contactId: 'c_gh',
      bankAccountId: 'bank_mellat',
      status: 'pending',
      description: 'چک دور',
    },
  ];
  const reminders = computeUpcomingReminders(
    checks,
    [],
    [],
    contacts,
    settings,
    '2026-11-23'
  );
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].entityId, 'chk_due_soon');
  assert.equal(reminders[0].daysUntilDue, 2);
});

test('personnel classification separates defined personnel from suppliers and drives heading-aware person ledger', () => {
  const groups: ContactGroup[] = [
    { id: PERSONNEL_GROUP_ID, name: 'پرسنل و کارگران', sortOrder: 1 },
    { id: 'cg_suppliers', name: 'تأمین‌کنندگان سم و کود', sortOrder: 2 },
  ];
  const contacts: Contact[] = [
    { id: 'c_gh', groupId: 'cg_suppliers', fullName: 'خانم مهندس قلیچی' },
    {
      id: 'c_morteza',
      groupId: PERSONNEL_GROUP_ID,
      fullName: 'مرتضی (سرکارگر)',
      isPersonnel: true,
      personnelType: 'fixed',
    },
    {
      id: 'c_ali',
      groupId: 'cg_suppliers',
      fullName: 'علی (کارگر آبگیری)',
      isPersonnel: true,
      personnelType: 'daily',
      defaultRate: 1_000_000,
      defaultUnitLabel: 'شبانه‌روز',
    },
    {
      id: 'c_legacy_worker',
      groupId: PERSONNEL_GROUP_ID,
      fullName: 'حسن (عضو گروه پرسنل)',
    },
  ];

  // خانم مهندس قلیچی is NOT personnel -> must NOT appear in payroll dropdowns
  assert.equal(isPersonnelContact(contacts[0], groups), false);
  // Explicit flag OR personnel group -> MUST appear in payroll dropdowns
  assert.equal(isPersonnelContact(contacts[1], groups), true);
  assert.equal(isPersonnelContact(contacts[2], groups), true);
  assert.equal(isPersonnelContact(contacts[3], groups), true);

  const onlyPersonnel = filterPersonnelContacts(contacts, groups);
  assert.equal(onlyPersonnel.length, 3);
  assert.equal(onlyPersonnel.some((c) => c.id === 'c_gh'), false);

  // Heading-based unit suggestions
  assert.equal(suggestUnitForHeadingName('آبگیری'), 'شبانه‌روز');
  assert.equal(suggestUnitForHeadingName('کارگری دسته‌جمعی'), 'نفر-روز');
  assert.equal(suggestUnitForHeadingName('حقوق ثابت پرسنل'), 'ماه');
  assert.equal(suggestUnitForHeadingName('هرس درختان'), 'روز');

  // Custom labor heading works identically to آبگیری in person ledger & monthly breakdown
  const customAccounts: Account[] = [
    ...agriAccounts,
    {
      id: 'acc_exp_pruning',
      code: '20105',
      name: 'هرس درختان',
      module: 'expense',
      kind: 'postable',
      parentId: LABOR_GROUP_ACCOUNT_ID,
      isActive: true,
    },
  ];
  const entries: PayrollEntry[] = [
    {
      id: 'pe_irr',
      entryType: 'work_log',
      contactId: 'c_ali',
      accountId: IRRIGATION_ACCOUNT_ID,
      date: '2026-11-22',
      quantity: 2,
      unitLabel: 'شبانه‌روز',
      unitRate: 1_000_000,
      amount: 2_000_000,
      description: 'دو شبانه‌روز آبگیری',
    },
    {
      id: 'pe_pru',
      entryType: 'work_log',
      contactId: 'c_ali',
      accountId: 'acc_exp_pruning',
      date: '2026-11-23',
      quantity: 3,
      unitLabel: 'روز',
      unitRate: 900_000,
      amount: 2_700_000,
      description: 'سه روز هرس',
    },
  ];

  // Person balance ledger uses real heading names when accounts are provided
  const aliBal = computePersonBalance('c_ali', [], entries, [], [], { accounts: customAccounts });
  assert.equal(aliBal.payableAmount, 4_700_000);
  assert.equal(aliBal.rows[0].title, 'آبگیری');
  assert.equal(aliBal.rows[1].title, 'هرس درختان');

  // Monthly breakdown shows both آبگیری and custom هرس درختان as independent Level-1 headings
  const rep = buildMonthlyBreakdownReport(customAccounts, contacts, [], [], entries, []);
  assert.equal(rep.laborBreakdown.length, 2);
  assert.equal(rep.laborBreakdown[0].label, 'هرس درختان');
  assert.equal(rep.laborBreakdown[0].amount, 2_700_000);
  assert.equal(rep.laborBreakdown[1].label, 'آبگیری');
  assert.equal(rep.laborBreakdown[1].amount, 2_000_000);
});

test('inventoryEngine computes line totals, multi-warehouse stock, low-stock flags, warehouse summaries, and cardex', () => {
  const warehouses: Warehouse[] = [
    { id: 'wh_main', code: 'WH-01', name: 'انبار مرکزی', isDefault: true, isActive: true },
    { id: 'wh_cold', code: 'WH-02', name: 'سردخانه', isDefault: false, isActive: true },
  ];
  const products: Product[] = [
    {
      id: 'prd_pistachio',
      code: 'PRD-01',
      name: 'پسته اکبری خام',
      kind: 'goods',
      unit: 'کیلوگرم',
      purchasePrice: 800_000,
      salePrice: 1_100_000,
      defaultWarehouseId: 'wh_main',
      openingStock: 100,
      minStock: 40,
      isActive: true,
    },
    {
      id: 'prd_service',
      code: 'SRV-01',
      name: 'خدمات سورتینگ و لیزر',
      kind: 'service',
      unit: 'خدمت',
      salePrice: 2_500_000,
      isActive: true,
    },
  ];
  const contacts: Contact[] = [
    { id: 'c_sup', groupId: 'g1', fullName: 'تأمین‌کننده باغدار' },
    { id: 'c_cus', groupId: 'g1', fullName: 'مشتری صادراتی' },
  ];

  // Line total with discount & clamping
  assert.equal(computeLineTotal({ quantity: 2.5, unitPrice: 800_000, discount: 100_000 }), 1_900_000);
  assert.equal(computeLineTotal({ quantity: 1, unitPrice: 100_000, discount: 500_000 }), 0);

  const invoices: Invoice[] = [
    {
      id: 'inv_buy_1',
      kind: 'purchase',
      invoiceNumber: '۵۰۰۱',
      date: '2026-11-20',
      contactId: 'c_sup',
      accountId: 'exp_pesticide',
      warehouseId: 'wh_cold',
      amount: 39_500_000,
      description: 'خرید پسته و تحویل سردخانه',
      items: [
        {
          id: 'li_1',
          productId: 'prd_pistachio',
          productName: 'پسته اکبری خام',
          warehouseId: 'wh_cold',
          unit: 'کیلوگرم',
          quantity: 50,
          unitPrice: 800_000,
          discount: 500_000,
          total: 39_500_000,
        },
      ],
    },
    {
      id: 'inv_sell_1',
      kind: 'sale',
      invoiceNumber: '۶۰۰۱',
      date: '2026-11-22',
      contactId: 'c_cus',
      accountId: 'inc_sales',
      warehouseId: 'wh_main',
      amount: 79_500_000,
      description: 'فروش پسته از انبار مرکزی + خدمات سورتینگ',
      items: [
        {
          id: 'li_2',
          productId: 'prd_pistachio',
          productName: 'پسته اکبری خام',
          warehouseId: 'wh_main',
          unit: 'کیلوگرم',
          quantity: 70,
          unitPrice: 1_100_000,
          discount: 0,
          total: 77_000_000,
        },
        {
          id: 'li_3',
          productId: 'prd_service',
          productName: 'خدمات سورتینگ و لیزر',
          unit: 'خدمت',
          quantity: 1,
          unitPrice: 2_500_000,
          discount: 0,
          total: 2_500_000,
        },
      ],
    },
    // Legacy lump-sum invoice without items must be safely ignored by stock engine
    {
      id: 'inv_legacy',
      kind: 'purchase',
      invoiceNumber: '۹۹',
      date: '2026-11-23',
      contactId: 'c_sup',
      accountId: 'exp_pesticide',
      amount: 5_000_000,
      description: 'فاکتور قدیمی بدون ردیف کالا',
    },
  ];

  // Invoice totals aggregation
  const totals = computeInvoiceTotals(invoices[0].items);
  assert.equal(totals.subtotal, 40_000_000);
  assert.equal(totals.totalDiscount, 500_000);
  assert.equal(totals.grandTotal, 39_500_000);
  assert.equal(totals.totalQuantity, 50);

  // Stock across all warehouses: 100 opening + 50 purchase (wh_cold) - 70 sale (wh_main) = 80
  assert.equal(computeProductStock(products[0], invoices), 80);
  // Per-warehouse stock: wh_main = 100 - 70 = 30; wh_cold = 50
  assert.equal(computeProductStock(products[0], invoices, 'wh_main'), 30);
  assert.equal(computeProductStock(products[0], invoices, 'wh_cold'), 50);
  // Services always return 0 stock
  assert.equal(computeProductStock(products[1], invoices), 0);

  const byWh = computeProductStockByWarehouse(products[0], warehouses, invoices);
  assert.deepEqual(
    byWh.map((w) => [w.warehouseId, w.stock]),
    [
      ['wh_main', 30],
      ['wh_cold', 50],
    ]
  );

  // Low stock alert check: wh_main stock (30) <= minStock (40) -> true; total (80) -> false
  assert.equal(isLowStock(products[0], 30), true);
  assert.equal(isLowStock(products[0], 80), false);
  assert.equal(isLowStock(products[1], 0), false);

  // Warehouse summary
  const mainSum = computeWarehouseSummary(warehouses[0], products, invoices);
  assert.equal(mainSum.productCount, 1);
  assert.equal(mainSum.totalUnits, 30);
  assert.equal(mainSum.lowStockCount, 1);
  assert.equal(mainSum.estimatedValue, 24_000_000); // 30 * 800,000

  // Chronological cardex with running stock
  const cardex = computeProductCardex(products[0], invoices, warehouses, contacts);
  assert.equal(cardex.length, 3);
  assert.equal(cardex[0].kind, 'opening');
  assert.equal(cardex[0].runningStock, 100);
  assert.equal(cardex[1].kind, 'purchase');
  assert.equal(cardex[1].quantityIn, 50);
  assert.equal(cardex[1].runningStock, 150);
  assert.equal(cardex[2].kind, 'sale');
  assert.equal(cardex[2].quantityOut, 70);
  assert.equal(cardex[2].runningStock, 80);
});





