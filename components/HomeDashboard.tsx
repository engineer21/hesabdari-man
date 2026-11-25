import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BellRing,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Landmark,
  List,
  MoreVertical,
  Pencil,
  Plus,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  Account,
  AppSession,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  Loan,
  LoanInstallment,
  PayrollEntry,
  Transaction,
  UserProfile,
  View,
} from '../types';
import { computeBankBalance, totalBankBalance } from '../utils/accountBalance';
import {
  isOperatingExpenseTx,
  isOperatingIncomeTx,
  type UpcomingReminderItem,
} from '../utils/accrualEngine';
import { shortBankName } from '../utils/bankBrand';
import { monthTrend, sparklineSeries } from '../utils/dashboardTrends';
import {
  getJalaliMonthKey,
  getPreviousJalaliMonthKey,
  isInJalaliMonth,
  isWithinLastDays,
} from '../utils/jalaliPeriod';
import { formatNumberWithCommas, toPersianDigits } from '../utils/formatters';
import { can, canAccessView } from '../utils/permissions';
import MiniSparkline from './dashboard/MiniSparkline';
import CashFlowChart from './dashboard/CashFlowChart';
import { BankLogo } from './ui/BankLogo';
import { cn } from './ui';

interface HomeDashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  invoices?: Invoice[];
  payrollEntries?: PayrollEntry[];
  checks?: CheckItem[];
  loans?: Loan[];
  loanInstallments?: LoanInstallment[];
  upcomingReminders?: UpcomingReminderItem[];
  session: AppSession;
  userProfile: UserProfile;
  onNavigate: (view: View) => void;
  onOpenAccountReport: (accountId: string) => void;
  onQuickAdd?: () => void;
  onOpenTransfer?: () => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));
const FA_JALALI_DATE = new Intl.DateTimeFormat('fa-IR-u-ca-persian');
const FA_JALALI_MONTH_YEAR = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  month: 'long',
  year: 'numeric',
});
const CHIP_TONES = ['tone-brand', 'tone-info', 'tone-warning', 'tone-income'];
const chipTone = (i: number) => CHIP_TONES[i % CHIP_TONES.length];

type DashboardPeriod = 'month' | '30d' | 'all';

function hasTrendData(
  transactions: Transaction[],
  invoices: Invoice[],
  payrollEntries: PayrollEntry[],
  type: 'income' | 'expense'
): boolean {
  const curKey = getJalaliMonthKey(new Date());
  const prevKey = getPreviousJalaliMonthKey(new Date());
  const inWindow = (iso: string) => isInJalaliMonth(iso, curKey) || isInJalaliMonth(iso, prevKey);
  if (
    transactions.some(
      (t) =>
        (type === 'income' ? isOperatingIncomeTx(t) : isOperatingExpenseTx(t)) && inWindow(t.date)
    )
  ) {
    return true;
  }
  if (
    invoices.some(
      (inv) => (type === 'income' ? inv.kind === 'sale' : inv.kind === 'purchase') && inWindow(inv.date)
    )
  ) {
    return true;
  }
  if (type === 'expense' && payrollEntries.some((pe) => inWindow(pe.date))) return true;
  return false;
}

const HomeDashboard: React.FC<HomeDashboardProps> = ({
  accounts,
  transactions,
  contacts,
  invoices = [],
  payrollEntries = [],
  upcomingReminders = [],
  session,
  userProfile,
  onNavigate,
  onOpenAccountReport,
  onQuickAdd,
  onOpenTransfer,
}) => {
  const [hideBalance, setHideBalance] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>('month');

  const bank = useMemo(() => totalBankBalance(accounts, transactions), [accounts, transactions]);

  const periodTotals = useMemo(() => {
    const now = new Date();
    const curJalaliMonth = getJalaliMonthKey(now);
    const matchesPeriod = (iso: string) => {
      if (period === 'month') return isInJalaliMonth(iso, curJalaliMonth);
      if (period === '30d') return isWithinLastDays(iso, 30, now);
      return true;
    };
    let inc = 0;
    let exp = 0;
    for (const t of transactions) {
      if (!matchesPeriod(t.date)) continue;
      if (isOperatingIncomeTx(t)) inc += t.amount;
      else if (isOperatingExpenseTx(t)) exp += t.amount;
    }
    for (const inv of invoices) {
      if (!matchesPeriod(inv.date)) continue;
      if (inv.kind === 'sale') inc += inv.amount;
      else exp += inv.amount;
    }
    for (const pe of payrollEntries) {
      if (!matchesPeriod(pe.date)) continue;
      exp += pe.amount;
    }
    return { inc, exp };
  }, [transactions, invoices, payrollEntries, period]);

  const periodLabel =
    period === 'month' ? 'این ماه' : period === '30d' ? '۳۰ روز اخیر' : 'کل دوره';

  const incomeTrend = useMemo(
    () => monthTrend(transactions, 'income', new Date(), invoices, payrollEntries),
    [transactions, invoices, payrollEntries]
  );
  const expenseTrend = useMemo(
    () => monthTrend(transactions, 'expense', new Date(), invoices, payrollEntries),
    [transactions, invoices, payrollEntries]
  );
  const incomeSpark = useMemo(
    () => sparklineSeries(transactions, 'income', 7, new Date(), invoices, payrollEntries),
    [transactions, invoices, payrollEntries]
  );
  const expenseSpark = useMemo(
    () => sparklineSeries(transactions, 'expense', 7, new Date(), invoices, payrollEntries),
    [transactions, invoices, payrollEntries]
  );
  const showIncomeTrend = useMemo(
    () => period === 'month' && hasTrendData(transactions, invoices, payrollEntries, 'income'),
    [transactions, invoices, payrollEntries, period]
  );
  const showExpenseTrend = useMemo(
    () => period === 'month' && hasTrendData(transactions, invoices, payrollEntries, 'expense'),
    [transactions, invoices, payrollEntries, period]
  );

  const bankRows = useMemo(
    () =>
      accounts
        .filter((a) => a.module === 'bank' && a.kind === 'postable' && a.isActive !== false)
        .map((a) => ({ account: a, balance: computeBankBalance(a, transactions) }))
        .sort((x, y) => Math.abs(y.balance) - Math.abs(x.balance))
        .slice(0, 3),
    [accounts, transactions]
  );
  const activeBankCount = useMemo(
    () =>
      accounts.filter((a) => a.module === 'bank' && a.kind === 'postable' && a.isActive !== false)
        .length,
    [accounts]
  );
  const bankNameOf = (id: string) => accounts.find((a) => a.id === id)?.name || '—';

  const recentContacts = useMemo(() => {
    const last = new Map<string, number>();
    for (const t of transactions) {
      if (!t.contactId) continue;
      const ms = new Date(`${t.date}T12:00:00`).getTime();
      const cur = last.get(t.contactId);
      if (cur === undefined || ms > cur) last.set(t.contactId, ms);
    }
    const ordered = [...last.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => contacts.find((c) => c.id === id))
      .filter((c): c is Contact => Boolean(c));
    return ordered.length ? ordered : contacts.slice(0, 5);
  }, [contacts, transactions]);

  const recentTx = useMemo(
    () =>
      [...transactions]
        .sort(
          (a, b) =>
            new Date(`${b.date}T12:00:00`).getTime() - new Date(`${a.date}T12:00:00`).getTime()
        )
        .slice(0, 5),
    [transactions]
  );
  const contactById = (id: string | undefined) =>
    id ? contacts.find((c) => c.id === id) : undefined;

  const firstName = userProfile.firstName?.trim() || session.displayName || 'کاربر';
  const displayName =
    [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') ||
    session.displayName ||
    'کاربر';

  const canJournalsView = can(session, 'journals.view');
  const canJournalsCreate = can(session, 'journals.create');
  const canBanks = canAccessView(session, 'banks');
  const canPersons = canAccessView(session, 'persons');
  const canReports = canAccessView(session, 'reports');

  const periodChip = (
    <label className="relative inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/88 pe-3 ps-3 text-xs font-bold tabular-nums text-[color:var(--ink)] shadow-xs backdrop-blur-md transition hover:border-[color:var(--brand)]/35">
      <CalendarDays size={14} className="shrink-0 text-[color:var(--brand)]" aria-hidden />
      <select
        aria-label="بازه گزارش داشبورد"
        value={period}
        onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
        className="cursor-pointer appearance-none bg-transparent pe-4 text-xs font-bold text-[color:var(--ink)] outline-none"
      >
        <option value="month">{FA_JALALI_MONTH_YEAR.format(new Date())}</option>
        <option value="30d">۳۰ روز اخیر</option>
        <option value="all">کل دوره</option>
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute left-2.5 text-[color:var(--muted)]"
        aria-hidden
      />
    </label>
  );

  return (
    <div className="animate-page-enter space-y-5 md:space-y-6">
      {/* Header Row */}
      <section>
        {/* Mobile Greeting Row (matches dashboard-mobile.png) */}
        <div className="flex items-end justify-between gap-3 md:hidden">
          <div className="min-w-0">
            <h1 className="text-[1.45rem] font-black leading-tight text-[color:var(--ink)]">
              سلام {firstName}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
              امروز با خیال راحت مدیریت کنید
            </p>
          </div>
          {periodChip}
        </div>

        {/* Tablet & Desktop Title + Action Row (matches dashboard-desktop.png) */}
        <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-[color:var(--ink)]">
              داشبورد مالی
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
              سلام {displayName}، امروز با خیال راحت مدیریت کنید
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {periodChip}
            {onQuickAdd && canJournalsCreate ? (
              <button
                type="button"
                onClick={onQuickAdd}
                className="btn-brand-gradient inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-xs font-extrabold transition active:scale-[0.98]"
              >
                <Plus size={16} strokeWidth={2.5} />
                ثبت تراکنش
              </button>
            ) : null}
            {canReports ? (
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/88 px-4 text-xs font-extrabold text-[color:var(--ink)] shadow-xs backdrop-blur-md transition hover:border-[color:var(--brand)]/35 hover:text-[color:var(--brand)]"
              >
                <BarChart3 size={15} className="text-[color:var(--brand)]" />
                دریافت گزارش
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Top KPI Row: 1+2 on Mobile & Tablet, 3 equal cols on lg+ Desktop */}
      <section className="grid grid-cols-2 gap-3.5 md:gap-4 lg:grid-cols-3">
        {/* Hero Balance Card */}
        <div className="balance-gradient col-span-2 rounded-[1.5rem] p-5 text-white lg:col-span-1">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 420 210"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M-10 155 C 110 115, 220 185, 440 82"
              stroke="rgba(165, 243, 252, 0.38)"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M-10 182 C 120 135, 250 198, 440 118"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>

          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-md">
                <Wallet size={20} strokeWidth={1.9} />
              </span>
              <span className="text-sm font-bold text-white/90">موجودی کل حساب‌ها</span>
            </div>
            <button
              type="button"
              onClick={() => setHideBalance((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              aria-label={hideBalance ? 'نمایش موجودی' : 'پنهان‌سازی موجودی'}
            >
              {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenAccountReport('acc_bank')}
            className="relative mt-4 block w-full text-right"
          >
            <p
              data-testid="balance-amount"
              className="truncate text-[1.75rem] font-black tabular-nums tracking-tight sm:text-[2rem]"
            >
              {hideBalance ? '••••••••' : money(bank)}
              <span className="ms-2 text-xs font-bold text-white/80">تومان</span>
            </p>
          </button>

          <div className="relative mt-3.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onNavigate('banks')}
              className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur-md transition hover:bg-white/30"
            >
              <span>{toPersianDigits(activeBankCount)} حساب فعال</span>
              <ChevronLeft size={13} />
            </button>
            {onOpenTransfer && canJournalsCreate && activeBankCount >= 2 ? (
              <button
                type="button"
                onClick={onOpenTransfer}
                className="hidden items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-white/25 md:inline-flex"
              >
                <ArrowLeftRight size={12} />
                انتقال وجه
              </button>
            ) : null}
          </div>
        </div>

        {/* Income KPI Card (soft mint glass + area sparkline) */}
        <button
          type="button"
          onClick={() => onOpenAccountReport('acc_income')}
          className="kpi-income-card flex flex-col justify-between overflow-hidden rounded-[1.5rem] p-3.5 text-right transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold text-[color:var(--muted)] sm:text-sm">
              درآمد {periodLabel}
            </p>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl tone-income sm:h-10 sm:w-10 sm:rounded-2xl">
              <TrendingUp size={16} className="sm:hidden" />
              <TrendingUp size={19} className="hidden sm:block" />
            </span>
          </div>

          <div className="mt-2 min-w-0">
            <p
              data-testid="dashboard-income-amount"
              className="truncate text-[1.1rem] font-black tabular-nums tracking-tight text-[color:var(--ink)] sm:text-2xl"
            >
              {money(periodTotals.inc)}
            </p>
            <span className="text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
          </div>

          <div className="mt-2.5 flex items-end justify-between gap-1.5">
            {showIncomeTrend ? (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-[color:var(--income-soft)] px-2 py-1 text-[10.5px] font-extrabold text-[color:var(--income)] sm:text-[11px]">
                {incomeTrend.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {toPersianDigits(String(incomeTrend.pct))}٪
                <span className="hidden font-semibold opacity-85 xl:inline">نسبت به ماه قبل</span>
              </span>
            ) : (
              <span className="whitespace-nowrap text-[10.5px] font-semibold text-[color:var(--muted)] sm:text-[11px]">
                روند ۷ روز
              </span>
            )}
            <MiniSparkline values={incomeSpark} tone="income" />
          </div>
        </button>

        {/* Expense KPI Card (soft coral glass + area sparkline) */}
        <button
          type="button"
          onClick={() => onOpenAccountReport('acc_expense')}
          className="kpi-expense-card flex flex-col justify-between overflow-hidden rounded-[1.5rem] p-3.5 text-right transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold text-[color:var(--muted)] sm:text-sm">
              هزینه {periodLabel}
            </p>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl tone-expense sm:h-10 sm:w-10 sm:rounded-2xl">
              <ShoppingCart size={16} className="sm:hidden" />
              <ShoppingCart size={19} className="hidden sm:block" />
            </span>
          </div>

          <div className="mt-2 min-w-0">
            <p
              data-testid="dashboard-expense-amount"
              className="truncate text-[1.1rem] font-black tabular-nums tracking-tight text-[color:var(--ink)] sm:text-2xl"
            >
              {money(periodTotals.exp)}
            </p>
            <span className="text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
          </div>

          <div className="mt-2.5 flex items-end justify-between gap-1.5">
            {showExpenseTrend ? (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-[color:var(--expense-soft)] px-2 py-1 text-[10.5px] font-extrabold text-[color:var(--expense)] sm:text-[11px]">
                {expenseTrend.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {toPersianDigits(String(expenseTrend.pct))}٪
                <span className="hidden font-semibold opacity-85 xl:inline">نسبت به ماه قبل</span>
              </span>
            ) : (
              <span className="whitespace-nowrap text-[10.5px] font-semibold text-[color:var(--muted)] sm:text-[11px]">
                روند ۷ روز
              </span>
            )}
            <MiniSparkline values={expenseSpark} tone="expense" />
          </div>
        </button>
      </section>

      {/* Upcoming Checks & Loan Installments Reminder Banner */}
      {upcomingReminders.length > 0 ? (
        <section
          data-testid="dashboard-reminders-banner"
          className="dash-card border-amber-500/35 bg-amber-500/[0.06] p-4 sm:p-5"
          aria-label="یادآوری سررسید چک‌ها و اقساط وام"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <BellRing size={18} />
              </span>
              <div>
                <h2 className="text-sm font-black text-[color:var(--ink)]">
                  هشدار سررسید چک‌ها و اقساط ({toPersianDigits(upcomingReminders.length)} مورد)
                </h2>
                <p className="text-[11px] font-medium text-[color:var(--muted)]">
                  موارد نزدیک به سررسید یا معوقه برای پیگیری سریع
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('checks')}
              className="inline-flex items-center gap-1 text-xs font-extrabold text-[color:var(--brand)] hover:opacity-80"
            >
              مدیریت چک‌ها
              <ArrowLeft size={13} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingReminders.slice(0, 3).map((rem) => {
              const dueLabel =
                rem.daysUntilDue < 0
                  ? `${toPersianDigits(Math.abs(rem.daysUntilDue))} روز گذشته`
                  : rem.daysUntilDue === 0
                    ? 'امروز'
                    : `${toPersianDigits(rem.daysUntilDue)} روز دیگر`;
              return (
                <button
                  key={rem.id}
                  type="button"
                  onClick={() => onNavigate(rem.targetView)}
                  className="flex items-center justify-between gap-2.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/90 px-3.5 py-2.5 text-right transition hover:border-[color:var(--brand)]/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-[color:var(--ink)]">
                      {rem.title}
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                      {money(rem.amount)} تومان
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-extrabold',
                      rem.overdue
                        ? 'tone-expense'
                        : rem.daysUntilDue === 0
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : 'tone-info'
                    )}
                  >
                    {dueLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Quick Module Shortcuts Strip */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-5" aria-label="بخش‌های کلیدی">
        {canAccessView(session, 'invoices') ? (
          <button
            type="button"
            onClick={() => onNavigate('invoices')}
            className="dash-card flex items-center gap-2.5 px-3.5 py-3 text-right transition hover:border-[color:var(--brand)]/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl tone-brand">
              <FileText size={16} />
            </span>
            <span className="min-w-0 truncate text-xs font-extrabold text-[color:var(--ink)]">
              فاکتورها
            </span>
          </button>
        ) : null}
        {canAccessView(session, 'payroll') ? (
          <button
            type="button"
            onClick={() => onNavigate('payroll')}
            className="dash-card flex items-center gap-2.5 px-3.5 py-3 text-right transition hover:border-[color:var(--brand)]/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl tone-income">
              <Briefcase size={16} />
            </span>
            <span className="min-w-0 truncate text-xs font-extrabold text-[color:var(--ink)]">
              حقوق و کارکرد
            </span>
          </button>
        ) : null}
        {canAccessView(session, 'checks') ? (
          <button
            type="button"
            onClick={() => onNavigate('checks')}
            className="dash-card flex items-center gap-2.5 px-3.5 py-3 text-right transition hover:border-[color:var(--brand)]/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl tone-warning">
              <FileSpreadsheet size={16} />
            </span>
            <span className="min-w-0 truncate text-xs font-extrabold text-[color:var(--ink)]">
              مدیریت چک‌ها
            </span>
          </button>
        ) : null}
        {canAccessView(session, 'loans') ? (
          <button
            type="button"
            onClick={() => onNavigate('loans')}
            className="dash-card flex items-center gap-2.5 px-3.5 py-3 text-right transition hover:border-[color:var(--brand)]/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl tone-expense">
              <Banknote size={16} />
            </span>
            <span className="min-w-0 truncate text-xs font-extrabold text-[color:var(--ink)]">
              مدیریت وام‌ها
            </span>
          </button>
        ) : null}
        {canAccessView(session, 'monthly-report') ? (
          <button
            type="button"
            onClick={() => onNavigate('monthly-report')}
            className="dash-card col-span-2 flex items-center gap-2.5 px-3.5 py-3 text-right transition hover:border-[color:var(--brand)]/40 sm:col-span-1"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl tone-info">
              <BarChart3 size={16} />
            </span>
            <span className="min-w-0 truncate text-xs font-extrabold text-[color:var(--ink)]">
              گزارش ماهانه
            </span>
          </button>
        ) : null}
      </section>

      {/* Mobile 3 Quick Actions (matches dashboard-mobile.png: درآمد / هزینه / انتقال) */}
      <section className="grid grid-cols-3 gap-3 md:hidden" data-testid="quick-actions" aria-label="دسترسی سریع">
        {canAccessView(session, 'income') ? (
          <button
            type="button"
            onClick={() => onNavigate('income')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/80 bg-[#dcf7ea]/90 px-2 py-3.5 text-xs font-extrabold text-emerald-700 shadow-xs transition active:scale-[0.97] dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            <TrendingUp size={20} />
            <span>درآمد</span>
          </button>
        ) : null}
        {canAccessView(session, 'expense') ? (
          <button
            type="button"
            onClick={() => onNavigate('expense')}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/80 bg-[#ffebe7]/90 px-2 py-3.5 text-xs font-extrabold text-rose-600 shadow-xs transition active:scale-[0.97] dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300"
          >
            <ShoppingCart size={20} />
            <span>هزینه</span>
          </button>
        ) : null}
        {canBanks ? (
          <button
            type="button"
            onClick={() => (onOpenTransfer && activeBankCount >= 2 ? onOpenTransfer() : onNavigate('banks'))}
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/80 bg-[#dff4ff]/90 px-2 py-3.5 text-xs font-extrabold text-sky-700 shadow-xs transition active:scale-[0.97] dark:border-sky-500/20 dark:bg-sky-500/15 dark:text-sky-300"
          >
            <ArrowLeftRight size={20} />
            <span>انتقال</span>
          </button>
        ) : null}
      </section>

      {/* Middle 2-Column Split: Bank Accounts + Cash Flow Chart (matches dashboard-desktop.png) */}
      <section className="grid gap-4 lg:grid-cols-5">
        {canBanks && bankRows.length > 0 ? (
          <section
            data-testid="banks-card"
            className={cn('dash-card flex flex-col justify-between p-5', canJournalsView && 'lg:col-span-2')}
            aria-label="حساب‌های بانکی"
          >
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-brand">
                    <Landmark size={16} />
                  </span>
                  <h2 className="text-base font-extrabold text-[color:var(--ink)]">حساب‌های بانکی</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('banks')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--brand)] hover:opacity-80"
                >
                  همه حساب‌ها
                  <ArrowLeft size={13} />
                </button>
              </div>

              <div className="space-y-2.5">
                {bankRows.map((row) => {
                  const short = shortBankName(row.account.name);
                  const subtitle = row.account.accountTitle || row.account.name;
                  return (
                    <button
                      key={row.account.id}
                      type="button"
                      onClick={() => onOpenAccountReport(row.account.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/75 p-3 text-right transition hover:border-[color:var(--brand)]/35 hover:bg-[color:var(--surface-solid)]"
                    >
                      <BankLogo name={row.account.name} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-[color:var(--ink)]">
                          {short}
                        </span>
                        <span className="block truncate text-[11px] font-medium text-[color:var(--muted)]">
                          {subtitle}
                        </span>
                      </span>
                      <span className="shrink-0 text-left">
                        <span className="block text-sm font-black tabular-nums text-[color:var(--ink)]">
                          {money(row.balance)}
                        </span>
                        <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                          تومان
                        </span>
                      </span>
                      <ChevronLeft size={15} className="shrink-0 text-[color:var(--muted)]" />
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {canJournalsView ? (
          <CashFlowChart
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
            className={cn(canBanks && bankRows.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5')}
          />
        ) : null}
      </section>

      {/* Recent Parties Strip (matches dashboard-desktop.png) */}
      {canPersons && recentContacts.length > 0 ? (
        <section className="dash-card p-4 sm:p-5" data-testid="parties-card" aria-label="طرف‌حساب‌های اخیر">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-info">
                <Users size={16} />
              </span>
              <h2 className="text-base font-extrabold text-[color:var(--ink)]">طرف‌حساب‌های اخیر</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('persons')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--brand)] hover:opacity-80"
            >
              مدیریت اشخاص
              <ArrowLeft size={13} />
            </button>
          </div>
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
            {recentContacts.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onNavigate('persons')}
                className="flex shrink-0 items-center gap-2.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-solid)]/85 py-1.5 pe-4 ps-1.5 shadow-xs transition hover:border-[color:var(--brand)]/35 hover:bg-[color:var(--surface-solid)]"
              >
                {c.picture ? (
                  <img src={c.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-black',
                      chipTone(i)
                    )}
                    aria-hidden
                  >
                    {c.fullName.trim().charAt(0)}
                  </span>
                )}
                <span className="whitespace-nowrap text-xs font-bold text-[color:var(--ink)]">
                  {c.fullName}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Recent Transactions List (Structured Card Rows matching ChecksPage / LoansPage) */}
      {canJournalsView ? (
        <section className="dash-card p-4 sm:p-6" data-testid="recent-tx" aria-label="آخرین تراکنش‌ها">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-brand">
                <List size={16} />
              </span>
              <h2 className="text-base font-extrabold text-[color:var(--ink)]">آخرین تراکنش‌ها</h2>
              <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[color:var(--muted)]">
                {toPersianDigits(String(recentTx.length))} مورد اخیر
              </span>
            </div>
          </div>

          {recentTx.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--line)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
              هنوز تراکنشی ثبت نشده است؛ با دکمه «ثبت تراکنش» اولین مورد را ثبت کنید.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recentTx.map((t, idx) => {
                const contact = contactById(t.contactId);
                const isTransfer = t.type === 'transfer';
                const srcBank = bankNameOf(t.bankAccountId);
                const dstBank = isTransfer ? bankNameOf(t.accountId) : '';
                const leafCategoryName = !isTransfer ? bankNameOf(t.accountId) : '';
                const cleanDesc = (t.description || '').trim();
                const hasCustomDesc =
                  Boolean(cleanDesc) && cleanDesc !== 'هزینه' && cleanDesc !== 'درآمد';

                const primaryTitle = isTransfer
                  ? `انتقال از ${shortBankName(srcBank)} به ${shortBankName(dstBank)}`
                  : hasCustomDesc
                    ? cleanDesc
                    : leafCategoryName && leafCategoryName !== '—'
                      ? leafCategoryName
                      : contact?.fullName || (t.type === 'income' ? 'درآمد ثبت‌شده' : 'هزینه ثبت‌شده');

                const targetView: View = isTransfer
                  ? 'transfers'
                  : t.type === 'income'
                    ? 'income'
                    : 'expense';
                const formattedDate = FA_JALALI_DATE.format(new Date(`${t.date}T12:00:00`));

                return (
                  <div
                    key={t.id}
                    onClick={() => onNavigate(targetView)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigate(targetView);
                      }
                    }}
                    aria-label={`مشاهده ${primaryTitle}`}
                    className="flex flex-col gap-3 rounded-2xl border border-[color:var(--line)]/85 bg-[color:var(--surface-1)]/80 p-3.5 transition hover:border-[color:var(--brand)]/35 hover:bg-[color:var(--surface-2)]/45 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {isTransfer ? (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl tone-info">
                          <ArrowLeftRight size={17} />
                        </span>
                      ) : contact?.picture ? (
                        <img
                          src={contact.picture}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black',
                            contact
                              ? chipTone(idx)
                              : t.type === 'income'
                                ? 'tone-income'
                                : 'tone-expense'
                          )}
                          aria-hidden
                        >
                          {(contact?.fullName || primaryTitle).trim().charAt(0)}
                        </span>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold',
                              t.type === 'income'
                                ? 'tone-income'
                                : t.type === 'transfer'
                                  ? 'tone-info'
                                  : 'tone-expense'
                            )}
                          >
                            {t.type === 'income'
                              ? 'دریافت / درآمد'
                              : t.type === 'transfer'
                                ? 'انتقال بین حساب‌ها'
                                : 'پرداخت / هزینه'}
                          </span>

                          <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[10.5px] font-bold tabular-nums text-[color:var(--muted)]">
                            {formattedDate}
                          </span>

                          {!isTransfer && leafCategoryName && leafCategoryName !== '—' ? (
                            <span className="truncate rounded-full bg-[color:var(--surface-2)]/70 px-2.5 py-0.5 text-[10.5px] font-semibold text-[color:var(--muted)]">
                              سرفصل: {leafCategoryName}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="truncate text-sm font-black text-[color:var(--ink)]">
                            {primaryTitle}
                          </p>

                          {contact ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] font-extrabold text-[color:var(--ink)]">
                              <Users size={11} className="text-[color:var(--brand)]" />
                              طرف‌حساب: {contact.fullName}
                            </span>
                          ) : null}

                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)]">
                            <BankLogo name={srcBank} size="xs" />
                            {isTransfer ? `${shortBankName(srcBank)} ← ${shortBankName(dstBank)}` : srcBank}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-[color:var(--line)]/60 pt-2.5 sm:justify-end sm:border-t-0 sm:pt-0">
                      <p
                        className={cn(
                          'text-sm font-black tabular-nums sm:text-base',
                          t.type === 'income'
                            ? 'text-[color:var(--income)]'
                            : t.type === 'transfer'
                              ? 'text-[color:var(--info)]'
                              : 'text-[color:var(--expense)]'
                        )}
                      >
                        {t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄ ' : '-'}
                        {money(t.amount)}
                        <span className="ms-1 text-[10px] font-semibold text-[color:var(--muted)]">
                          تومان
                        </span>
                      </p>

                      <span
                        className="flex shrink-0 items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onNavigate(targetView)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] text-[color:var(--muted)] transition hover:border-[color:var(--brand)]/40 hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand)]"
                          aria-label="مشاهده در فهرست"
                          title="مشاهده در فهرست"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenAccountReport(t.bankAccountId)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] text-[color:var(--muted)] transition hover:border-[color:var(--brand)]/40 hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand)]"
                          aria-label="گردش حساب"
                          title="گردش حساب"
                        >
                          <MoreVertical size={13} />
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
};

export default HomeDashboard;
