import React, { useId, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpenText,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  Layers,
  Scale,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Wallet,
  WalletCards,
} from 'lucide-react';
import type {
  Account,
  CheckItem,
  Contact,
  Invoice,
  PayrollEntry,
  Transaction,
  View,
} from '../types';
import { getChildren, getDescendantIds, getBankAccounts } from '../utils/accountTree';
import { totalBankBalance } from '../utils/accountBalance';
import { isOperatingExpenseTx, isOperatingIncomeTx } from '../utils/accrualEngine';
import { shortBankName } from '../utils/bankBrand';
import { formatNumberWithCommas, toPersianDigits } from '../utils/formatters';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatMoneyFa,
} from '../utils/export';
import { WorkspaceHeader, EmptyState, cn } from './ui';
import { BankLogo } from './ui/BankLogo';
import { ExportActions } from './export/ExportActions';
import { APP_NAME } from '../constants';

interface ReportsProps {
  onNavigate: (view: View) => void;
  accounts: Account[];
  transactions: Transaction[];
  invoices?: Invoice[];
  payrollEntries?: PayrollEntry[];
  checks?: CheckItem[];
  contacts: Contact[];
  onOpenLedger: (accountId: string) => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(Math.abs(n))));

const FA_MONTH_KEY = new Intl.DateTimeFormat('en-u-ca-persian', {
  year: 'numeric',
  month: 'numeric',
});
const FA_MONTH_LABEL = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' });
const FA_YEAR_LABEL = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' });

function persianMonthKey(d: Date): string {
  const parts = FA_MONTH_KEY.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${y}/${m}`;
}

function distinctPersianMonthsBack(
  count: number,
  endDate: Date = new Date()
): { value: string; label: string; shortLabel: string; anchor: number }[] {
  const out: { value: string; label: string; shortLabel: string; anchor: number }[] = [];
  const seen = new Set<string>();
  const cursor = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12, 0, 0);
  let guard = 0;
  while (out.length < count && guard < 400) {
    const key = persianMonthKey(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        value: key,
        label: `${FA_MONTH_LABEL.format(cursor)} ${FA_YEAR_LABEL.format(cursor)}`,
        shortLabel: FA_MONTH_LABEL.format(cursor),
        anchor: cursor.getTime(),
      });
      cursor.setDate(cursor.getDate() - 28);
    } else {
      cursor.setDate(cursor.getDate() - 1);
    }
    guard++;
  }
  return out;
}

function persianMonthOptions(): { value: string; label: string; anchor: number }[] {
  return distinctPersianMonthsBack(6);
}

const PeriodSelect: React.FC<{
  testId: string;
  aria: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  includeAll?: boolean;
}> = ({ testId, aria, value, onChange, options, includeAll }) => (
  <span className="relative inline-flex h-9 shrink-0 items-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/85 pe-7 ps-3 shadow-xs">
    <span className="shrink-0 text-[11px] font-bold text-[color:var(--muted)]">دوره:</span>
    <select
      data-testid={testId}
      aria-label={aria}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[9.5rem] appearance-none truncate bg-transparent ps-1.5 text-[11px] font-extrabold text-[color:var(--ink)] outline-none"
    >
      {includeAll ? <option value="">کل دوره</option> : null}
      {options.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
    <ChevronDown
      size={13}
      className="pointer-events-none absolute left-2 text-[color:var(--muted)]"
      aria-hidden
    />
  </span>
);

interface Point {
  label: string;
  key: string;
  income: number;
  expense: number;
}

function monthlyPoints(
  transactions: Transaction[],
  invoices: Invoice[],
  payrollEntries: PayrollEntry[],
  endAnchor: Date
): Point[] {
  const buckets: Point[] = distinctPersianMonthsBack(6, endAnchor)
    .reverse()
    .map((m) => ({
      label: m.shortLabel,
      key: m.value,
      income: 0,
      expense: 0,
    }));
  const map = new Map<string, Point>();
  for (const b of buckets) map.set(b.key, b);
  for (const t of transactions) {
    const isInc = isOperatingIncomeTx(t);
    const isExp = isOperatingExpenseTx(t);
    if (!isInc && !isExp) continue;
    const b = map.get(persianMonthKey(new Date(`${t.date}T12:00:00`)));
    if (!b) continue;
    if (isInc) b.income += t.amount;
    else b.expense += t.amount;
  }
  for (const inv of invoices) {
    const b = map.get(persianMonthKey(new Date(`${inv.date}T12:00:00`)));
    if (!b) continue;
    if (inv.kind === 'sale') b.income += inv.amount;
    else b.expense += inv.amount;
  }
  for (const pe of payrollEntries) {
    const b = map.get(persianMonthKey(new Date(`${pe.date}T12:00:00`)));
    if (!b) continue;
    b.expense += pe.amount;
  }
  return buckets;
}

function fmtTick(n: number): string {
  if (n <= 0) return toPersianDigits(0);
  if (n >= 1_000_000_000) return `${toPersianDigits(Math.round(n / 1_000_000_000))} میلیارد`;
  if (n >= 1_000_000) return `${toPersianDigits(Math.round(n / 1_000_000))} م`;
  if (n >= 1_000) return `${toPersianDigits(Math.round(n / 1_000))} هزار`;
  return toPersianDigits(Math.round(n));
}

const CHART_W = 540;
const CHART_H = 200;
const CHART_PAD_X = 14;
const CHART_PAD_TOP = 14;
const CHART_PAD_BOTTOM = 12;
const BAR_W = 17;
const BAR_GAP = 6;

const IncomeExpenseBars: React.FC<{
  transactions: Transaction[];
  invoices: Invoice[];
  payrollEntries: PayrollEntry[];
}> = ({ transactions, invoices, payrollEntries }) => {
  const monthOptions = useMemo(persianMonthOptions, []);
  const [period, setPeriod] = useState(() => monthOptions[0]?.value ?? '');
  const gradIncId = useId();
  const gradExpId = useId();

  const data = useMemo(() => {
    const anchorMs = monthOptions.find((o) => o.value === period)?.anchor;
    return monthlyPoints(transactions, invoices, payrollEntries, new Date(anchorMs ?? Date.now()));
  }, [transactions, invoices, payrollEntries, period, monthOptions]);

  const maxV = useMemo(
    () => Math.max(1, ...data.map((p) => Math.max(p.income, p.expense))),
    [data]
  );
  const hasData = data.some((p) => p.income > 0 || p.expense > 0);
  const sumIncome = data.reduce((s, p) => s + p.income, 0);
  const sumExpense = data.reduce((s, p) => s + p.expense, 0);

  const yAt = (v: number) =>
    CHART_PAD_TOP + (1 - v / maxV) * (CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM);
  const slot = (CHART_W - CHART_PAD_X * 2) / Math.max(1, data.length);
  const ticks = Array.from({ length: 5 }, (_, i) => (maxV * (4 - i)) / 4);

  return (
    <section
      data-testid="reports-chart-card"
      className="dash-card flex flex-col p-4 sm:p-5"
      aria-label="مقایسه درآمد و هزینه"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-[color:var(--brand)]" />
          <h2 className="text-base font-extrabold text-[color:var(--ink)]">مقایسه درآمد و هزینه</h2>
        </div>
        <PeriodSelect
          testId="reports-chart-period"
          aria="دوره نمودار مقایسه درآمد و هزینه"
          value={period}
          onChange={setPeriod}
          options={monthOptions}
        />
      </div>

      {hasData ? (
        <>
          <div dir="ltr" className="mt-4">
            <div className="relative ps-11">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex w-10 flex-col justify-between py-1 text-right text-[10px] font-semibold tabular-nums text-[color:var(--muted)]"
                dir="rtl"
              >
                {ticks.map((t, i) => (
                  <span key={i}>{fmtTick(t)}</span>
                ))}
              </div>
              <svg
                data-testid="reports-chart"
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full"
                role="img"
                aria-label="نمودار میله‌ای مقایسه درآمد و هزینه"
              >
                <defs>
                  <linearGradient id={gradIncId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.55" />
                  </linearGradient>
                  <linearGradient id={gradExpId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.55" />
                  </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <line
                    key={f}
                    x1={CHART_PAD_X}
                    x2={CHART_W - CHART_PAD_X}
                    y1={CHART_PAD_TOP + f * (CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM)}
                    y2={CHART_PAD_TOP + f * (CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM)}
                    stroke="var(--line)"
                    strokeDasharray={f === 1 ? undefined : '3 3'}
                    strokeWidth="1"
                  />
                ))}
                {data.map((p, i) => {
                  const center = CHART_PAD_X + slot * i + slot / 2;
                  const xIncome = center - BAR_GAP / 2 - BAR_W;
                  const xExpense = center + BAR_GAP / 2;
                  const hIncome = Math.max(
                    3,
                    (p.income / maxV) * (CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM)
                  );
                  const hExpense = Math.max(
                    3,
                    (p.expense / maxV) * (CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM)
                  );
                  return (
                    <g key={`${p.label}-${i}`}>
                      <rect
                        x={xIncome}
                        y={yAt(p.income)}
                        width={BAR_W}
                        height={hIncome}
                        rx="6"
                        fill={`url(#${gradIncId})`}
                      />
                      <rect
                        x={xExpense}
                        y={yAt(p.expense)}
                        width={BAR_W}
                        height={hExpense}
                        rx="6"
                        fill={`url(#${gradExpId})`}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
            <div
              className="ms-11 mt-1.5 flex justify-between text-[10px] font-bold text-[color:var(--muted)]"
              dir="ltr"
            >
              {data.map((p, i) => (
                <span
                  key={`${p.label}-${i}`}
                  className={cn(i === data.length - 1 && 'text-[color:var(--brand)]')}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 px-4 py-2.5 text-xs font-extrabold text-[color:var(--ink)]">
            <span className="flex items-center gap-2 tabular-nums">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
              درآمد: {money(sumIncome)} تومان
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden />
              هزینه: {money(sumExpense)} تومان
            </span>
          </div>
        </>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-[color:var(--line)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
          هنوز تراکنش درآمد یا هزینه‌ای برای نمایش نمودار ثبت نشده است
        </p>
      )}
    </section>
  );
};

const Reports: React.FC<ReportsProps> = ({
  onNavigate,
  accounts,
  transactions,
  invoices = [],
  payrollEntries = [],
  contacts,
  onOpenLedger,
}) => {
  const [monthKey, setMonthKey] = useState('');
  const bankList = useMemo(() => getBankAccounts(accounts), [accounts]);
  const monthOptions = useMemo(() => persianMonthOptions(), []);

  const inSelectedMonth = (iso: string) =>
    !monthKey || persianMonthKey(new Date(`${iso}T12:00:00`)) === monthKey;

  const filteredTxs = useMemo(() => {
    return transactions.filter(
      (t) => (isOperatingIncomeTx(t) || isOperatingExpenseTx(t)) && inSelectedMonth(t.date)
    );
  }, [transactions, monthKey]);

  const filteredInvoices = useMemo(
    () => invoices.filter((inv) => inSelectedMonth(inv.date)),
    [invoices, monthKey]
  );

  const filteredPayroll = useMemo(
    () => payrollEntries.filter((pe) => inSelectedMonth(pe.date)),
    [payrollEntries, monthKey]
  );

  const executiveStats = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of filteredTxs) {
      if (isOperatingIncomeTx(t)) inc += t.amount;
      else if (isOperatingExpenseTx(t)) exp += t.amount;
    }
    for (const inv of filteredInvoices) {
      if (inv.kind === 'sale') inc += inv.amount;
      else exp += inv.amount;
    }
    for (const pe of filteredPayroll) {
      exp += pe.amount;
    }
    const liquidity = totalBankBalance(accounts, transactions);
    return { inc, exp, net: inc - exp, liquidity };
  }, [filteredTxs, filteredInvoices, filteredPayroll, accounts, transactions]);

  const rootNodes = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.parentId &&
          (a.module === 'income' || a.module === 'expense') &&
          a.isActive !== false
      ),
    [accounts]
  );

  const nodes = useMemo(
    () =>
      rootNodes.flatMap((r) => {
        const kids = getChildren(accounts, r.id).filter((a) => a.isActive !== false);
        return kids.length ? kids : [r];
      }),
    [accounts, rootNodes]
  );

  const rootRows = useMemo(
    () =>
      nodes.map((node) => {
        const leafIds = new Set(
          getDescendantIds(accounts, node.id).filter((id) => {
            const a = accounts.find((x) => x.id === id);
            return a?.kind === 'postable';
          })
        );
        let debit = 0;
        let credit = 0;
        for (const t of filteredTxs) {
          if (!t.accountId || !leafIds.has(t.accountId)) continue;
          if (node.module === 'income' && isOperatingIncomeTx(t)) credit += t.amount;
          else if (node.module === 'expense' && isOperatingExpenseTx(t)) debit += t.amount;
        }
        for (const inv of filteredInvoices) {
          if (!leafIds.has(inv.accountId)) continue;
          if (node.module === 'income' && inv.kind === 'sale') credit += inv.amount;
          else if (node.module === 'expense' && inv.kind === 'purchase') debit += inv.amount;
        }
        if (node.module === 'expense') {
          for (const pe of filteredPayroll) {
            if (leafIds.has(pe.accountId)) debit += pe.amount;
          }
        }
        return { node, debit, credit, net: credit - debit, sub: leafIds.size };
      }),
    [nodes, accounts, filteredTxs, filteredInvoices, filteredPayroll]
  );

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      rootRows.map((r) => ({
        سرفصل: r.node.name,
        زیرحساب: r.sub,
        بدهکار: r.debit,
        بستانکار: r.credit,
        مانده: r.net,
      })),
      'مانده سرفصل‌ها',
      'accounts-balance'
    );
  };

  const handlePdf = async () => {
    const rows = rootRows.map((r) => [
      r.node.name,
      toPersianDigits(r.sub),
      r.debit ? formatMoneyFa(r.debit) : '۰',
      r.credit ? formatMoneyFa(r.credit) : '۰',
      formatMoneyFa(r.net),
    ]);
    await downloadTableReportPdf({
      title: 'مانده سرفصل‌ها',
      storeName: APP_NAME,
      subtitle: monthOptions.find((m) => m.value === monthKey)?.label || 'کل دوره',
      pageSize: 'a4',
      filename: 'accounts-balance-a4',
      columns: [
        { header: 'سرفصل', width: 2.4, align: 'right' },
        { header: 'زیرحساب', width: 1, align: 'amount' },
        { header: 'بدهکار', width: 1.4, align: 'amount' },
        { header: 'بستانکار', width: 1.4, align: 'amount' },
        { header: 'مانده', width: 1.4, align: 'amount' },
      ],
      rows,
      summary: [
        { label: 'جمع بدهکار', value: formatMoneyFa(rootRows.reduce((s, r) => s + r.debit, 0)) },
        { label: 'جمع بستانکار', value: formatMoneyFa(rootRows.reduce((s, r) => s + r.credit, 0)) },
      ],
    });
  };

  const hasRows = rootRows.length > 0;
  const transferCount = useMemo(
    () => transactions.filter((t) => t.type === 'transfer').length,
    [transactions]
  );

  const reportLaunchers: {
    key: string;
    view: View;
    title: string;
    subtitle: string;
    metric: string;
    icon: React.ReactNode;
    iconBg: string;
    featured?: boolean;
  }[] = [
    {
      key: 'monthly',
      view: 'monthly-report',
      title: 'گزارش ماهانه و ریز هزینه‌ها',
      subtitle: 'تفکیک ۳ سطحی سرفصل، اشخاص و فاکتورها با تصویر',
      metric: `${toPersianDigits(invoices.length)} فاکتور · ${toPersianDigits(payrollEntries.length)} کارکرد`,
      icon: <CalendarRange size={20} />,
      iconBg: 'bg-white/20 text-white',
      featured: true,
    },
    {
      key: 'ledger',
      view: 'account-ledger-report',
      title: 'دفتر کل و گردش سرفصل',
      subtitle: 'ریز اسناد و مانده لحظه‌ای هر حساب',
      metric: `${toPersianDigits(accounts.length)} سرفصل فعال`,
      icon: <BookOpenText size={20} />,
      iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    },
    {
      key: 'trial',
      view: 'trial-balance-report',
      title: 'تراز آزمایشی و سود و زیان',
      subtitle: 'تراز چهارستونی و صورت سود و زیان',
      metric: `${executiveStats.net >= 0 ? 'سود' : 'زیان'} ${money(executiveStats.net)} تومان`,
      icon: <Scale size={20} />,
      iconBg: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    },
    {
      key: 'persons-rep',
      view: 'persons-report',
      title: 'عملکرد و تراز اشخاص',
      subtitle: 'طلبکار / بدهکار واقعی و گردش طرف‌حساب‌ها',
      metric: `${toPersianDigits(contacts.length)} طرف‌حساب`,
      icon: <UserCheck size={20} />,
      iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    },
    {
      key: 'treasury',
      view: 'treasury-report',
      title: 'گردش خزانه و بانک‌ها',
      subtitle: 'وجوه نقد و دفتر انتقال‌های بین‌بانکی',
      metric: `${toPersianDigits(bankList.length)} حساب · ${toPersianDigits(transferCount)} انتقال`,
      icon: <WalletCards size={20} />,
      iconBg: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    },
  ];

  return (
    <div className="animate-page-enter mx-auto max-w-6xl space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="داشبورد گزارشات مالی"
        subtitle="نمای جامع سود و زیان، تراز سرفصل‌ها و دسترسی مستقیم به دفترهای حسابداری"
        actions={
          hasRows ? (
            <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="reports.export" />
          ) : undefined
        }
      />

      {/* Executive Summary KPI Strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="dash-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[color:var(--muted)]">موجودی کل نقد و بانک</span>
            <Wallet size={15} className="text-[color:var(--brand)]" />
          </div>
          <p className="mt-2 truncate text-base font-black tabular-nums text-[color:var(--ink)] sm:text-xl">
            {money(executiveStats.liquidity)}
            <span className="ms-1 text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
          </p>
        </div>

        <div className="kpi-income-card rounded-[1.4rem] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[color:var(--muted)]">جمع درآمد دوره</span>
            <TrendingUp size={15} className="text-[color:var(--income)]" />
          </div>
          <p className="mt-2 truncate text-base font-black tabular-nums text-[color:var(--income)] sm:text-xl">
            +{money(executiveStats.inc)}
          </p>
        </div>

        <div className="kpi-expense-card rounded-[1.4rem] p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[color:var(--muted)]">جمع هزینه دوره</span>
            <TrendingDown size={15} className="text-[color:var(--expense)]" />
          </div>
          <p className="mt-2 truncate text-base font-black tabular-nums text-[color:var(--expense)] sm:text-xl">
            -{money(executiveStats.exp)}
          </p>
        </div>

        <div className="dash-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[color:var(--muted)]">
              {executiveStats.net >= 0 ? 'سود خالص دوره' : 'زیان خالص دوره'}
            </span>
            <Scale size={15} className="text-[color:var(--brand)]" />
          </div>
          <p
            className={cn(
              'mt-2 truncate text-base font-black tabular-nums sm:text-xl',
              executiveStats.net >= 0 ? 'text-[color:var(--income)]' : 'text-[color:var(--expense)]'
            )}
          >
            {executiveStats.net >= 0 ? '+' : '-'}
            {money(executiveStats.net)}
          </p>
        </div>
      </section>

      {/* Dedicated Iranian Accounting Report Launchers */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {reportLaunchers.map((card) => (
          <button
            key={card.key}
            type="button"
            data-testid={`report-card-${card.key}`}
            onClick={() => onNavigate(card.view)}
            className={cn(
              'group relative flex flex-col justify-between rounded-[1.4rem] p-4 text-right transition hover:-translate-y-0.5',
              card.featured
                ? 'balance-gradient text-white shadow-[0_18px_40px_-14px_rgba(10,95,243,0.48)]'
                : 'dash-card hover:border-[color:var(--brand)]/40'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                  card.iconBg
                )}
              >
                {card.icon}
              </span>
              <ChevronLeft
                size={18}
                className={cn(
                  'mt-1 shrink-0 transition-transform group-hover:-translate-x-1',
                  card.featured ? 'text-white/80' : 'text-[color:var(--muted)] group-hover:text-[color:var(--brand)]'
                )}
              />
            </div>

            <div className="mt-4">
              <p
                className={cn(
                  'text-sm font-black sm:text-[15px]',
                  card.featured ? 'text-white' : 'text-[color:var(--ink)]'
                )}
              >
                {card.title}
              </p>
              <p
                className={cn(
                  'mt-1 text-[11px] font-medium leading-5',
                  card.featured ? 'text-white/80' : 'text-[color:var(--muted)]'
                )}
              >
                {card.subtitle}
              </p>
            </div>

            <div
              className={cn(
                'mt-3.5 flex items-center justify-between border-t pt-2.5 text-[11px] font-bold tabular-nums',
                card.featured
                  ? 'border-white/15 text-white/90'
                  : 'border-[color:var(--line)] text-[color:var(--muted)]'
              )}
            >
              <span className="truncate">{card.metric}</span>
              {card.key === 'treasury' && bankList.length > 0 ? (
                <span className="flex shrink-0 items-center -space-x-1.5 space-x-reverse">
                  {bankList.slice(0, 3).map((b) => (
                    <BankLogo
                      key={b.id}
                      name={b.name}
                      size="xs"
                      className="h-5 w-5 rounded-md ring-1 ring-[color:var(--surface-solid)]"
                    />
                  ))}
                </span>
              ) : null}
            </div>
          </button>
        ))}
      </section>

      {/* Bottom 2-Column Analytical Section */}
      {accounts.length === 0 ? (
        <EmptyState title="سرفصلی تعریف نشده است" description="ابتدا در بخش کدینگ و سرفصل‌ها حساب بسازید." />
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Heading Balances */}
          <div className="dash-card p-4 sm:p-5" data-testid="reports-roots-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-[color:var(--brand)]" />
                <h2 className="text-base font-extrabold text-[color:var(--ink)]">مانده سرفصل‌های عملیاتی</h2>
              </div>
              <PeriodSelect
                testId="reports-period"
                aria="دوره مانده سرفصل‌ها"
                value={monthKey}
                onChange={setMonthKey}
                options={monthOptions}
                includeAll
              />
            </div>

            {hasRows ? (
              <>
                <div className="mt-3.5 hidden md:block">
                  <div className="mb-1.5 grid grid-cols-[minmax(0,1.45fr)_3.5rem_minmax(0,0.95fr)_minmax(0,0.95fr)_7.5rem] items-center gap-2 rounded-xl bg-[color:var(--surface-2)] px-3 py-2 text-[11px] font-bold text-[color:var(--muted)]">
                    <span>سرفصل</span>
                    <span>زیرحساب</span>
                    <span>بدهکار</span>
                    <span>بستانکار</span>
                    <span className="text-left">مانده</span>
                  </div>
                  <div className="space-y-1.5" data-testid="reports-roots-rows">
                    {rootRows.map((r) => {
                      const isIncome = r.node.module === 'income';
                      return (
                        <button
                          key={r.node.id}
                          type="button"
                          data-testid="reports-root-row"
                          onClick={() => onOpenLedger(r.node.id)}
                          className="grid w-full grid-cols-[minmax(0,1.45fr)_3.5rem_minmax(0,0.95fr)_minmax(0,0.95fr)_7.5rem] items-center gap-2 rounded-xl border border-[color:var(--line)]/70 bg-[color:var(--surface-1)]/60 px-3 py-2.5 text-right transition hover:border-[color:var(--brand)]/35 hover:bg-[color:var(--surface-2)]/70"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 text-xs font-extrabold text-[color:var(--ink)]">
                            <ChevronLeft size={13} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
                            <span className="truncate">{r.node.name}</span>
                          </span>
                          <span className="text-xs font-bold tabular-nums text-[color:var(--muted)]">
                            {toPersianDigits(r.sub)}
                          </span>
                          <span className="text-xs font-bold tabular-nums text-[color:var(--ink)]">
                            {r.debit ? money(r.debit) : '۰'}
                          </span>
                          <span className="text-xs font-bold tabular-nums text-[color:var(--ink)]">
                            {r.credit ? money(r.credit) : '۰'}
                          </span>
                          <span
                            className={cn(
                              'justify-self-end text-xs font-black tabular-nums',
                              r.net === 0
                                ? 'text-[color:var(--muted)]'
                                : isIncome
                                  ? 'text-[color:var(--income)]'
                                  : 'text-[color:var(--expense)]'
                            )}
                          >
                            {r.net === 0 ? '۰' : r.net < 0 ? `(${money(r.net)})` : money(r.net)} تومان
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile stacked rows */}
                <div className="mt-3 space-y-2 md:hidden" data-testid="reports-roots-cards">
                  {rootRows.map((r) => {
                    const isIncome = r.node.module === 'income';
                    return (
                      <button
                        key={r.node.id}
                        type="button"
                        data-testid="reports-root-card"
                        onClick={() => onOpenLedger(r.node.id)}
                        className="w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] p-3.5 text-right shadow-[var(--shadow-sm)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-extrabold text-[color:var(--ink)]">
                            {r.node.name}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 text-xs font-black tabular-nums',
                              r.net === 0
                                ? 'text-[color:var(--muted)]'
                                : isIncome
                                  ? 'text-[color:var(--income)]'
                                  : 'text-[color:var(--expense)]'
                            )}
                          >
                            {r.net === 0 ? '۰' : r.net < 0 ? `(${money(r.net)})` : money(r.net)} تومان
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                          {toPersianDigits(r.sub)} زیرحساب · بدهکار {money(r.debit)} · بستانکار{' '}
                          {money(r.credit)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-6 rounded-2xl border border-dashed border-[color:var(--line)] px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                سرفصلی برای گزارش نیست
              </p>
            )}
          </div>

          <IncomeExpenseBars
            transactions={transactions}
            invoices={invoices}
            payrollEntries={payrollEntries}
          />
        </section>
      )}
    </div>
  );
};

export default Reports;
