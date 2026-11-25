import React, { useMemo, useState, useEffect } from 'react';
import { BookOpenText, ChevronDown, Paperclip } from 'lucide-react';
import { APP_NAME } from '../constants';
import type {
  Account,
  AppSettings,
  Contact,
  ContactGroup,
  Invoice,
  PayrollEntry,
  Transaction,
} from '../types';
import { buildAccountLedger } from '../utils/accountLedger';
import { getAccountPathLabel, moduleLabel } from '../utils/accountTree';
import { contactLabel } from '../utils/contactStats';
import { formatNumberWithCommas, getLocalDateISOString, toPersianDigits } from '../utils/formatters';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import PersianDatePicker from './PersianDatePicker';
import { ExportActions } from './export/ExportActions';
import { BankLogo } from './ui/BankLogo';
import AttachmentLightbox from './ui/AttachmentLightbox';
import { WorkspaceHeader, EmptyState, fieldLabel, cn } from './ui';

interface AccountLedgerReportProps {
  accounts: Account[];
  transactions: Transaction[];
  invoices?: Invoice[];
  payrollEntries?: PayrollEntry[];
  contacts?: Contact[];
  contactGroups?: ContactGroup[];
  settings?: AppSettings;
  initialAccountId?: string;
  onBack?: () => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(Math.abs(n))));

function shiftDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getLocalDateISOString(d);
}

const AccountLedgerReport: React.FC<AccountLedgerReportProps> = ({
  accounts,
  transactions,
  invoices = [],
  payrollEntries = [],
  contacts = [],
  contactGroups = [],
  settings,
  initialAccountId,
}) => {
  const activeAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive !== false)
        .sort((a, b) => a.code.localeCompare(b.code, 'fa', { numeric: true })),
    [accounts]
  );

  const [accountId, setAccountId] = useState(
    initialAccountId || activeAccounts.find((a) => a.id === 'acc_bank')?.id || activeAccounts[0]?.id || ''
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeChildren, setIncludeChildren] = useState(true);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    if (initialAccountId) setAccountId(initialAccountId);
  }, [initialAccountId]);

  const groupedAccounts = useMemo(
    () => ({
      bank: activeAccounts.filter((a) => a.module === 'bank'),
      income: activeAccounts.filter((a) => a.module === 'income'),
      expense: activeAccounts.filter((a) => a.module === 'expense'),
    }),
    [activeAccounts]
  );

  const account = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);

  const report = useMemo(() => {
    if (!account) return null;
    return buildAccountLedger(account, accounts, transactions, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includeChildren,
      invoices,
      payrollEntries,
    });
  }, [account, accounts, transactions, invoices, payrollEntries, startDate, endDate, includeChildren]);

  const balanceText = (balance: number) => {
    if (balance === 0) return '۰';
    return `${balance < 0 ? '-' : ''}${money(balance)}`;
  };

  const storeName = settings?.name || APP_NAME;

  const rangeLabel = [
    startDate ? `از ${formatDateFa(startDate)}` : null,
    endDate ? `تا ${formatDateFa(endDate)}` : null,
    includeChildren ? 'شامل زیرسرفصل‌ها' : null,
  ]
    .filter(Boolean)
    .join(' · ');

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

  const handleExcel = async () => {
    if (!report || !account) return;
    await downloadRowsAsExcel(
      [
        { تاریخ: 'مانده ابتدا', شرح: '', بدهکار: '', بستانکار: '', مانده: report.openingBalance },
        ...report.rows.map((r) => {
          const tx = transactions.find((t) => t.id === r.entryId || `${t.id}:in` === r.entryId || `${t.id}:out` === r.entryId);
          const person = contactLabel(contacts, contactGroups, tx?.contactId);
          return {
            تاریخ: r.date,
            شرح: person ? `${r.description} (${person})` : r.description,
            بدهکار: r.debit,
            بستانکار: r.credit,
            مانده: r.balance,
            سرفصل: r.accountName,
          };
        }),
      ],
      'دفتر کل سرفصل',
      `ledger-${account.code}`
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    if (!report || !account) return;
    const rows = [
      ['مانده ابتدا', '—', '—', '—', formatMoneyFa(report.openingBalance)],
      ...report.rows.map((r) => {
        const tx = transactions.find((t) => t.id === r.entryId || `${t.id}:in` === r.entryId || `${t.id}:out` === r.entryId);
        const person = contactLabel(contacts, contactGroups, tx?.contactId);
        const desc = [r.description, person, includeChildren && account.kind === 'group' ? r.accountName : '']
          .filter(Boolean)
          .join(' · ');
        return [
          formatDateFa(r.date),
          desc,
          r.debit ? formatMoneyFa(r.debit) : '—',
          r.credit ? formatMoneyFa(r.credit) : '—',
          formatMoneyFa(r.balance),
        ];
      }),
    ];

    await downloadTableReportPdf({
      title: `دفتر گردش — ${account.code} ${account.name}`,
      storeName,
      subtitle: [getAccountPathLabel(accounts, account.id), rangeLabel].filter(Boolean).join(' · '),
      pageSize,
      filename: `ledger-${account.code}-${pageSize}`,
      columns: [
        { header: 'تاریخ', width: 1.2, align: 'right' },
        { header: 'شرح', width: 3.4, align: 'right' },
        { header: 'بدهکار', width: 1.3, align: 'amount' },
        { header: 'بستانکار', width: 1.3, align: 'amount' },
        { header: 'مانده', width: 1.3, align: 'amount' },
      ],
      rows,
      summary: [
        { label: 'جمع بدهکار', value: formatMoneyFa(report.turnoverDebit) },
        { label: 'جمع بستانکار', value: formatMoneyFa(report.turnoverCredit) },
        { label: 'مانده پایان', value: formatMoneyFa(report.closingBalance) },
      ],
    });
  };

  return (
    <div className="mx-auto max-w-6xl animate-page-enter space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="دفتر کل و گردش سرفصل"
        subtitle="مشاهده ریز اسناد، گردش بدهکار/بستانکار و مانده لحظه‌ای در هر سطح درخت حساب‌ها"
        actions={
          <ExportActions
            onExcel={handleExcel}
            onPdf={handlePdf}
            disabled={!report}
            permission="reports.export"
          />
        }
      />

      {/* Unified Filter Card */}
      <section className="dash-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
          <div className="md:col-span-6">
            <label className={fieldLabel}>انتخاب حساب یا سرفصل</label>
            <div className="relative">
              <select
                className="form-control h-10 appearance-none py-0 pe-9 ps-3.5 text-xs font-bold"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">انتخاب سرفصل...</option>
                {groupedAccounts.bank.length > 0 ? (
                  <optgroup label="بانک‌ها و صندوق‌ها">
                    {groupedAccounts.bank.map((a) => (
                      <option key={a.id} value={a.id}>
                        {toPersianDigits(a.code)} — {getAccountPathLabel(accounts, a.id)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {groupedAccounts.income.length > 0 ? (
                  <optgroup label="سرفصل‌های درآمد">
                    {groupedAccounts.income.map((a) => (
                      <option key={a.id} value={a.id}>
                        {toPersianDigits(a.code)} — {getAccountPathLabel(accounts, a.id)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {groupedAccounts.expense.length > 0 ? (
                  <optgroup label="سرفصل‌های هزینه">
                    {groupedAccounts.expense.map((a) => (
                      <option key={a.id} value={a.id}>
                        {toPersianDigits(a.code)} — {getAccountPathLabel(accounts, a.id)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className={fieldLabel}>از تاریخ</label>
            <PersianDatePicker value={startDate} onChange={setStartDate} clearable />
          </div>

          <div className="md:col-span-3">
            <label className={fieldLabel}>تا تاریخ</label>
            <PersianDatePicker value={endDate} onChange={setEndDate} clearable />
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-3">
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

          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[color:var(--ink)]">
            <input
              type="checkbox"
              checked={includeChildren}
              onChange={(e) => setIncludeChildren(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--brand)]"
            />
            شامل زیرسرفصل‌ها
          </label>
        </div>
      </section>

      {!account ? (
        <EmptyState title="سرفصلی انتخاب نشده است" description="از فهرست بالا یک حساب یا گروه را انتخاب کنید." />
      ) : report ? (
        <div className="space-y-4">
          {/* Account Identity Ribbon */}
          <div className="dash-card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {account.module === 'bank' && account.kind === 'postable' ? (
                <BankLogo name={account.name} size="md" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl tone-brand">
                  <BookOpenText size={18} />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[color:var(--ink)] sm:text-base">
                  {account.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--muted)]">
                  کد {toPersianDigits(account.code)} · {moduleLabel(account.module)} ·{' '}
                  {getAccountPathLabel(accounts, account.id)}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold tabular-nums text-[color:var(--muted)]">
              {toPersianDigits(report.rows.length)} ردیف گردش
            </span>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="dash-card p-4">
              <p className="text-[11px] font-bold text-[color:var(--muted)]">مانده اول دوره</p>
              <p className="mt-1.5 truncate text-base font-black tabular-nums text-[color:var(--ink)] sm:text-xl">
                {balanceText(report.openingBalance)}
                <span className="ms-1 text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="dash-card p-4">
              <p className="text-[11px] font-bold text-[color:var(--muted)]">بدهکار دوره</p>
              <p className="mt-1.5 truncate text-base font-black tabular-nums text-[color:var(--income)] sm:text-xl">
                {money(report.turnoverDebit)}
                <span className="ms-1 text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="dash-card p-4">
              <p className="text-[11px] font-bold text-[color:var(--muted)]">بستانکار دوره</p>
              <p className="mt-1.5 truncate text-base font-black tabular-nums text-[color:var(--expense)] sm:text-xl">
                {money(report.turnoverCredit)}
                <span className="ms-1 text-[10.5px] font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="balance-gradient rounded-[1.4rem] p-4 text-white">
              <p className="text-[11px] font-bold text-white/80">مانده پایان دوره</p>
              <p className="mt-1.5 truncate text-base font-black tabular-nums sm:text-xl">
                {balanceText(report.closingBalance)}
                <span className="ms-1 text-[10.5px] font-semibold text-white/80">تومان</span>
              </p>
            </div>
          </div>

          {/* Desktop & Tablet High-Density Ledger Table */}
          <section className="dash-card hidden overflow-hidden md:block" data-testid="ledger-table">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)]/85 text-[11px] font-extrabold text-[color:var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-right">تاریخ</th>
                    <th className="px-4 py-3 text-right">شرح سند و طرف‌حساب</th>
                    <th className="px-4 py-3 text-left">بدهکار</th>
                    <th className="px-4 py-3 text-left">بستانکار</th>
                    <th className="px-4 py-3 text-left">مانده لحظه‌ای</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-[color:var(--surface-2)]/35 text-xs">
                    <td className="px-4 py-2.5 font-bold text-[color:var(--muted)]">ابتدای دوره</td>
                    <td className="px-4 py-2.5 font-semibold text-[color:var(--muted)]">مانده نقل از قبل</td>
                    <td className="px-4 py-2.5 text-left text-[color:var(--muted)]">—</td>
                    <td className="px-4 py-2.5 text-left text-[color:var(--muted)]">—</td>
                    <td className="px-4 py-2.5 text-left font-black tabular-nums text-[color:var(--ink)]">
                      {balanceText(report.openingBalance)}
                    </td>
                  </tr>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[color:var(--muted)]">
                        در این بازه گردشی ثبت نشده است
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((r, i) => {
                      const tx = transactions.find(
                        (t) => t.id === r.entryId || `${t.id}:in` === r.entryId || `${t.id}:out` === r.entryId
                      );
                      const person = contactLabel(contacts, contactGroups, tx?.contactId);
                      return (
                        <tr
                          key={`${r.entryId}-${i}`}
                          className="border-t border-[color:var(--line)]/65 transition hover:bg-[color:var(--surface-2)]/50"
                        >
                          <td className="px-4 py-3 text-xs font-semibold tabular-nums text-[color:var(--muted)]">
                            {toPersianDigits(
                              new Date(r.date + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian')
                            )}
                          </td>
                          <td className="px-4 py-3 text-[color:var(--ink)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold">{r.description || '—'}</span>
                              {tx?.attachment?.path ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewSrc(tx.attachment!.path)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand)] hover:opacity-85"
                                >
                                  <Paperclip size={10} />
                                  رسید
                                </button>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[11px] font-medium text-[color:var(--muted)]">
                              {[person, includeChildren && account.kind === 'group' ? r.accountName : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-left font-bold tabular-nums text-[color:var(--income)]">
                            {r.debit ? money(r.debit) : '—'}
                          </td>
                          <td className="px-4 py-3 text-left font-bold tabular-nums text-[color:var(--expense)]">
                            {r.credit ? money(r.credit) : '—'}
                          </td>
                          <td className="px-4 py-3 text-left font-black tabular-nums text-[color:var(--ink)]">
                            {balanceText(r.balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="border-t-2 border-[color:var(--line)] bg-[color:var(--surface-2)]/90 font-black">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right text-xs text-[color:var(--ink)]">
                      جمع گردش و مانده نهایی
                    </td>
                    <td className="px-4 py-3 text-left tabular-nums text-[color:var(--income)]">
                      {money(report.turnoverDebit)}
                    </td>
                    <td className="px-4 py-3 text-left tabular-nums text-[color:var(--expense)]">
                      {money(report.turnoverCredit)}
                    </td>
                    <td className="px-4 py-3 text-left tabular-nums text-[color:var(--brand)]">
                      {balanceText(report.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Mobile Stacked Ledger Cards */}
          <div className="space-y-2.5 md:hidden">
            {report.rows.length === 0 ? (
              <div className="dash-card p-6 text-center text-sm text-[color:var(--muted)]">
                در این بازه گردشی ثبت نشده است
              </div>
            ) : (
              report.rows.map((r, i) => (
                <div key={`${r.entryId}-${i}`} className="dash-card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[color:var(--ink)]">
                        {r.description || '—'}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                        {toPersianDigits(
                          new Date(r.date + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian')
                        )}
                        {includeChildren && account.kind === 'group' ? ` · ${r.accountName}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-black tabular-nums',
                        r.debit > 0 ? 'text-[color:var(--income)]' : 'text-[color:var(--expense)]'
                      )}
                    >
                      {r.debit > 0 ? `+${money(r.debit)}` : `-${money(r.credit)}`}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[color:var(--line)] pt-2 text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                    <span>مانده پس از سند</span>
                    <span className="text-[color:var(--ink)]">{balanceText(r.balance)} تومان</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {previewSrc ? (
        <AttachmentLightbox src={previewSrc} onClose={() => setPreviewSrc(null)} />
      ) : null}
    </div>
  );
};

export default AccountLedgerReport;
