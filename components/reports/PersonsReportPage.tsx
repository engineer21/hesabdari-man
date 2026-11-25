import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Search, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type {
  AppSettings,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  PayrollEntry,
  Transaction,
} from '../../types';
import { APP_NAME } from '../../constants';
import { buildPersonsReport } from '../../utils/financialReports';
import { computePersonBalance, type PersonBalanceSummary } from '../../utils/accrualEngine';
import { formatNumberWithCommas, toPersianDigits } from '../../utils/formatters';
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

interface PersonsReportPageProps {
  contacts: Contact[];
  contactGroups: ContactGroup[];
  transactions: Transaction[];
  invoices?: Invoice[];
  payrollEntries?: PayrollEntry[];
  checks?: CheckItem[];
  settings?: AppSettings;
  onOpenPerson: (contactId: string) => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(Math.abs(n))));

const PersonsReportPage: React.FC<PersonsReportPageProps> = ({
  contacts,
  contactGroups,
  transactions,
  invoices = [],
  payrollEntries = [],
  checks = [],
  settings,
  onOpenPerson,
}) => {
  const [groupId, setGroupId] = useState('');
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const storeName = settings?.name || APP_NAME;

  const report = useMemo(
    () =>
      buildPersonsReport(contacts, contactGroups, transactions, {
        groupId: groupId || undefined,
        query: query || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    [contacts, contactGroups, transactions, groupId, query, startDate, endDate]
  );

  const balanceByContact = useMemo(() => {
    const map = new Map<string, PersonBalanceSummary>();
    for (const c of contacts) {
      map.set(c.id, computePersonBalance(c.id, invoices, payrollEntries, checks, transactions));
    }
    return map;
  }, [contacts, invoices, payrollEntries, transactions, checks]);

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      report.rows.map((r) => {
        const bal = balanceByContact.get(r.contact.id);
        return {
          نام: r.contact.fullName,
          گروه: r.groupName,
          'تعداد تراکنش': r.txCount,
          'دریافت (نقدی)': r.income,
          'پرداخت (نقدی)': r.expense,
          'مانده حساب': bal
            ? bal.status === 'creditor'
              ? `${bal.payableAmount} طلبکار از ما`
              : bal.status === 'debtor'
                ? `${bal.receivableAmount} بدهکار به ما`
                : 'تسویه'
            : 'تسویه',
        };
      }),
      'گزارش عملکرد اشخاص',
      'persons-statement'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    const compact = pageSize === 'a5';
    await downloadTableReportPdf({
      title: 'گزارش عملکرد و تراز اشخاص',
      storeName,
      subtitle:
        startDate || endDate
          ? `${startDate ? `از ${formatDateFa(startDate)} ` : ''}${endDate ? `تا ${formatDateFa(endDate)}` : ''}`.trim()
          : 'کل دوره مالی',
      pageSize,
      filename: `persons-report-${pageSize}`,
      columns: compact
        ? [
            { header: 'طرف حساب', width: 2.3, align: 'right' },
            { header: 'گروه', width: 1.2, align: 'right' },
            { header: 'تراز خالص', width: 1.5, align: 'amount' },
          ]
        : [
            { header: 'طرف حساب', width: 2.1, align: 'right' },
            { header: 'گروه', width: 1.2, align: 'right' },
            { header: 'تراکنش', width: 0.8, align: 'amount' },
            { header: 'دریافت', width: 1.3, align: 'amount' },
            { header: 'پرداخت', width: 1.3, align: 'amount' },
            { header: 'تراز خالص', width: 1.3, align: 'amount' },
          ],
      rows: report.rows.map((r) =>
        compact
          ? [r.contact.fullName, r.groupName, formatMoneyFa(r.net)]
          : [
              r.contact.fullName,
              r.groupName,
              toPersianDigits(r.txCount),
              formatMoneyFa(r.income),
              formatMoneyFa(r.expense),
              formatMoneyFa(r.net),
            ]
      ),
      summary: [
        { label: 'جمع دریافت', value: formatMoneyFa(report.totalIncome) },
        { label: 'جمع پرداخت', value: formatMoneyFa(report.totalExpense) },
        { label: 'تراز خالص', value: formatMoneyFa(report.totalNet) },
      ],
    });
  };

  return (
    <div className="animate-page-enter mx-auto max-w-6xl space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="گزارش عملکرد و تراز اشخاص"
        subtitle="خلاصه دریافت‌ها، پرداخت‌ها و تراز مالی طرف‌حساب‌ها به تفکیک گروه"
        actions={
          <ExportActions
            onExcel={handleExcel}
            onPdf={handlePdf}
            disabled={report.rows.length === 0}
            permission="reports.export"
          />
        }
      />

      {/* Top 3 KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="kpi-income-card rounded-[1.45rem] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[color:var(--muted)]">جمع دریافت از اشخاص</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl tone-income">
              <TrendingUp size={17} />
            </span>
          </div>
          <p className="mt-2 truncate text-xl font-black tabular-nums text-[color:var(--income)] sm:text-2xl">
            +{money(report.totalIncome)}
            <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
          </p>
        </div>

        <div className="kpi-expense-card rounded-[1.45rem] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[color:var(--muted)]">جمع پرداخت به اشخاص</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl tone-expense">
              <TrendingDown size={17} />
            </span>
          </div>
          <p className="mt-2 truncate text-xl font-black tabular-nums text-[color:var(--expense)] sm:text-2xl">
            -{money(report.totalExpense)}
            <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
          </p>
        </div>

        <div className="balance-gradient rounded-[1.45rem] p-4 text-white sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-white/85">تراز خالص طرف‌حساب‌ها</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Users size={17} />
            </span>
          </div>
          <p className="mt-2 truncate text-xl font-black tabular-nums sm:text-2xl">
            {report.totalNet >= 0 ? '+' : '-'}
            {money(report.totalNet)}
            <span className="ms-1 text-xs font-semibold text-white/80">تومان</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold text-white/80">
            {toPersianDigits(report.activeCount)} شخص دارای گردش در بازه
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="dash-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={fieldLabel}>جست‌وجوی شخص</label>
            <div className="flex h-10 items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-4 focus-within:ring-[color:var(--brand)]/10">
              <Search size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="نام یا شماره تماس..."
                className="h-full min-w-0 flex-1 bg-transparent text-xs font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
              />
            </div>
          </div>

          <div>
            <label className={fieldLabel}>گروه اشخاص</label>
            <div className="relative">
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="form-control h-10 appearance-none py-0 pe-9 ps-3.5 text-xs font-bold"
              >
                <option value="">همه گروه‌ها</option>
                {contactGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
              />
            </div>
          </div>

          <div>
            <label className={fieldLabel}>از تاریخ</label>
            <PersianDatePicker value={startDate} onChange={setStartDate} clearable />
          </div>

          <div>
            <label className={fieldLabel}>تا تاریخ</label>
            <PersianDatePicker value={endDate} onChange={setEndDate} clearable />
          </div>
        </div>
      </section>

      {/* Group Breakdown Strip */}
      {report.groupSummaries.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {report.groupSummaries.map((gs) => (
            <button
              key={gs.groupId}
              type="button"
              onClick={() => setGroupId(groupId === gs.groupId ? '' : gs.groupId)}
              className={cn(
                'dash-card p-3.5 text-right transition',
                groupId === gs.groupId
                  ? 'border-[color:var(--brand)] ring-2 ring-[color:var(--brand)]/20'
                  : 'hover:border-[color:var(--brand)]/35'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-extrabold text-[color:var(--ink)]">
                  {gs.groupName}
                </span>
                <span className="text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                  {toPersianDigits(gs.count)} نفر
                </span>
              </div>
              <p
                className={cn(
                  'mt-2 truncate text-sm font-black tabular-nums',
                  gs.net >= 0 ? 'text-[color:var(--income)]' : 'text-[color:var(--expense)]'
                )}
              >
                {gs.net >= 0 ? '+' : '-'}
                {money(gs.net)} تومان
              </p>
            </button>
          ))}
        </section>
      ) : null}

      {/* Statements Table / Cards */}
      {report.rows.length === 0 ? (
        <EmptyState
          title="شخصی مطابق فیلتر پیدا نشد"
          description="فیلتر گروه یا بازه تاریخ را تغییر دهید."
        />
      ) : (
        <>
          <section className="dash-card hidden overflow-hidden md:block" data-testid="persons-report-table">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)]/85 text-[11px] font-extrabold text-[color:var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-right">طرف حساب</th>
                    <th className="px-4 py-3 text-right">گروه</th>
                    <th className="px-4 py-3 text-center">تعداد گردش</th>
                    <th className="px-4 py-3 text-left">دریافت نقدی</th>
                    <th className="px-4 py-3 text-left">پرداخت نقدی</th>
                    <th className="px-4 py-3 text-left">مانده (بدهکار / بستانکار)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]/65">
                  {report.rows.map((r) => {
                    const bal = balanceByContact.get(r.contact.id);
                    return (
                    <tr
                      key={r.contact.id}
                      onClick={() => onOpenPerson(r.contact.id)}
                      className="cursor-pointer transition hover:bg-[color:var(--brand-soft)]/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {r.contact.picture ? (
                            <img
                              src={r.contact.picture}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full tone-brand text-xs font-black">
                              {r.contact.fullName.trim().charAt(0)}
                            </span>
                          )}
                          <span className="flex min-w-0 items-center gap-1 font-bold text-[color:var(--ink)]">
                            <span className="truncate">{r.contact.fullName}</span>
                            <ChevronLeft size={13} className="shrink-0 text-[color:var(--muted)] opacity-60" />
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[color:var(--muted)]">
                        {r.groupName}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold tabular-nums text-[color:var(--muted)]">
                        {toPersianDigits(r.txCount)}
                      </td>
                      <td className="px-4 py-3 text-left font-bold tabular-nums text-[color:var(--income)]">
                        {r.income ? `+${money(r.income)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-left font-bold tabular-nums text-[color:var(--expense)]">
                        {r.expense ? `-${money(r.expense)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-left font-black tabular-nums">
                        {bal && bal.status === 'creditor' ? (
                          <span className="text-[color:var(--expense)]">
                            {money(bal.payableAmount)}{' '}
                            <span className="text-[10px] font-bold">طلبکار از ما</span>
                          </span>
                        ) : bal && bal.status === 'debtor' ? (
                          <span className="text-[color:var(--income)]">
                            {money(bal.receivableAmount)}{' '}
                            <span className="text-[10px] font-bold">بدهکار به ما</span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[color:var(--muted)]">تسویه‌شده</span>
                        )}
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-2.5 md:hidden">
            {report.rows.map((r) => (
              <button
                key={r.contact.id}
                type="button"
                onClick={() => onOpenPerson(r.contact.id)}
                className="dash-card block w-full p-3.5 text-right"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[color:var(--ink)]">
                      {r.contact.fullName}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--muted)]">
                      {r.groupName} · {toPersianDigits(r.txCount)} گردش
                    </p>
                  </div>
                  <p
                    className={cn(
                      'shrink-0 text-sm font-black tabular-nums',
                      r.net >= 0 ? 'text-[color:var(--income)]' : 'text-[color:var(--expense)]'
                    )}
                  >
                    {r.net >= 0 ? '+' : '-'}
                    {money(r.net)}
                  </p>
                </div>
                <p className="mt-2 border-t border-[color:var(--line)] pt-2 text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                  دریافت: {money(r.income)} · پرداخت: {money(r.expense)} تومان
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PersonsReportPage;
