import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  Eye,
  EyeOff,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import type { Account, AppSettings, Transaction } from '../types';
import { APP_NAME } from '../constants';
import { getAccountById, getBankAccounts } from '../utils/accountTree';
import { resolveTreasuryType } from '../utils/bankBrand';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  toPersianDigits,
} from '../utils/formatters';
import {
  JALALI_MONTH_NAMES,
  formatJalaliShort,
  getJalaliParts,
} from '../utils/jalaliPeriod';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { useCan } from '../hooks/useSessionAuth';
import BankTransferModal from './BankTransferModal';
import { ExportActions } from './export/ExportActions';
import { BankLogo } from './ui/BankLogo';
import { Button, EmptyState, IconButton, cn } from './ui';
import { useDialog } from './DialogProvider';

interface TransfersPageProps {
  accounts: Account[];
  transactions: Transaction[];
  onSave: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  onDelete: (id: string) => void;
  settings?: AppSettings;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const jalaliKey = (iso: string): { y: number; m: number } => {
  const p = getJalaliParts(iso);
  return { y: p?.year ?? 1405, m: p?.month ?? 1 };
};

const jalaliLabel = (y: number, m: number) =>
  `${JALALI_MONTH_NAMES[m - 1] || ''} ${toPersianDigits(y)}`.trim();

const CURRENT_PERIOD_KEY = (() => {
  const k = jalaliKey(getLocalDateISOString(new Date()));
  return `${k.y}-${k.m}`;
})();

function SelectChip({
  value,
  onChange,
  label,
  options,
  testId,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
  testId?: string;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <select
        data-testid={testId}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 max-w-[12rem] appearance-none truncate rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 pe-8 ps-3.5 text-xs font-bold text-[color:var(--ink)] shadow-xs outline-none transition hover:border-[color:var(--brand)]/35 focus-visible:border-[color:var(--brand)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
        aria-hidden
      />
    </span>
  );
}

const TransfersPage: React.FC<TransfersPageProps> = ({
  accounts,
  transactions,
  onSave,
  onDelete,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canCreate = can('journals.create');
  const canEdit = can('journals.edit');
  const canDelete = can('journals.delete');

  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const storeName = settings?.name || APP_NAME;

  const [query, setQuery] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [period, setPeriod] = useState<string>('all');
  const [hideAmount, setHideAmount] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const list = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.type === 'transfer')
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  const periodOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const t of list) {
      const k = jalaliKey(t.date);
      keys.add(`${k.y}-${k.m}`);
    }
    keys.add(CURRENT_PERIOD_KEY);
    return [...keys]
      .map((key) => {
        const [y, m] = key.split('-').map(Number);
        return { key, y, m, label: jalaliLabel(y, m) };
      })
      .sort((a, b) => b.y - a.y || b.m - a.m);
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((tx) => {
      if (period !== 'all') {
        const k = jalaliKey(tx.date);
        if (`${k.y}-${k.m}` !== period) return false;
      }
      if (fromFilter && tx.bankAccountId !== fromFilter) return false;
      if (toFilter && tx.accountId !== toFilter) return false;
      if (!q) return true;
      const fromName = getAccountById(accounts, tx.bankAccountId)?.name || '';
      const toName = getAccountById(accounts, tx.accountId)?.name || '';
      const hay = `${tx.description || ''} ${fromName} ${toName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [list, period, fromFilter, toFilter, query, accounts]);

  const total = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);
  const count = filtered.length;
  const avg = count > 0 ? Math.round(total / count) : 0;

  const heroLabel = useMemo(() => {
    if (period === 'all') return 'جمع کل انتقال‌ها';
    if (period === CURRENT_PERIOD_KEY) return 'جمع انتقال‌های این ماه';
    const opt = periodOptions.find((o) => o.key === period);
    return `انتقال‌های ${opt ? opt.label : ''}`.trim();
  }, [period, periodOptions]);

  const openCreate = () => {
    setEditingTx(null);
    setModalOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setModalOpen(true);
  };

  const handleDelete = async (tx: Transaction) => {
    const fromName = getAccountById(accounts, tx.bankAccountId)?.name || 'مبدأ';
    const toName = getAccountById(accounts, tx.accountId)?.name || 'مقصد';
    const ok = await dialog.confirm({
      title: 'حذف انتقال بین حساب‌ها',
      message: `انتقال ${money(tx.amount)} تومان از «${fromName}» به «${toName}» حذف شود؟ موجودی هر دو حساب اصلاح می‌شود.`,
      tone: 'danger',
      confirmLabel: 'حذف انتقال',
    });
    if (ok) onDelete(tx.id);
  };

  const clearFilters = () => {
    setQuery('');
    setFromFilter('');
    setToFilter('');
    setPeriod('all');
  };

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      filtered.map((tx) => ({
        تاریخ: formatJalaliShort(tx.date),
        'حساب مبدأ': getAccountById(accounts, tx.bankAccountId)?.name || '—',
        'حساب مقصد': getAccountById(accounts, tx.accountId)?.name || '—',
        شرح: tx.description,
        'مبلغ (تومان)': tx.amount,
      })),
      'انتقال بین حساب‌ها',
      'bank-transfers'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    const rows = filtered.map((tx) => [
      formatDateFa(tx.date),
      getAccountById(accounts, tx.bankAccountId)?.name || '—',
      getAccountById(accounts, tx.accountId)?.name || '—',
      tx.description || '—',
      formatMoneyFa(tx.amount),
    ]);

    await downloadTableReportPdf({
      title: 'گزارش انتقال بین حساب‌ها',
      storeName,
      subtitle: `${toPersianDigits(String(filtered.length))} فقره انتقال`,
      pageSize,
      filename: `bank-transfers-${pageSize}`,
      columns: [
        { header: 'تاریخ', width: 1.1, align: 'right' },
        { header: 'حساب مبدأ', width: 1.7, align: 'right' },
        { header: 'حساب مقصد', width: 1.7, align: 'right' },
        { header: 'شرح', width: 2.2, align: 'right' },
        { header: 'مبلغ', width: 1.4, align: 'amount' },
      ],
      rows,
      summary: [
        { label: 'تعداد انتقال‌ها', value: toPersianDigits(String(filtered.length)) },
        { label: 'جمع مبالغ', value: formatMoneyFa(total) },
      ],
    });
  };

  return (
    <div className="animate-page-enter space-y-5 md:space-y-6" data-testid="transfers-page">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
            انتقال بین حساب‌ها
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)] md:text-sm">
            فهرست، پیگیری و ثبت جابه‌جایی وجه بین بانک‌ها، صندوق‌ها و تنخواه‌ها
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SelectChip
            testId="transfers-period"
            label="بازه ماه"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'all', label: 'همه ماه‌ها' },
              ...periodOptions.map((o) => ({ value: o.key, label: o.label })),
            ]}
          />
          {canCreate ? (
            <Button
              size="md"
              icon={Plus}
              disabled={banks.length < 2}
              data-testid="transfers-add"
              onClick={openCreate}
            >
              ثبت انتقال جدید
            </Button>
          ) : null}
        </div>
      </div>

      {/* KPI Row: 1 col mobile, 2 cols tablet, 3 cols desktop */}
      <section className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        <div
          className="balance-gradient relative overflow-hidden rounded-[1.5rem] p-5 text-white md:col-span-2 lg:col-span-1"
          data-testid="transfers-hero"
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 400 220"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M-20 155 C 90 118, 190 175, 430 96"
              stroke="rgba(165, 243, 252, 0.35)"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <ArrowLeftRight size={18} />
              </span>
              <p className="text-sm font-bold text-white/90">{heroLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setHideAmount((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              aria-label={hideAmount ? 'نمایش مبلغ' : 'پنهان‌سازی مبلغ'}
            >
              {hideAmount ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p
            data-testid="transfers-total"
            className="relative mt-4 truncate text-[1.85rem] font-black tabular-nums tracking-tight"
          >
            {hideAmount ? '••••••••' : money(total)}
            <span className="ms-2 text-xs font-bold text-white/80">تومان</span>
          </p>
          <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold tabular-nums">
            {toPersianDigits(String(count))} انتقال ثبت‌شده
          </span>
        </div>

        <div className="dash-card hidden p-5 md:flex md:flex-col md:justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[color:var(--muted)]">تعداد انتقال‌ها</p>
              <p className="mt-2 text-3xl font-black tabular-nums text-[color:var(--ink)]">
                {toPersianDigits(String(count))}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tone-brand">
              <Wallet size={20} />
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
            بدون تغییر در جمع نقدینگی و سود و زیان
          </p>
        </div>

        <div className="dash-card hidden p-5 md:flex md:flex-col md:justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[color:var(--muted)]">میانگین هر انتقال</p>
              <p className="mt-2 truncate text-2xl font-black tabular-nums text-[color:var(--ink)]">
                {money(avg)}
                <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tone-info">
              <BarChart3 size={20} />
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
            متوسط مبلغ جابه‌جایی در بازه انتخابی
          </p>
        </div>
      </section>

      {banks.length < 2 ? (
        <div className="rounded-2xl border border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)] px-4 py-3.5 text-sm text-[color:var(--warning)]">
          برای ثبت انتقال بین حساب‌ها حداقل دو حساب بانکی یا صندوق فعال نیاز دارید. از بخش{' '}
          <strong className="font-black">بانک‌ها و صندوق‌ها</strong> حساب دوم را اضافه کنید.
        </div>
      ) : null}

      {/* Main List Section (Structured Filter Card + Elevated Row Cards matching ChecksPage / LoansPage) */}
      <section className="space-y-3.5" data-testid="transfers-list-card">
        <div className="dash-card rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-brand">
                <List size={16} />
              </span>
              <h2 className="text-base font-extrabold text-[color:var(--ink)]">
                فهرست انتقال‌های ثبت‌شده
              </h2>
              <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[color:var(--muted)]">
                {toPersianDigits(String(filtered.length))} انتقال
              </span>
            </div>
            {list.length > 0 ? (
              <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="journals.export" />
            ) : null}
          </div>

          {/* Search & Account Filters */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 min-w-[12rem] flex-1 items-center gap-2.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 px-3.5 shadow-xs transition focus-within:border-[color:var(--brand)] focus-within:ring-4 focus-within:ring-[color:var(--brand)]/10">
              <Search size={16} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
              <input
                data-testid="transfers-search"
                aria-label="جست‌وجو در انتقال‌ها"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجو بر اساس شرح، حساب مبدأ یا مقصد..."
              />
            </div>
            <SelectChip
              testId="transfers-from-filter"
              label="فیلتر حساب مبدأ"
              value={fromFilter}
              onChange={setFromFilter}
              options={[
                { value: '', label: 'همه مبدأها' },
                ...banks.map((b) => ({ value: b.id, label: `از: ${b.name}` })),
              ]}
            />
            <SelectChip
              testId="transfers-to-filter"
              label="فیلتر حساب مقصد"
              value={toFilter}
              onChange={setToFilter}
              options={[
                { value: '', label: 'همه مقصدها' },
                ...banks.map((b) => ({ value: b.id, label: `به: ${b.name}` })),
              ]}
            />
          </div>
        </div>

        {list.length === 0 ? (
          <EmptyState
            title="هنوز انتقالی ثبت نشده است"
            description="جابه‌جایی وجه بین بانک‌ها، صندوق‌ها و تنخواه‌ها در این فهرست نمایش داده می‌شود."
            action={
              canCreate && banks.length >= 2 ? (
                <Button icon={Plus} onClick={openCreate}>
                  ثبت اولین انتقال
                </Button>
              ) : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <div className="dash-card rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center">
            <p className="text-sm font-bold text-[color:var(--ink)]">
              انتقالی مطابق فیلترهای انتخابی پیدا نشد.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex h-9 items-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-4 text-xs font-bold text-[color:var(--brand)]"
            >
              پاک‌کردن فیلترها
            </button>
          </div>
        ) : (
          <div className="space-y-2.5" data-testid="transfers-rows">
            {filtered.map((tx) => {
              const fromAcc = getAccountById(accounts, tx.bankAccountId);
              const toAcc = getAccountById(accounts, tx.accountId);
              return (
                <div
                  key={tx.id}
                  data-testid="transfer-card"
                  className="dash-card rounded-2xl p-4 transition hover:border-[color:var(--brand)]/35"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Top line: Badges & Date */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full tone-brand px-2.5 py-0.5 text-[11px] font-extrabold">
                          <ArrowLeftRight size={11} />
                          انتقال بین حساب‌ها
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full tone-income px-2.5 py-0.5 text-[11px] font-bold">
                          انجام شد
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                          {formatJalaliShort(tx.date)}
                        </span>
                      </div>

                      {/* Middle line: Visual Source ➔ Destination Flow */}
                      <div className="inline-flex max-w-full flex-wrap items-center gap-2.5 rounded-xl border border-[color:var(--line)]/60 bg-[color:var(--surface-2)]/55 px-3.5 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <BankLogo
                            name={fromAcc?.name || 'مبدأ'}
                            treasuryType={fromAcc ? resolveTreasuryType(fromAcc) : undefined}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <span className="block text-[10px] font-bold text-[color:var(--expense)]">
                              برداشت از مبدأ
                            </span>
                            <span className="block truncate text-xs font-black text-[color:var(--ink)] sm:text-sm">
                              {fromAcc?.name || 'حساب حذف‌شده'}
                            </span>
                          </div>
                        </div>

                        <span className="mx-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                          <ArrowLeft size={14} aria-hidden />
                        </span>

                        <div className="flex min-w-0 items-center gap-2">
                          <BankLogo
                            name={toAcc?.name || 'مقصد'}
                            treasuryType={toAcc ? resolveTreasuryType(toAcc) : undefined}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <span className="block text-[10px] font-bold text-[color:var(--income)]">
                              واریز به مقصد
                            </span>
                            <span className="block truncate text-xs font-black text-[color:var(--ink)] sm:text-sm">
                              {toAcc?.name || 'حساب حذف‌شده'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom line: Description */}
                      {tx.description ? (
                        <p className="text-xs font-medium text-[color:var(--muted)]">
                          شرح انتقال: {tx.description}
                        </p>
                      ) : null}
                    </div>

                    {/* Left Side: Amount & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)]/60 pt-2.5 lg:justify-end lg:border-t-0 lg:pt-0">
                      <p className="text-base font-black tabular-nums text-[color:var(--brand)] sm:text-lg">
                        {money(tx.amount)}
                        <span className="ms-1 text-[10px] font-semibold text-[color:var(--muted)]">
                          تومان
                        </span>
                      </p>

                      {canEdit || canDelete ? (
                        <div className="flex items-center gap-1.5">
                          {canEdit ? (
                            <IconButton
                              icon={Pencil}
                              label={`ویرایش انتقال ${tx.description || ''}`}
                              size="sm"
                              onClick={() => openEdit(tx)}
                            />
                          ) : null}
                          {canDelete ? (
                            <IconButton
                              icon={Trash2}
                              label={`حذف انتقال ${tx.description || ''}`}
                              size="sm"
                              variant="soft-danger"
                              onClick={() => void handleDelete(tx)}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <BankTransferModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
        accounts={accounts}
        transactions={transactions}
        editing={editingTx}
        onSaveTransfer={onSave}
      />
    </div>
  );
};

export default TransfersPage;
