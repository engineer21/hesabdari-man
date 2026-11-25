import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  Landmark,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  Account,
  AccountModule,
  AppSettings,
  Invoice,
  PayrollEntry,
  Transaction,
} from '../../types';
import { APP_NAME } from '../../constants';
import { buildTrialBalance } from '../../utils/financialReports';
import { formatNumberWithCommas, getLocalDateISOString, toPersianDigits } from '../../utils/formatters';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../../utils/export';
import PersianDatePicker from '../PersianDatePicker';
import { ExportActions } from '../export/ExportActions';
import { EmptyState, WorkspaceHeader, cn, fieldLabel } from '../ui';

interface TrialBalanceReportProps {
  accounts: Account[];
  transactions: Transaction[];
  invoices?: Invoice[];
  payrollEntries?: PayrollEntry[];
  settings?: AppSettings;
  onOpenLedger: (accountId: string) => void;
}

type ReportTab = 'trial' | 'pnl';

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(Math.abs(n))));

function shiftDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getLocalDateISOString(d);
}

const MODULE_META: { id: AccountModule; title: string; tone: string }[] = [
  { id: 'bank', title: 'دارایی‌های نقد و بانک', tone: 'text-[color:var(--brand)]' },
  { id: 'income', title: 'درآمدها و فروش', tone: 'text-[color:var(--income)]' },
  { id: 'expense', title: 'هزینه‌های عملیاتی و اداری', tone: 'text-[color:var(--expense)]' },
];

const TrialBalanceReport: React.FC<TrialBalanceReportProps> = ({
  accounts,
  transactions,
  invoices = [],
  payrollEntries = [],
  settings,
  onOpenLedger,
}) => {
  const [tab, setTab] = useState<ReportTab>('trial');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  const storeName = settings?.name || APP_NAME;
  const summary = useMemo(
    () =>
      buildTrialBalance(accounts, transactions, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        invoices,
        payrollEntries,
      }),
    [accounts, transactions, invoices, payrollEntries, startDate, endDate]
  );

  const visibleRows = useMemo(
    () =>
      onlyActive
        ? summary.rows.filter(
            (r) => r.turnoverDebit > 0 || r.turnoverCredit > 0 || r.closingDebit > 0 || r.closingCredit > 0
          )
        : summary.rows,
    [summary.rows, onlyActive]
  );

  const rangeSubtitle =
    startDate || endDate
      ? [startDate ? `از ${formatDateFa(startDate)}` : null, endDate ? `تا ${formatDateFa(endDate)}` : null]
          .filter(Boolean)
          .join(' ')
      : 'کل دوره مالی';

  const handleExcel = async () => {
    if (tab === 'pnl') {
      await downloadRowsAsExcel(
        [
          ...summary.incomeBreakdown.map((i) => ({
            بخش: 'درآمد',
            کد: i.account.code,
            سرفصل: i.account.name,
            مبلغ: i.amount,
            'سهم (٪)': i.sharePct,
          })),
          ...summary.expenseBreakdown.map((e) => ({
            بخش: 'هزینه',
            کد: e.account.code,
            سرفصل: e.account.name,
            مبلغ: e.amount,
            'سهم (٪)': e.sharePct,
          })),
        ],
        'صورت سود و زیان',
        'profit-and-loss'
      );
      return;
    }

    await downloadRowsAsExcel(
      visibleRows.map((r) => ({
        کد: r.account.code,
        سرفصل: r.account.name,
        'گردش بدهکار': r.turnoverDebit,
        'گردش بستانکار': r.turnoverCredit,
        'مانده بدهکار': r.closingDebit,
        'مانده بستانکار': r.closingCredit,
      })),
      'تراز آزمایشی',
      'trial-balance'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    if (tab === 'pnl') {
      const rows = [
        ...summary.incomeBreakdown.map((i) => ['درآمد', i.account.name, formatMoneyFa(i.amount), `${toPersianDigits(i.sharePct)}٪`]),
        ...summary.expenseBreakdown.map((e) => ['هزینه', e.account.name, formatMoneyFa(e.amount), `${toPersianDigits(e.sharePct)}٪`]),
      ];
      await downloadTableReportPdf({
        title: 'صورت سود و زیان دوره',
        storeName,
        subtitle: rangeSubtitle,
        pageSize,
        filename: `profit-loss-${pageSize}`,
        columns: [
          { header: 'بخش', width: 1, align: 'right' },
          { header: 'سرفصل', width: 2.8, align: 'right' },
          { header: 'مبلغ', width: 1.5, align: 'amount' },
          { header: 'سهم', width: 0.9, align: 'amount' },
        ],
        rows,
        summary: [
          { label: 'جمع درآمدها', value: formatMoneyFa(summary.totalIncome) },
          { label: 'جمع هزینه‌ها', value: formatMoneyFa(summary.totalExpense) },
          { label: summary.netProfit >= 0 ? 'سود خالص' : 'زیان خالص', value: formatMoneyFa(summary.netProfit) },
        ],
      });
      return;
    }

    await downloadTableReportPdf({
      title: 'تراز آزمایشی چهارستونی',
      storeName,
      subtitle: rangeSubtitle,
      pageSize,
      filename: `trial-balance-${pageSize}`,
      columns: [
        { header: 'کد', width: 0.8, align: 'right' },
        { header: 'نام حساب', width: 2.2, align: 'right' },
        { header: 'گردش بدهکار', width: 1.2, align: 'amount' },
        { header: 'گردش بستانکار', width: 1.2, align: 'amount' },
        { header: 'مانده بدهکار', width: 1.2, align: 'amount' },
        { header: 'مانده بستانکار', width: 1.2, align: 'amount' },
      ],
      rows: visibleRows.map((r) => [
        r.account.code,
        r.account.name,
        r.turnoverDebit ? formatMoneyFa(r.turnoverDebit) : '۰',
        r.turnoverCredit ? formatMoneyFa(r.turnoverCredit) : '۰',
        r.closingDebit ? formatMoneyFa(r.closingDebit) : '۰',
        r.closingCredit ? formatMoneyFa(r.closingCredit) : '۰',
      ]),
      summary: [
        { label: 'جمع گردش بدهکار', value: formatMoneyFa(summary.totalTurnoverDebit) },
        { label: 'جمع گردش بستانکار', value: formatMoneyFa(summary.totalTurnoverCredit) },
        { label: 'جمع مانده بدهکار', value: formatMoneyFa(summary.totalClosingDebit) },
        { label: 'جمع مانده بستانکار', value: formatMoneyFa(summary.totalClosingCredit) },
      ],
    });
  };

  const applyPreset = (preset: 'all' | '30d' | '90d') => {
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === '30d') {
      setStartDate(shiftDaysIso(30));
      setEndDate(getLocalDateISOString(new Date()));
    } else {
      setStartDate(shiftDaysIso(90));
      setEndDate(getLocalDateISOString(new Date()));
    }
  };

  const isProfit = summary.netProfit >= 0;

  return (
    <div className="animate-page-enter mx-auto max-w-6xl space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="تراز آزمایشی و سود و زیان"
        subtitle="ارزیابی تراز چهارستونی حساب‌ها و صورت سود و زیان عملیاتی"
        actions={
          <ExportActions
            onExcel={handleExcel}
            onPdf={handlePdf}
            disabled={summary.rows.length === 0}
            permission="reports.export"
          />
        }
      />

      {/* Mode Switcher + Date Range Filter Bar */}
      <section className="dash-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div
            className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1 lg:w-80"
            role="tablist"
            aria-label="نوع گزارش مالی"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'trial'}
              data-testid="tab-trial-balance"
              onClick={() => setTab('trial')}
              className={cn(
                'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold transition',
                tab === 'trial'
                  ? 'btn-brand-gradient text-white shadow-sm'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              <Scale size={14} aria-hidden />
              تراز آزمایشی
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'pnl'}
              data-testid="tab-profit-loss"
              onClick={() => setTab('pnl')}
              className={cn(
                'flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-extrabold transition',
                tab === 'pnl'
                  ? 'btn-brand-gradient text-white shadow-sm'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              <TrendingUp size={14} aria-hidden />
              صورت سود و زیان
            </button>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-lg">
            <div>
              <label className={fieldLabel}>از تاریخ</label>
              <PersianDatePicker value={startDate} onChange={setStartDate} clearable />
            </div>
            <div>
              <label className={fieldLabel}>تا تاریخ</label>
              <PersianDatePicker value={endDate} onChange={setEndDate} clearable />
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--line)] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'کل دوره' },
                { id: '30d', label: '۳۰ روز اخیر' },
                { id: '90d', label: '۳ ماه اخیر' },
              ] as const
            ).map((p) => {
              const active = p.id === 'all' && !startDate && !endDate;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-[11px] font-bold transition whitespace-nowrap',
                    active
                      ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                      : 'border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {tab === 'trial' ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[color:var(--ink)]">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--brand)]"
              />
              فقط حساب‌های دارای گردش
            </label>
          ) : null}
        </div>
      </section>

      {tab === 'trial' ? (
        <>
          {/* 4-Column Summary Strip */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="dash-card p-4">
              <p className="text-[11px] font-bold text-[color:var(--muted)]">جمع گردش بدهکار</p>
              <p className="mt-1.5 truncate text-lg font-black tabular-nums text-[color:var(--ink)] sm:text-xl">
                {money(summary.totalTurnoverDebit)}
                <span className="ms-1 text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="dash-card p-4">
              <p className="text-[11px] font-bold text-[color:var(--muted)]">جمع گردش بستانکار</p>
              <p className="mt-1.5 truncate text-lg font-black tabular-nums text-[color:var(--ink)] sm:text-xl">
                {money(summary.totalTurnoverCredit)}
                <span className="ms-1 text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="dash-card p-4">
              <p className="text-[11px] font-bold text-[color:var(--muted)]">جمع مانده بدهکار</p>
              <p className="mt-1.5 truncate text-lg font-black tabular-nums text-[color:var(--brand)] sm:text-xl">
                {money(summary.totalClosingDebit)}
                <span className="ms-1 text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="dash-card p-4">
              <p className="text-[11px] font-bold text-[color:var(--muted)]">جمع مانده بستانکار</p>
              <p className="mt-1.5 truncate text-lg font-black tabular-nums text-[color:var(--income)] sm:text-xl">
                {money(summary.totalClosingCredit)}
                <span className="ms-1 text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
          </section>

          {visibleRows.length === 0 ? (
            <EmptyState
              title="گردشی در این بازه ثبت نشده است"
              description="بازه تاریخ را تغییر دهید یا گزینه نمایش همه حساب‌ها را فعال کنید."
            />
          ) : (
            <>
              {/* Desktop & Tablet 4-Column Trial Balance Table */}
              <section className="dash-card hidden overflow-hidden md:block" data-testid="trial-balance-table">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)]/85 text-[11px] font-extrabold text-[color:var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 text-right">کد</th>
                        <th className="px-4 py-3 text-right">نام حساب / سرفصل</th>
                        <th className="px-4 py-3 text-left">گردش بدهکار</th>
                        <th className="px-4 py-3 text-left">گردش بستانکار</th>
                        <th className="px-4 py-3 text-left">مانده بدهکار</th>
                        <th className="px-4 py-3 text-left">مانده بستانکار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULE_META.map((mod) => {
                        const modRows = visibleRows.filter((r) => r.module === mod.id);
                        if (modRows.length === 0) return null;
                        return (
                          <React.Fragment key={mod.id}>
                            <tr className="bg-[color:var(--surface-2)]/40">
                              <td
                                colSpan={6}
                                className={cn('px-4 py-2 text-xs font-black', mod.tone)}
                              >
                                {mod.title}
                              </td>
                            </tr>
                            {modRows.map((r) => (
                              <tr
                                key={r.account.id}
                                onClick={() => onOpenLedger(r.account.id)}
                                className="cursor-pointer border-t border-[color:var(--line)]/65 transition hover:bg-[color:var(--brand-soft)]/35"
                              >
                                <td className="px-4 py-2.5 text-xs font-bold tabular-nums text-[color:var(--muted)]">
                                  {toPersianDigits(r.account.code)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="flex items-center gap-1.5 font-bold text-[color:var(--ink)]">
                                    <span>{r.account.name}</span>
                                    <ChevronLeft size={13} className="text-[color:var(--muted)] opacity-60" />
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-left font-semibold tabular-nums text-[color:var(--ink)]">
                                  {r.turnoverDebit ? money(r.turnoverDebit) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-left font-semibold tabular-nums text-[color:var(--ink)]">
                                  {r.turnoverCredit ? money(r.turnoverCredit) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-left font-bold tabular-nums text-[color:var(--brand)]">
                                  {r.closingDebit ? money(r.closingDebit) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-left font-bold tabular-nums text-[color:var(--income)]">
                                  {r.closingCredit ? money(r.closingCredit) : '—'}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-[color:var(--line)] bg-[color:var(--surface-2)]/90 font-black">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right text-xs text-[color:var(--ink)]">
                          جمع کل تراز ({toPersianDigits(visibleRows.length)} حساب)
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-[color:var(--ink)]">
                          {money(summary.totalTurnoverDebit)}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-[color:var(--ink)]">
                          {money(summary.totalTurnoverCredit)}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-[color:var(--brand)]">
                          {money(summary.totalClosingDebit)}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums text-[color:var(--income)]">
                          {money(summary.totalClosingCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {/* Mobile Stacked Trial Balance Cards */}
              <div className="space-y-2.5 md:hidden">
                {visibleRows.map((r) => (
                  <button
                    key={r.account.id}
                    type="button"
                    onClick={() => onOpenLedger(r.account.id)}
                    className="dash-card block w-full p-3.5 text-right"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-[color:var(--ink)]">
                          {r.account.name}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                          کد {toPersianDigits(r.account.code)} · {toPersianDigits(r.txCount)} گردش
                        </p>
                      </div>
                      <ChevronLeft size={16} className="shrink-0 text-[color:var(--muted)]" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[color:var(--line)] pt-2.5 text-xs tabular-nums">
                      <div>
                        <span className="block text-[10px] text-[color:var(--muted)]">گردش بد / بس</span>
                        <span className="font-bold text-[color:var(--ink)]">
                          {money(r.turnoverDebit)} / {money(r.turnoverCredit)}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="block text-[10px] text-[color:var(--muted)]">مانده نهایی</span>
                        <span
                          className={cn(
                            'font-black',
                            r.closingDebit > 0 ? 'text-[color:var(--brand)]' : 'text-[color:var(--income)]'
                          )}
                        >
                          {money(Math.abs(r.netClosing))}{' '}
                          {r.netClosing > 0 ? 'بد' : r.netClosing < 0 ? 'بس' : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        /* Profit & Loss Statement View */
        <div className="space-y-5" data-testid="pnl-statement">
          {/* Profit / Loss Hero Banner */}
          <section className="balance-gradient rounded-[1.5rem] p-5 text-white sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-white/80">
                  {isProfit ? 'سود خالص عملیات دوره' : 'زیان خالص عملیات دوره'} · {rangeSubtitle}
                </p>
                <p className="mt-2 text-2xl font-black tabular-nums tracking-tight sm:text-4xl">
                  {isProfit ? '+' : '-'}
                  {money(summary.netProfit)}
                  <span className="ms-2 text-sm font-bold text-white/80">تومان</span>
                </p>
              </div>
              <div className="flex items-center gap-5 rounded-2xl bg-white/14 px-4 py-3 backdrop-blur-md">
                <div>
                  <p className="text-[11px] font-semibold text-white/75">حاشیه سود</p>
                  <p className="mt-0.5 text-xl font-black tabular-nums">
                    {toPersianDigits(summary.profitMarginPct)}٪
                  </p>
                </div>
                <span className="h-9 w-px bg-white/20" aria-hidden />
                <div>
                  <p className="text-[11px] font-semibold text-white/75">درآمد / هزینه</p>
                  <p className="mt-0.5 text-xs font-extrabold tabular-nums">
                    {money(summary.totalIncome)} / {money(summary.totalExpense)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Two-Column Revenue & Expense Breakdown */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Income Breakdown */}
            <div className="dash-card p-5">
              <div className="mb-4 flex items-center justify-between border-b border-[color:var(--line)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-income">
                    <TrendingUp size={16} />
                  </span>
                  <h2 className="text-base font-extrabold text-[color:var(--ink)]">سرفصل‌های درآمد</h2>
                </div>
                <span className="text-sm font-black tabular-nums text-[color:var(--income)]">
                  {money(summary.totalIncome)} تومان
                </span>
              </div>

              {summary.incomeBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--muted)]">
                  درآمدی در این بازه ثبت نشده است
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.incomeBreakdown.map((item) => (
                    <button
                      key={item.account.id}
                      type="button"
                      onClick={() => onOpenLedger(item.account.id)}
                      className="block w-full rounded-xl p-2 text-right transition hover:bg-[color:var(--surface-2)]/70"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-bold text-[color:var(--ink)]">
                          {item.account.name}
                        </span>
                        <span className="shrink-0 font-black tabular-nums text-[color:var(--income)]">
                          {money(item.amount)} تومان ({toPersianDigits(item.sharePct)}٪)
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.max(4, item.sharePct)}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Expense Breakdown */}
            <div className="dash-card p-5">
              <div className="mb-4 flex items-center justify-between border-b border-[color:var(--line)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-expense">
                    <TrendingDown size={16} />
                  </span>
                  <h2 className="text-base font-extrabold text-[color:var(--ink)]">سرفصل‌های هزینه</h2>
                </div>
                <span className="text-sm font-black tabular-nums text-[color:var(--expense)]">
                  {money(summary.totalExpense)} تومان
                </span>
              </div>

              {summary.expenseBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-[color:var(--muted)]">
                  هزینه‌ای در این بازه ثبت نشده است
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.expenseBreakdown.map((item) => (
                    <button
                      key={item.account.id}
                      type="button"
                      onClick={() => onOpenLedger(item.account.id)}
                      className="block w-full rounded-xl p-2 text-right transition hover:bg-[color:var(--surface-2)]/70"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-bold text-[color:var(--ink)]">
                          {item.account.name}
                        </span>
                        <span className="shrink-0 font-black tabular-nums text-[color:var(--expense)]">
                          {money(item.amount)} تومان ({toPersianDigits(item.sharePct)}٪)
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                        <div
                          className="h-full rounded-full bg-rose-500 transition-all"
                          style={{ width: `${Math.max(4, item.sharePct)}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Bank Liquidity Context Footer */}
          <section className="dash-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2.5 text-xs font-bold text-[color:var(--muted)]">
              <Landmark size={16} className="text-[color:var(--brand)]" />
              <span>انتقال‌های بین‌بانکی بدون ایجاد تورم از محاسبه سود و زیان کنار گذاشته شده‌اند.</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default TrialBalanceReport;
