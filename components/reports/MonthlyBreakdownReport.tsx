import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  Eye,
  FileText,
  Image as ImageIcon,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  Account,
  AppSettings,
  Attachment,
  CheckItem,
  Contact,
  Invoice,
  PayrollEntry,
  Transaction,
} from '../../types';
import { APP_NAME } from '../../constants';
import {
  buildMonthlyBreakdownReport,
  type BreakdownDetailItem,
  type BreakdownHeadingGroup,
} from '../../utils/accrualEngine';
import { attachmentSrc, isImageAttachment, isPdfAttachment } from '../../utils/attachments';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  toPersianDigits,
} from '../../utils/formatters';
import {
  JALALI_MONTH_NAMES,
  formatJalaliShort,
  getJalaliMonthGrid,
  getJalaliParts,
} from '../../utils/jalaliPeriod';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../../utils/export';
import PersianDatePicker from '../PersianDatePicker';
import AttachmentLightbox from '../ui/AttachmentLightbox';
import { ExportActions } from '../export/ExportActions';
import { Button, EmptyState, FormSheet, cn } from '../ui';

interface MonthlyBreakdownReportProps {
  accounts: Account[];
  contacts: Contact[];
  transactions: Transaction[];
  invoices: Invoice[];
  payrollEntries: PayrollEntry[];
  checks: CheckItem[];
  settings?: AppSettings;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const MonthlyBreakdownReport: React.FC<MonthlyBreakdownReportProps> = ({
  accounts,
  contacts,
  transactions,
  invoices,
  payrollEntries,
  checks,
  settings,
}) => {
  const storeName = settings?.name || APP_NAME;
  const todayParts = useMemo(() => getJalaliParts(new Date()) || { year: 1405, month: 9, day: 1 }, []);

  const [mode, setMode] = useState<'month' | 'all' | 'custom'>('all');
  const [selectedYear, setSelectedYear] = useState(todayParts.year);
  const [selectedMonth, setSelectedMonth] = useState(todayParts.month);
  const [customStart, setCustomStart] = useState(() => getLocalDateISOString(new Date()));
  const [customEnd, setCustomEnd] = useState(() => getLocalDateISOString(new Date()));

  const [expandedHeadings, setExpandedHeadings] = useState<Record<string, boolean>>({});
  const [expandedPersons, setExpandedPersons] = useState<Record<string, boolean>>({});
  const [detailItem, setDetailItem] = useState<BreakdownDetailItem | null>(null);
  const [lightboxAtt, setLightboxAtt] = useState<Attachment | null>(null);

  const dateRange = useMemo(() => {
    if (mode === 'all') return { startDate: undefined, endDate: undefined, label: 'کل دوره مالی' };
    if (mode === 'custom') {
      return {
        startDate: customStart,
        endDate: customEnd,
        label: `${formatJalaliShort(customStart)} تا ${formatJalaliShort(customEnd)}`,
      };
    }
    const grid = getJalaliMonthGrid(selectedYear, selectedMonth);
    const startDate = grid.days[0]?.iso;
    const endDate = grid.days[grid.days.length - 1]?.iso;
    return {
      startDate,
      endDate,
      label: `${JALALI_MONTH_NAMES[selectedMonth - 1]} ${toPersianDigits(String(selectedYear))}`,
    };
  }, [mode, selectedYear, selectedMonth, customStart, customEnd]);

  const report = useMemo(
    () =>
      buildMonthlyBreakdownReport(
        accounts,
        contacts,
        transactions,
        invoices,
        payrollEntries,
        checks,
        { startDate: dateRange.startDate, endDate: dateRange.endDate }
      ),
    [accounts, contacts, transactions, invoices, payrollEntries, checks, dateRange]
  );

  const toggleHeading = (key: string) =>
    setExpandedHeadings((prev) => ({ ...prev, [key]: !prev[key] }));
  const togglePerson = (key: string) =>
    setExpandedPersons((prev) => ({ ...prev, [key]: !prev[key] }));

  const expandAll = () => {
    const h: Record<string, boolean> = {};
    const p: Record<string, boolean> = {};
    for (const g of [...report.expenseHeadings, ...report.incomeHeadings]) {
      const hk = `${g.module}:${g.accountId}`;
      h[hk] = true;
      for (const per of g.persons) {
        p[`${hk}:${per.contactId}`] = true;
      }
    }
    setExpandedHeadings(h);
    setExpandedPersons(p);
  };

  const handleExcel = async () => {
    const flatRows: Record<string, string | number>[] = [];
    for (const group of [...report.expenseHeadings, ...report.incomeHeadings]) {
      for (const person of group.persons) {
        for (const item of person.items) {
          flatRows.push({
            بخش: group.module === 'expense' ? 'هزینه' : 'درآمد',
            سرفصل: group.accountName,
            شخص: person.contactName,
            ردیف: item.sequenceNumber ? `فاکتور شماره ${item.sequenceNumber}` : item.title,
            تاریخ: formatJalaliShort(item.date),
            شرح: item.description,
            'مبلغ (تومان)': item.amount,
          });
        }
      }
    }
    await downloadRowsAsExcel(flatRows, 'گزارش ماهانه تفکیکی', 'monthly-breakdown');
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    const rows: string[][] = [];
    for (const group of [...report.expenseHeadings, ...report.incomeHeadings]) {
      for (const person of group.persons) {
        rows.push([
          group.module === 'expense' ? 'هزینه' : 'درآمد',
          group.accountName,
          person.contactName,
          person.invoiceCount > 0
            ? `${toPersianDigits(String(person.invoiceCount))} فاکتور`
            : `${toPersianDigits(String(person.items.length))} ردیف`,
          formatMoneyFa(person.totalAmount),
        ]);
      }
    }
    await downloadTableReportPdf({
      title: 'گزارش ماهانه و ریز هزینه‌ها و درآمدها',
      storeName,
      subtitle: dateRange.label,
      pageSize,
      filename: `monthly-breakdown-${pageSize}`,
      columns: [
        { header: 'نوع', width: 0.9, align: 'right' },
        { header: 'سرفصل', width: 1.6, align: 'right' },
        { header: 'شخص / طرف‌حساب', width: 1.8, align: 'right' },
        { header: 'تعداد اسناد', width: 1.1, align: 'right' },
        { header: 'جمع مبلغ', width: 1.5, align: 'amount' },
      ],
      rows,
      summary: [
        { label: 'جمع درآمدها', value: formatMoneyFa(report.totalIncome) },
        { label: 'جمع هزینه‌ها', value: formatMoneyFa(report.totalExpense) },
        { label: 'سود / زیان خالص', value: formatMoneyFa(report.netProfit) },
      ],
    });
  };

  const renderSection = (title: string, icon: React.ReactNode, groups: BreakdownHeadingGroup[], tone: 'expense' | 'income') => (
    <section className="dash-card p-5" data-testid={`breakdown-${tone}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-black text-[color:var(--ink)]">{title}</h2>
        </div>
        <span
          className={cn(
            'text-sm font-black tabular-nums',
            tone === 'income' ? 'text-[color:var(--income)]' : 'text-[color:var(--expense)]'
          )}
        >
          {money(tone === 'income' ? report.totalIncome : report.totalExpense)} تومان
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[color:var(--line)] p-6 text-center text-xs font-bold text-[color:var(--muted)]">
          موردی در این بازه زمانی ثبت نشده است.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((heading) => {
            const hKey = `${heading.module}:${heading.accountId}`;
            const isHOpen = Boolean(expandedHeadings[hKey]);
            return (
              <div
                key={hKey}
                className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)]"
              >
                {/* Level 1: Heading */}
                <button
                  type="button"
                  onClick={() => toggleHeading(hKey)}
                  data-testid={`heading-${heading.accountId}`}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right transition hover:bg-[color:var(--surface-2)]/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {isHOpen ? (
                      <ChevronDown size={16} className="shrink-0 text-[color:var(--brand)]" />
                    ) : (
                      <ChevronLeft size={16} className="shrink-0 text-[color:var(--muted)]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[color:var(--ink)]">
                        {heading.accountName}
                      </p>
                      <p className="text-[11px] font-semibold text-[color:var(--muted)]">
                        {toPersianDigits(String(heading.persons.length))} طرف‌حساب · سهم{' '}
                        {toPersianDigits(String(heading.sharePct))}٪
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      'shrink-0 text-sm font-black tabular-nums',
                      tone === 'income' ? 'text-[color:var(--income)]' : 'text-[color:var(--expense)]'
                    )}
                  >
                    {money(heading.totalAmount)} تومان
                  </p>
                </button>

                {/* Level 2: Persons under Heading */}
                {isHOpen ? (
                  <div className="divide-y divide-[color:var(--line)]/60 border-t border-[color:var(--line)] bg-[color:var(--surface-2)]/35">
                    {heading.persons.map((person) => {
                      const pKey = `${hKey}:${person.contactId}`;
                      const isPOpen = Boolean(expandedPersons[pKey]);
                      return (
                        <div key={pKey}>
                          <button
                            type="button"
                            onClick={() => togglePerson(pKey)}
                            data-testid={`heading-person-${person.contactId}`}
                            className="flex w-full items-center justify-between gap-3 px-6 py-3 text-right transition hover:bg-[color:var(--surface-2)]/70"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {isPOpen ? (
                                <ChevronDown size={14} className="shrink-0 text-[color:var(--brand)]" />
                              ) : (
                                <ChevronLeft size={14} className="shrink-0 text-[color:var(--muted)]" />
                              )}
                              <span className="truncate text-xs font-extrabold text-[color:var(--ink)]">
                                {person.contactName}
                              </span>
                              <span className="rounded-full bg-[color:var(--surface-1)] px-2 py-0.5 text-[10.5px] font-bold text-[color:var(--muted)]">
                                {person.invoiceCount > 0
                                  ? `${toPersianDigits(String(person.invoiceCount))} فاکتور`
                                  : `${toPersianDigits(String(person.items.length))} ردیف`}
                              </span>
                            </div>
                            <span className="shrink-0 text-xs font-black tabular-nums text-[color:var(--ink)]">
                              {money(person.totalAmount)} تومان
                            </span>
                          </button>

                          {/* Level 3: Numbered Invoices & Entries */}
                          {isPOpen ? (
                            <div className="space-y-1.5 bg-[color:var(--surface-1)] px-8 py-3">
                              {person.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--line)]/70 bg-[color:var(--surface-2)]/40 px-3.5 py-2.5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-black text-[color:var(--brand)]">
                                        {item.sequenceNumber
                                          ? `فاکتور شماره ${toPersianDigits(String(item.sequenceNumber))}`
                                          : item.title}
                                      </span>
                                      <span className="text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                                        {formatJalaliShort(item.date)}
                                      </span>
                                      {item.invoice?.attachment ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand)]">
                                          <ImageIcon size={10} />
                                          تصویر
                                        </span>
                                      ) : null}
                                    </div>
                                    {item.description ? (
                                      <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">
                                        {item.description}
                                      </p>
                                    ) : null}
                                  </div>

                                  <div className="flex items-center gap-2.5">
                                    <span className="text-xs font-black tabular-nums text-[color:var(--ink)]">
                                      {money(item.amount)} تومان
                                    </span>
                                    {item.invoice ? (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        icon={Eye}
                                        data-testid={`report-invoice-detail-${item.invoice.id}`}
                                        onClick={() => setDetailItem(item)}
                                      >
                                        جزئیات
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="animate-page-enter space-y-5 md:space-y-6" data-testid="monthly-breakdown-report">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
            گزارش ماهانه و ریز هزینه‌ها و درآمدها
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)] md:text-sm">
            جمع‌بندی دقیق به تفکیک سرفصل ← اشخاص ← فاکتورهای شماره‌گذاری‌شده با مشاهده مستقیم تصویر فاکتور
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={expandAll} data-testid="breakdown-expand-all">
            بازکردن همه ردیف‌ها
          </Button>
          <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="reports.export" />
        </div>
      </div>

      {/* Period Filter Bar */}
      <section className="dash-card flex flex-wrap items-center gap-3 p-4">
        <div className="inline-flex rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1">
          {(
            [
              { id: 'all', label: 'کل دوره' },
              { id: 'month', label: 'ماه شمسی' },
              { id: 'custom', label: 'بازه دلخواه' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-extrabold transition',
                mode === m.id
                  ? 'btn-brand-gradient text-white shadow-xs'
                  : 'text-[color:var(--muted)]'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'month' ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="ماه شمسی"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="h-9 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3 text-xs font-bold text-[color:var(--ink)]"
            >
              {JALALI_MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="سال شمسی"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3 text-xs font-bold tabular-nums text-[color:var(--ink)]"
            >
              {[todayParts.year - 1, todayParts.year, todayParts.year + 1].map((y) => (
                <option key={y} value={y}>
                  {toPersianDigits(String(y))}
                </option>
              ))}
            </select>
          </div>
        ) : mode === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <PersianDatePicker value={customStart} onChange={setCustomStart} />
            </div>
            <span className="text-xs font-bold text-[color:var(--muted)]">تا</span>
            <div className="w-40">
              <PersianDatePicker value={customEnd} onChange={setCustomEnd} />
            </div>
          </div>
        ) : null}

        <span className="ms-auto inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--brand)]">
          <CalendarRange size={14} />
          بازه فعال: {dateRange.label}
        </span>
      </section>

      {/* Summary KPIs */}
      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="kpi-income-card rounded-2xl p-4">
          <p className="text-xs font-bold text-[color:var(--muted)]">کل درآمد دوره</p>
          <p className="mt-1.5 text-xl font-black tabular-nums text-[color:var(--income)]">
            {money(report.totalIncome)}
            <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
          </p>
        </div>
        <div className="kpi-expense-card rounded-2xl p-4">
          <p className="text-xs font-bold text-[color:var(--muted)]">کل هزینه‌های دوره</p>
          <p className="mt-1.5 text-xl font-black tabular-nums text-[color:var(--expense)]">
            {money(report.totalExpense)}
            <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
          </p>
        </div>
        <div className="dash-card rounded-2xl p-4">
          <p className="text-xs font-bold text-[color:var(--muted)]">سود / زیان خالص</p>
          <p
            className={cn(
              'mt-1.5 text-xl font-black tabular-nums',
              report.netProfit >= 0 ? 'text-[color:var(--income)]' : 'text-[color:var(--expense)]'
            )}
          >
            {report.netProfit >= 0 ? '+' : '-'}
            {money(Math.abs(report.netProfit))}
            <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
          </p>
        </div>
        <div className="dash-card rounded-2xl p-4">
          <p className="text-xs font-bold text-[color:var(--muted)]">هزینه سود وام دوره</p>
          <p className="mt-1.5 text-xl font-black tabular-nums text-[color:var(--brand)]">
            {money(report.loanInterestTotal)}
            <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
          </p>
        </div>
      </section>

      {/* Labor Expense Breakdown by Real Chart of Accounts Headings */}
      {report.laborBreakdown.length > 0 ? (
        <section className="dash-card p-5" data-testid="monthly-labor-headings">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-[color:var(--ink)]">
            <Briefcase size={16} className="text-[color:var(--brand)]" />
            تفکیک هزینه‌های نیروی انسانی و کارکرد (بر اساس سرفصل)
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.laborBreakdown.map((l) => (
              <div
                key={l.accountId}
                data-testid={`labor-heading-card-${l.accountId}`}
                className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-extrabold text-[color:var(--ink)]">{l.label}</p>
                  {l.accountCode && l.accountCode !== '—' ? (
                    <span className="shrink-0 rounded-md bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[color:var(--brand)]">
                      {toPersianDigits(l.accountCode)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-base font-black tabular-nums text-[color:var(--ink)]">
                  {money(l.amount)} <span className="text-[10px] font-semibold">تومان</span>
                </p>
                <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                  {toPersianDigits(String(l.count))} ردیف ثبت‌شده
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 3-Level Drill-Down Sections */}
      {report.expenseHeadings.length === 0 && report.incomeHeadings.length === 0 ? (
        <EmptyState
          title="داده‌ای برای گزارش ماهانه وجود ندارد"
          description="فاکتور، کارکرد پرسنل یا تراکنش در این بازه ثبت کنید تا تفکیک سرفصل ← شخص ← فاکتور نمایش داده شود."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {renderSection(
            'ریز هزینه‌ها (سرفصل ← اشخاص ← فاکتورها)',
            <TrendingDown size={18} className="text-[color:var(--expense)]" />,
            report.expenseHeadings,
            'expense'
          )}
          {renderSection(
            'ریز درآمدها (سرفصل ← اشخاص ← فاکتورها)',
            <TrendingUp size={18} className="text-[color:var(--income)]" />,
            report.incomeHeadings,
            'income'
          )}
        </div>
      )}

      {/* Invoice Photo + Settlement Detail Modal inside Report */}
      <FormSheet
        isOpen={Boolean(detailItem?.invoice)}
        onClose={() => setDetailItem(null)}
        accent="brand"
        size="lg"
        dock
        title={
          detailItem?.invoice
            ? `جزئیات فاکتور #${toPersianDigits(detailItem.invoice.invoiceNumber)}`
            : 'جزئیات فاکتور'
        }
        subtitle={
          detailItem?.invoice ? formatJalaliShort(detailItem.invoice.date) : undefined
        }
        footer={
          <Button variant="secondary" onClick={() => setDetailItem(null)}>
            بستن
          </Button>
        }
      >
        {detailItem?.invoice && detailItem.settlement ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 p-3">
                <p className="text-[11px] font-bold text-[color:var(--muted)]">مبلغ فاکتور</p>
                <p className="mt-1 text-sm font-black tabular-nums text-[color:var(--ink)]">
                  {money(detailItem.invoice.amount)}
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 p-3">
                <p className="text-[11px] font-bold text-[color:var(--muted)]">تسویه‌شده</p>
                <p className="mt-1 text-sm font-black tabular-nums text-[color:var(--income)]">
                  {money(detailItem.settlement.settledTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 p-3">
                <p className="text-[11px] font-bold text-[color:var(--muted)]">مانده باز</p>
                <p className="mt-1 text-sm font-black tabular-nums text-[color:var(--expense)]">
                  {money(detailItem.settlement.remaining)}
                </p>
              </div>
            </div>

            {detailItem.invoice.description ? (
              <p className="rounded-xl bg-[color:var(--surface-2)]/50 p-3 text-xs font-medium text-[color:var(--ink)]">
                {detailItem.invoice.description}
              </p>
            ) : null}

            {detailItem.invoice.attachment ? (
              isImageAttachment(detailItem.invoice.attachment) ? (
                <button
                  type="button"
                  onClick={() => setLightboxAtt(detailItem.invoice!.attachment!)}
                  className="block w-full overflow-hidden rounded-2xl border border-[color:var(--line)]"
                >
                  <img
                    src={attachmentSrc(detailItem.invoice.attachment)}
                    alt={detailItem.invoice.attachment.name}
                    className="max-h-80 w-full object-contain"
                  />
                </button>
              ) : isPdfAttachment(detailItem.invoice.attachment) ? (
                <a
                  href={attachmentSrc(detailItem.invoice.attachment)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] px-4 py-2 text-xs font-bold text-[color:var(--brand)]"
                >
                  <FileText size={16} />
                  بازکردن فایل PDF فاکتور
                </a>
              ) : null
            ) : (
              <p className="rounded-xl border border-dashed border-[color:var(--line)] p-4 text-center text-xs text-[color:var(--muted)]">
                تصویر فاکتور پیوست نشده است.
              </p>
            )}
          </div>
        ) : null}
      </FormSheet>

      <AttachmentLightbox attachment={lightboxAtt} onClose={() => setLightboxAtt(null)} />
    </div>
  );
};

export default MonthlyBreakdownReport;
