import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  Landmark,
  Wallet,
} from 'lucide-react';
import type { Account, AppSettings, Transaction } from '../../types';
import { APP_NAME } from '../../constants';
import { getAccountById, getBankAccounts } from '../../utils/accountTree';
import {
  TREASURY_TYPE_META,
  resolveTreasuryType,
  shortBankName,
} from '../../utils/bankBrand';
import { buildTreasuryReport } from '../../utils/financialReports';
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
import { BankLogo } from '../ui/BankLogo';
import { Button, EmptyState, WorkspaceHeader, fieldLabel } from '../ui';

interface TreasuryReportPageProps {
  accounts: Account[];
  transactions: Transaction[];
  settings?: AppSettings;
  onOpenLedger: (accountId: string) => void;
  onOpenTransfer?: () => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(Math.abs(n))));
const FA_JALALI_DATE = new Intl.DateTimeFormat('fa-IR-u-ca-persian');

const TreasuryReportPage: React.FC<TreasuryReportPageProps> = ({
  accounts,
  transactions,
  settings,
  onOpenLedger,
  onOpenTransfer,
}) => {
  const [bankId, setBankId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const allBanks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const storeName = settings?.name || APP_NAME;

  const report = useMemo(
    () =>
      buildTreasuryReport(accounts, transactions, {
        bankId: bankId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    [accounts, transactions, bankId, startDate, endDate]
  );

  const bankNameOf = (id: string) => getAccountById(accounts, id)?.name || '—';

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      report.banks.map((b) => ({
        بانک: b.account.name,
        'مانده اول دوره': b.openingBalance,
        'جمع ورودی': b.inflow,
        'جمع خروجی': b.outflow,
        'مانده پایان دوره': b.closingBalance,
      })),
      'گزارش خزانه و بانک‌ها',
      'treasury-report'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    await downloadTableReportPdf({
      title: 'گزارش گردش خزانه و بانک‌ها',
      storeName,
      subtitle:
        startDate || endDate
          ? `${startDate ? `از ${formatDateFa(startDate)} ` : ''}${endDate ? `تا ${formatDateFa(endDate)}` : ''}`.trim()
          : 'کل دوره مالی',
      pageSize,
      filename: `treasury-${pageSize}`,
      columns: [
        { header: 'حساب بانکی', width: 2.2, align: 'right' },
        { header: 'اول دوره', width: 1.3, align: 'amount' },
        { header: 'ورودی', width: 1.3, align: 'amount' },
        { header: 'خروجی', width: 1.3, align: 'amount' },
        { header: 'مانده پایان', width: 1.4, align: 'amount' },
      ],
      rows: report.banks.map((b) => [
        b.account.name,
        formatMoneyFa(b.openingBalance),
        formatMoneyFa(b.inflow),
        formatMoneyFa(b.outflow),
        formatMoneyFa(b.closingBalance),
      ]),
      summary: [
        { label: 'جمع ورودی', value: formatMoneyFa(report.totalInflow) },
        { label: 'جمع خروجی', value: formatMoneyFa(report.totalOutflow) },
        { label: 'موجودی کل نقد و بانک', value: formatMoneyFa(report.totalClosing) },
      ],
    });
  };

  return (
    <div className="animate-page-enter mx-auto max-w-6xl space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="گزارش گردش خزانه و بانک‌ها"
        subtitle="وضعیت وجوه نقد، ورودی و خروجی هر حساب بانکی و دفتر انتقال‌های بین‌بانکی"
        actions={
          <div className="flex items-center gap-2">
            {onOpenTransfer && allBanks.length >= 2 ? (
              <Button size="sm" variant="secondary" icon={ArrowLeftRight} onClick={onOpenTransfer}>
                ثبت انتقال
              </Button>
            ) : null}
            <ExportActions
              onExcel={handleExcel}
              onPdf={handlePdf}
              disabled={report.banks.length === 0}
              permission="reports.export"
            />
          </div>
        }
      />

      {/* Top 4 KPI Summary Cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="balance-gradient col-span-2 rounded-[1.45rem] p-4 text-white lg:col-span-1 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-white/85">موجودی پایان دوره</p>
            <Wallet size={17} className="opacity-85" />
          </div>
          <p className="mt-2 truncate text-xl font-black tabular-nums sm:text-2xl">
            {money(report.totalClosing)}
            <span className="ms-1 text-xs font-semibold text-white/80">تومان</span>
          </p>
        </div>

        <div className="dash-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[color:var(--muted)]">جمع ورودی</p>
            <ArrowDownLeft size={16} className="text-[color:var(--income)]" />
          </div>
          <p className="mt-2 truncate text-lg font-black tabular-nums text-[color:var(--income)] sm:text-xl">
            +{money(report.totalInflow)}
          </p>
        </div>

        <div className="dash-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[color:var(--muted)]">جمع خروجی</p>
            <ArrowUpRight size={16} className="text-[color:var(--expense)]" />
          </div>
          <p className="mt-2 truncate text-lg font-black tabular-nums text-[color:var(--expense)] sm:text-xl">
            -{money(report.totalOutflow)}
          </p>
        </div>

        <div className="dash-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[color:var(--muted)]">انتقال‌های داخلی</p>
            <ArrowLeftRight size={16} className="text-[color:var(--info)]" />
          </div>
          <p className="mt-2 truncate text-lg font-black tabular-nums text-[color:var(--info)] sm:text-xl">
            {money(report.totalTransfersAmount)}
          </p>
          <p className="mt-0.5 text-[10.5px] font-semibold text-[color:var(--muted)]">
            {toPersianDigits(report.transfers.length)} فقره انتقال
          </p>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="dash-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={fieldLabel}>انتخاب حساب بانکی</label>
            <div className="relative">
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="form-control h-10 appearance-none py-0 pe-9 ps-3.5 text-xs font-bold"
              >
                <option value="">همه بانک‌ها و صندوق‌ها</option>
                {allBanks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
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

      {/* Bank-by-Bank Summary */}
      {report.banks.length === 0 ? (
        <EmptyState title="حساب بانکی ثبت نشده است" description="ابتدا در بخش بانک‌ها یک حساب ایجاد کنید." />
      ) : (
        <section className="dash-card overflow-hidden" data-testid="treasury-banks-table">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2">
              <Landmark size={17} className="text-[color:var(--brand)]" />
              <h2 className="text-sm font-extrabold text-[color:var(--ink)] sm:text-base">
                خلاصه گردش به تفکیک حساب بانکی
              </h2>
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[660px] text-sm">
              <thead className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)]/80 text-[11px] font-extrabold text-[color:var(--muted)]">
                <tr>
                  <th className="px-4 py-3 text-right">بانک / صندوق</th>
                  <th className="px-4 py-3 text-left">اول دوره</th>
                  <th className="px-4 py-3 text-left">ورودی دوره</th>
                  <th className="px-4 py-3 text-left">خروجی دوره</th>
                  <th className="px-4 py-3 text-left">مانده پایان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]/65">
                {report.banks.map((b) => (
                  <tr
                    key={b.account.id}
                    onClick={() => onOpenLedger(b.account.id)}
                    className="cursor-pointer transition hover:bg-[color:var(--brand-soft)]/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <BankLogo
                          name={b.account.name}
                          treasuryType={resolveTreasuryType(b.account)}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <span className="flex items-center gap-1.5 font-bold text-[color:var(--ink)]">
                            <span className="truncate">{b.account.name}</span>
                            <span className="shrink-0 rounded-md bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--muted)]">
                              {TREASURY_TYPE_META[resolveTreasuryType(b.account)].shortLabel}
                            </span>
                            <ChevronLeft size={13} className="shrink-0 text-[color:var(--muted)] opacity-60" />
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left font-semibold tabular-nums text-[color:var(--muted)]">
                      {money(b.openingBalance)}
                    </td>
                    <td className="px-4 py-3 text-left font-bold tabular-nums text-[color:var(--income)]">
                      {b.inflow ? `+${money(b.inflow)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-left font-bold tabular-nums text-[color:var(--expense)]">
                      {b.outflow ? `-${money(b.outflow)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-left font-black tabular-nums text-[color:var(--ink)]">
                      {money(b.closingBalance)} تومان
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[color:var(--line)]/65 md:hidden">
            {report.banks.map((b) => (
              <button
                key={b.account.id}
                type="button"
                onClick={() => onOpenLedger(b.account.id)}
                className="block w-full p-3.5 text-right"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <BankLogo
                      name={b.account.name}
                      treasuryType={resolveTreasuryType(b.account)}
                      size="sm"
                    />
                    <span className="truncate text-sm font-extrabold text-[color:var(--ink)]">
                      {shortBankName(b.account.name)}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-black tabular-nums text-[color:var(--ink)]">
                    {money(b.closingBalance)} تومان
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                  ورودی {money(b.inflow)} · خروجی {money(b.outflow)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Dedicated Inter-Bank Transfers Ledger */}
      <section className="dash-card overflow-hidden" data-testid="treasury-transfers-card">
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={17} className="text-[color:var(--info)]" />
            <h2 className="text-sm font-extrabold text-[color:var(--ink)] sm:text-base">
              دفتر انتقال‌های بین‌بانکی
            </h2>
          </div>
          <span className="text-xs font-bold tabular-nums text-[color:var(--muted)]">
            {toPersianDigits(report.transfers.length)} مورد
          </span>
        </div>

        {report.transfers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[color:var(--muted)]">
            انتقال بین‌بانکی در این بازه ثبت نشده است
          </p>
        ) : (
          <div className="divide-y divide-[color:var(--line)]/65">
            {report.transfers.map((tx) => {
              const fromName = bankNameOf(tx.bankAccountId);
              const toName = bankNameOf(tx.accountId);
              return (
                <div
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <BankLogo name={fromName} size="xs" />
                    <span className="text-xs font-bold text-[color:var(--ink)]">
                      {shortBankName(fromName)}
                    </span>
                    <ArrowLeftRight size={13} className="shrink-0 text-[color:var(--info)]" />
                    <BankLogo name={toName} size="xs" />
                    <span className="text-xs font-bold text-[color:var(--ink)]">
                      {shortBankName(toName)}
                    </span>
                    {tx.description ? (
                      <span className="hidden truncate text-xs text-[color:var(--muted)] sm:inline">
                        · {tx.description}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                    <span className="font-semibold text-[color:var(--muted)]">
                      {FA_JALALI_DATE.format(new Date(`${tx.date}T12:00:00`))}
                    </span>
                    <span className="text-sm font-black text-[color:var(--info)]">
                      {money(tx.amount)} تومان
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default TreasuryReportPage;
