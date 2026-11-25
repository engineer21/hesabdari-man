import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  Account,
  AppSettings,
  CheckItem,
  CheckKind,
  CheckStatus,
  Contact,
  Invoice,
  ReminderSettings,
  Transaction,
} from '../types';
import { APP_NAME } from '../constants';
import { getAccountById, getBankAccounts, getPostableLeaves } from '../utils/accountTree';
import { resolveDefaultAccountId } from '../utils/accountingTemplates';
import { apiJson } from '../utils/api';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  parseIntegerAmount,
  toPersianDigits,
} from '../utils/formatters';
import { formatJalaliShort, parseLocalIsoDate } from '../utils/jalaliPeriod';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { useCan } from '../hooks/useSessionAuth';
import PersianDatePicker from './PersianDatePicker';
import { ExportActions } from './export/ExportActions';
import { BankLogo } from './ui/BankLogo';
import { resolveTreasuryType } from '../utils/bankBrand';
import {
  AmountInput,
  Button,
  CollapsibleOptionalSection,
  EmptyState,
  FormActions,
  FormSheet,
  IconButton,
  StoreMark,
  cn,
  fieldInput,
  fieldLabel,
} from './ui';
import { countFilledFields } from '../utils/formLayout';
import { useDialog } from './DialogProvider';

interface ChecksPageProps {
  accounts: Account[];
  contacts: Contact[];
  invoices: Invoice[];
  checks: CheckItem[];
  setChecks: (v: CheckItem[] | ((p: CheckItem[]) => CheckItem[])) => void;
  onSaveTx: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  onDeleteTx: (id: string) => void;
  reminderSettings: ReminderSettings;
  settings?: AppSettings;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const STATUS_META: Record<CheckStatus, { label: string; cls: string }> = {
  pending: {
    label: 'در جریان',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  cleared: { label: 'پاس‌شده', cls: 'tone-income' },
  bounced: { label: 'برگشت‌خورده', cls: 'tone-expense' },
  cancelled: {
    label: 'باطل‌شده',
    cls: 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
};

function daysUntil(dueIso: string): number {
  const now = parseLocalIsoDate(getLocalDateISOString(new Date()));
  const due = parseLocalIsoDate(dueIso);
  if (Number.isNaN(now.getTime()) || Number.isNaN(due.getTime())) return 999;
  return Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

const ChecksPage: React.FC<ChecksPageProps> = ({
  accounts,
  contacts,
  invoices,
  checks,
  setChecks,
  onSaveTx,
  onDeleteTx,
  reminderSettings,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canCreate = can('journals.create');
  const canEdit = can('journals.edit');
  const canDelete = can('journals.delete');

  const storeName = settings?.name || APP_NAME;
  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const defaultExpenseAcc = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'purchaseInvoice') ||
      getPostableLeaves(accounts, 'acc_expense')[0]?.id ||
      'acc_expense',
    [accounts, settings?.accountingDefaults]
  );
  const defaultIncomeAcc = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'saleInvoice') ||
      getPostableLeaves(accounts, 'acc_income')[0]?.id ||
      'acc_income',
    [accounts, settings?.accountingDefaults]
  );

  const [kindTab, setKindTab] = useState<'all' | CheckKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CheckStatus>('all');
  const [query, setQuery] = useState('');
  const [smsSendingId, setSmsSendingId] = useState<string | null>(null);

  // Create / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CheckItem | null>(null);
  const [formKind, setFormKind] = useState<CheckKind>('payable');
  const [checkNumber, setCheckNumber] = useState('');
  const [sayadId, setSayadId] = useState('');
  const [contactId, setContactId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [issueDate, setIssueDate] = useState(() => getLocalDateISOString(new Date()));
  const [dueDate, setDueDate] = useState(() => getLocalDateISOString(new Date()));
  const [description, setDescription] = useState('');

  // Clear Check Modal
  const [clearingCheck, setClearingCheck] = useState<CheckItem | null>(null);
  const [clearDate, setClearDate] = useState(() => getLocalDateISOString(new Date()));

  const contactName = (id: string) => contacts.find((c) => c.id === id)?.fullName || 'شخص';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...checks]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .filter((ch) => {
        if (kindTab !== 'all' && ch.kind !== kindTab) return false;
        if (statusFilter !== 'all' && ch.status !== statusFilter) return false;
        if (!q) return true;
        const cName = contactName(ch.contactId);
        const bName = getAccountById(accounts, ch.bankAccountId)?.name || '';
        return `${ch.checkNumber} ${ch.sayadId || ''} ${ch.description} ${cName} ${bName}`
          .toLowerCase()
          .includes(q);
      });
  }, [checks, kindTab, statusFilter, query, contacts, accounts]);

  const pendingPayable = useMemo(
    () => checks.filter((c) => c.kind === 'payable' && c.status === 'pending').reduce((s, c) => s + c.amount, 0),
    [checks]
  );
  const pendingReceivable = useMemo(
    () => checks.filter((c) => c.kind === 'receivable' && c.status === 'pending').reduce((s, c) => s + c.amount, 0),
    [checks]
  );
  const dueSoonCount = useMemo(
    () =>
      checks.filter((c) => c.status === 'pending' && daysUntil(c.dueDate) <= (reminderSettings.leadDays ?? 2))
        .length,
    [checks, reminderSettings.leadDays]
  );

  const openCreate = () => {
    setEditing(null);
    setFormKind(kindTab === 'receivable' ? 'receivable' : 'payable');
    setCheckNumber('');
    setSayadId('');
    setContactId(contacts[0]?.id || '');
    setBankAccountId(
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'defaultBank') ||
        banks[0]?.id ||
        ''
    );
    setInvoiceId('');
    setAmountRaw('');
    const today = getLocalDateISOString(new Date());
    setIssueDate(today);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setDueDate(getLocalDateISOString(nextMonth));
    setDescription('');
    setFormOpen(true);
  };

  const openEdit = (ch: CheckItem) => {
    setEditing(ch);
    setFormKind(ch.kind);
    setCheckNumber(ch.checkNumber);
    setSayadId(ch.sayadId || '');
    setContactId(ch.contactId);
    setBankAccountId(ch.bankAccountId);
    setInvoiceId(ch.invoiceId || '');
    setAmountRaw(String(ch.amount));
    setIssueDate(ch.issueDate);
    setDueDate(ch.dueDate);
    setDescription(ch.description);
    setFormOpen(true);
  };

  const saveCheck = async () => {
    const amt = parseIntegerAmount(amountRaw);
    if (amt <= 0) {
      await dialog.alert({ title: 'مبلغ چک', message: 'مبلغ چک را وارد کنید.' });
      return;
    }
    if (!checkNumber.trim()) {
      await dialog.alert({ title: 'شماره چک', message: 'شماره چک را وارد کنید.' });
      return;
    }
    if (!contactId) {
      await dialog.alert({ title: 'طرف‌حساب', message: 'شخص مرتبط با چک را انتخاب کنید.' });
      return;
    }
    if (!bankAccountId) {
      await dialog.alert({ title: 'بانک', message: 'حساب بانکی چک را انتخاب کنید.' });
      return;
    }

    const payload: CheckItem = {
      id: editing ? editing.id : `chk_${crypto.randomUUID().slice(0, 10)}`,
      kind: formKind,
      checkNumber: checkNumber.trim(),
      sayadId: sayadId.trim() || undefined,
      contactId,
      bankAccountId,
      invoiceId: invoiceId || undefined,
      amount: amt,
      issueDate,
      dueDate,
      status: editing?.status || 'pending',
      settledDate: editing?.settledDate,
      clearedTxId: editing?.clearedTxId,
      description: description.trim(),
    };

    if (editing) {
      setChecks((prev) => prev.map((x) => (x.id === editing.id ? payload : x)));
    } else {
      setChecks((prev) => [payload, ...prev]);
    }
    setFormOpen(false);
  };

  const confirmClearCheck = () => {
    if (!clearingCheck) return;
    const txId = `tx_chk_${crypto.randomUUID().slice(0, 10)}`;
    const inv = clearingCheck.invoiceId
      ? invoices.find((i) => i.id === clearingCheck.invoiceId)
      : undefined;
    const accId =
      inv?.accountId || (clearingCheck.kind === 'payable' ? defaultExpenseAcc : defaultIncomeAcc);

    // Clearing posts bank-only cash movement (`linkKind: 'check_clearing'`)
    // Person balance & P&L are NOT double-counted!
    onSaveTx({
      id: txId,
      type: clearingCheck.kind === 'payable' ? 'expense' : 'income',
      date: clearDate,
      amount: clearingCheck.amount,
      accountId: accId,
      bankAccountId: clearingCheck.bankAccountId,
      contactId: clearingCheck.contactId,
      description:
        clearingCheck.kind === 'payable'
          ? `پاس‌شدن چک پرداختی #${clearingCheck.checkNumber} — ${contactName(clearingCheck.contactId)}`
          : `وصول چک دریافتی #${clearingCheck.checkNumber} — ${contactName(clearingCheck.contactId)}`,
      linkKind: 'check_clearing',
      checkId: clearingCheck.id,
      invoiceId: clearingCheck.invoiceId,
    });

    setChecks((prev) =>
      prev.map((c) =>
        c.id === clearingCheck.id
          ? { ...c, status: 'cleared', settledDate: clearDate, clearedTxId: txId }
          : c
      )
    );
    setClearingCheck(null);
  };

  const markStatus = async (ch: CheckItem, nextStatus: 'bounced' | 'cancelled' | 'pending') => {
    const label =
      nextStatus === 'bounced'
        ? 'برگشت‌خورده'
        : nextStatus === 'cancelled'
          ? 'باطل‌شده'
          : 'در جریان';
    const ok = await dialog.confirm({
      title: `تغییر وضعیت چک به ${label}`,
      message:
        nextStatus === 'bounced' || nextStatus === 'cancelled'
          ? `چک #${toPersianDigits(ch.checkNumber)} به مبلغ ${money(ch.amount)} تومان «${label}» ثبت شود؟ اثر تسویه آن از حساب «${contactName(ch.contactId)}» برگردانده می‌شود و موجودی بانک دست‌نخورده می‌ماند.`
          : `وضعیت چک #${toPersianDigits(ch.checkNumber)} به «در جریان» برگردد؟`,
      tone: nextStatus === 'pending' ? 'warning' : 'danger',
      confirmLabel: 'تأیید',
    });
    if (!ok) return;
    if (ch.clearedTxId) {
      onDeleteTx(ch.clearedTxId);
    }
    setChecks((prev) =>
      prev.map((x) =>
        x.id === ch.id
          ? { ...x, status: nextStatus, settledDate: undefined, clearedTxId: undefined }
          : x
      )
    );
  };

  const handleDelete = async (ch: CheckItem) => {
    const ok = await dialog.confirm({
      title: 'حذف چک',
      message: `چک #${toPersianDigits(ch.checkNumber)} حذف شود؟${ch.clearedTxId ? ' تراکنش بانکی پاس‌شدن آن نیز حذف خواهد شد.' : ''}`,
      tone: 'danger',
      confirmLabel: 'حذف چک',
    });
    if (!ok) return;
    if (ch.clearedTxId) onDeleteTx(ch.clearedTxId);
    setChecks((prev) => prev.filter((x) => x.id !== ch.id));
  };

  const sendCheckSms = async (ch: CheckItem) => {
    setSmsSendingId(ch.id);
    try {
      const msg = `یادآور چک ${ch.kind === 'payable' ? 'پرداختی' : 'دریافتی'} شماره ${ch.checkNumber} به مبلغ ${money(ch.amount)} تومان (${contactName(ch.contactId)}) با سررسید ${formatJalaliShort(ch.dueDate)}.`;
      const resp = await apiJson<{ ok: boolean; log: { status: string; detail?: string } }>(
        '/api/reminders/dispatch',
        'POST',
        {
          recipient: reminderSettings.recipientMobile,
          message: msg,
        }
      );
      await dialog.alert({
        title: resp.log.status === 'sent' ? 'پیامک ارسال شد' : 'ثبت در حالت آزمایشی',
        message: resp.log.detail || 'پیامک یادآوری در تاریخچه ثبت شد.',
      });
    } catch (e: any) {
      await dialog.alert({
        title: 'ارسال پیامک',
        message:
          e?.message ||
          'ابتدا شماره موبایل گیرنده را در بخش تنظیمات «یادآورها و پیامک» وارد و ذخیره کنید.',
      });
    } finally {
      setSmsSendingId(null);
    }
  };

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      filtered.map((ch) => ({
        نوع: ch.kind === 'payable' ? 'پرداختی' : 'دریافتی',
        'شماره چک': ch.checkNumber,
        طرف‌حساب: contactName(ch.contactId),
        بانک: getAccountById(accounts, ch.bankAccountId)?.name || '—',
        'تاریخ صدور': formatJalaliShort(ch.issueDate),
        سررسید: formatJalaliShort(ch.dueDate),
        'مبلغ (تومان)': ch.amount,
        وضعیت: STATUS_META[ch.status].label,
        شرح: ch.description,
      })),
      'مدیریت چک‌ها',
      'checks-list'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    await downloadTableReportPdf({
      title: 'گزارش چک‌های پرداختی و دریافتی',
      storeName,
      subtitle: `${toPersianDigits(String(filtered.length))} فقره چک`,
      pageSize,
      filename: `checks-${pageSize}`,
      columns: [
        { header: 'نوع', width: 0.9, align: 'right' },
        { header: 'شماره چک', width: 1.1, align: 'right' },
        { header: 'طرف‌حساب', width: 1.6, align: 'right' },
        { header: 'سررسید', width: 1.1, align: 'right' },
        { header: 'وضعیت', width: 1.0, align: 'right' },
        { header: 'مبلغ', width: 1.4, align: 'amount' },
      ],
      rows: filtered.map((ch) => [
        ch.kind === 'payable' ? 'پرداختی' : 'دریافتی',
        toPersianDigits(ch.checkNumber),
        contactName(ch.contactId),
        formatDateFa(ch.dueDate),
        STATUS_META[ch.status].label,
        formatMoneyFa(ch.amount),
      ]),
      summary: [
        { label: 'چک‌های پرداختی در جریان', value: formatMoneyFa(pendingPayable) },
        { label: 'چک‌های دریافتی در جریان', value: formatMoneyFa(pendingReceivable) },
      ],
    });
  };

  return (
    <div className="animate-page-enter space-y-5 md:space-y-6" data-testid="checks-page">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
            مدیریت چک‌ها
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)] md:text-sm">
            ثبت چک پرداختی و دریافتی (اثر فوری روی حساب شخص، تغییر بانک هنگام پاس‌شدن) و یادآوری سررسید
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filtered.length > 0 ? (
            <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="journals.export" />
          ) : null}
          {canCreate ? (
            <Button icon={Plus} data-testid="check-add" onClick={openCreate}>
              ثبت چک جدید
            </Button>
          ) : null}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-3.5 md:grid-cols-3 lg:gap-4">
        <div className="balance-gradient rounded-[1.5rem] p-5 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <FileSpreadsheet size={18} />
            </span>
            <p className="text-sm font-bold text-white/90">چک‌های پرداختی در جریان</p>
          </div>
          <p className="mt-4 truncate text-[1.75rem] font-black tabular-nums">
            {money(pendingPayable)}
            <span className="ms-2 text-xs font-bold text-white/80">تومان</span>
          </p>
          <span className="mt-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold">
            تعهدات پرداختنی تا زمان پاس‌شدن
          </span>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div>
            <p className="text-sm font-bold text-[color:var(--muted)]">چک‌های دریافتی در جریان</p>
            <p className="mt-2 text-2xl font-black tabular-nums text-[color:var(--income)]">
              {money(pendingReceivable)}
              <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
            </p>
          </div>
          <p className="mt-3 text-xs text-[color:var(--muted)]">در انتظار وصول در تاریخ سررسید</p>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted)]">سررسید نزدیک / گذشته</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400">
                {toPersianDigits(String(dueSoonCount))} فقره
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
              <AlertTriangle size={20} />
            </div>
          </div>
          <p className="mt-3 text-xs text-[color:var(--muted)]">
            بازه یادآوری: {toPersianDigits(String(reminderSettings.leadDays ?? 2))} روز قبل از سررسید
          </p>
        </div>
      </section>

      {/* Main List */}
      <section className="space-y-3.5">
        <div className="dash-card rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1 sm:inline-flex sm:w-auto">
              {(
                [
                  { id: 'all', label: 'همه چک‌ها' },
                  { id: 'payable', label: 'چک‌های پرداختی' },
                  { id: 'receivable', label: 'چک‌های دریافتی' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setKindTab(t.id)}
                  className={cn(
                    'flex-1 shrink-0 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition sm:flex-none sm:px-3.5 sm:text-xs',
                    kindTab === t.id
                      ? 'btn-brand-gradient text-white shadow-sm'
                      : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <div className="flex h-10 min-w-[12rem] max-w-xs flex-1 items-center gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 px-3">
                <Search size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
                <input
                  aria-label="جست‌وجو در چک‌ها"
                  className="h-full min-w-0 flex-1 bg-transparent text-xs text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="شماره چک، صیاد، شخص یا بانک..."
                />
              </div>

              <span className="relative inline-flex shrink-0">
                <select
                  aria-label="فیلتر وضعیت چک"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="h-10 appearance-none rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 pe-8 ps-3 text-xs font-bold text-[color:var(--ink)] outline-none"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="pending">در جریان</option>
                  <option value="cleared">پاس‌شده</option>
                  <option value="bounced">برگشت‌خورده</option>
                  <option value="cancelled">باطل‌شده</option>
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
                  aria-hidden
                />
              </span>
            </div>
          </div>
        </div>

        {checks.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="هنوز چکی ثبت نشده است"
              description="چک‌های پرداختی به تأمین‌کنندگان یا چک‌های دریافتی از مشتریان را ثبت کنید تا هم مانده حساب شخص و هم هشدار سررسید خودکار مدیریت شود."
              action={
                canCreate ? (
                  <Button icon={Plus} onClick={openCreate}>
                    ثبت اولین چک
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm font-bold text-[color:var(--muted)]">
            چکی مطابق فیلترهای انتخابی یافت نشد.
          </div>
        ) : (
          <div className="mt-4 space-y-2.5" data-testid="checks-list">
            {filtered.map((ch) => {
              const bank = getAccountById(accounts, ch.bankAccountId);
              const dLeft = daysUntil(ch.dueDate);
              const isAlert = ch.status === 'pending' && dLeft <= (reminderSettings.leadDays ?? 2);
              const st = STATUS_META[ch.status];

              return (
                <div
                  key={ch.id}
                  data-testid="check-card"
                  className={cn(
                    'dash-card rounded-2xl p-4 transition',
                    isAlert && 'ring-1 ring-amber-500/45'
                  )}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
                            ch.kind === 'payable' ? 'tone-expense' : 'tone-income'
                          )}
                        >
                          {ch.kind === 'payable' ? 'چک پرداختی' : 'چک دریافتی'} #{toPersianDigits(ch.checkNumber)}
                        </span>
                        <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', st.cls)}>
                          {st.label}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
                            isAlert
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'bg-[color:var(--surface-2)] text-[color:var(--muted)]'
                          )}
                        >
                          <Clock size={11} />
                          سررسید: {formatJalaliShort(ch.dueDate)}
                          {ch.status === 'pending' && dLeft <= 0
                            ? ' (امروز / گذشته)'
                            : ch.status === 'pending' && dLeft <= 7
                              ? ` (${toPersianDigits(String(dLeft))} روز دیگر)`
                              : ''}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="text-sm font-black text-[color:var(--ink)]">
                          {contactName(ch.contactId)}
                        </h3>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)]">
                          <BankLogo
                            name={bank?.name || 'بانک'}
                            treasuryType={bank ? resolveTreasuryType(bank) : undefined}
                            size="xs"
                          />
                          {bank?.name || 'بانک'}
                        </span>
                        {ch.sayadId ? (
                          <span className="text-[11px] tabular-nums text-[color:var(--muted)]">
                            صیاد: {toPersianDigits(ch.sayadId)}
                          </span>
                        ) : null}
                      </div>

                      {ch.description ? (
                        <p className="text-xs text-[color:var(--muted)]">{ch.description}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2.5 lg:justify-end">
                      <p className="text-base font-black tabular-nums text-[color:var(--ink)]">
                        {money(ch.amount)}
                        <span className="ms-1 text-[10px] font-semibold text-[color:var(--muted)]">تومان</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {canEdit && ch.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              icon={CheckCircle2}
                              data-testid={`check-clear-${ch.id}`}
                              onClick={() => {
                                setClearingCheck(ch);
                                setClearDate(getLocalDateISOString(new Date()));
                              }}
                            >
                              پاس شد
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={Ban}
                              data-testid={`check-bounce-${ch.id}`}
                              onClick={() => void markStatus(ch, 'bounced')}
                            >
                              برگشت خورد
                            </Button>
                          </>
                        ) : null}

                        {canEdit && (ch.status === 'bounced' || ch.status === 'cancelled') ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={RotateCcw}
                            onClick={() => void markStatus(ch, 'pending')}
                          >
                            بازگشت به در جریان
                          </Button>
                        ) : null}

                        {canCreate && ch.status === 'pending' ? (
                          <IconButton
                            icon={Send}
                            label="ارسال پیامک یادآوری چک"
                            size="sm"
                            disabled={smsSendingId === ch.id}
                            onClick={() => void sendCheckSms(ch)}
                          />
                        ) : null}

                        {canEdit && ch.status === 'pending' ? (
                          <IconButton
                            icon={Pencil}
                            label="ویرایش چک"
                            size="sm"
                            onClick={() => openEdit(ch)}
                          />
                        ) : null}

                        {canDelete ? (
                          <IconButton
                            icon={Trash2}
                            label="حذف چک"
                            size="sm"
                            variant="soft-danger"
                            onClick={() => void handleDelete(ch)}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create / Edit Check Modal */}
      <FormSheet
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        accent={formKind === 'payable' ? 'expense' : 'income'}
        size="lg"
        dock
        headerChip={<StoreMark name={storeName} logo={settings?.logo || undefined} size="md" />}
        title={editing ? 'ویرایش چک' : 'ثبت چک جدید'}
        subtitle="در لحظه ثبت، حساب طرف‌حساب به‌روز می‌شود و هنگام پاس‌شدن موجودی بانک تغییر می‌کند"
        footer={
          <FormActions
            onCancel={() => setFormOpen(false)}
            onSubmit={() => void saveCheck()}
            submitLabel={editing ? 'ذخیره تغییرات' : 'ثبت چک'}
            submitIcon={editing ? Check : Plus}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1">
            <button
              type="button"
              onClick={() => setFormKind('payable')}
              className={cn(
                'h-10 rounded-xl text-xs font-extrabold transition',
                formKind === 'payable'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              چک پرداختی (صادره)
            </button>
            <button
              type="button"
              onClick={() => setFormKind('receivable')}
              className={cn(
                'h-10 rounded-xl text-xs font-extrabold transition',
                formKind === 'receivable'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              چک دریافتی (وارده)
            </button>
          </div>

          <AmountInput
            label="مبلغ چک (تومان)"
            value={amountRaw}
            onChange={setAmountRaw}
            accent={formKind === 'payable' ? 'expense' : 'income'}
            compact
          />

          <div className="form-section space-y-3.5 sm:space-y-4">
            <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
              <div>
                <label className={fieldLabel}>شماره چک</label>
                <input
                  className={cn(fieldInput, 'tabular-nums')}
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="مثلاً ۵۵۲۹۱۰"
                />
              </div>
              <div>
                <label className={fieldLabel}>تاریخ سررسید</label>
                <PersianDatePicker value={dueDate} onChange={setDueDate} />
              </div>
              <div>
                <label className={fieldLabel}>طرف‌حساب</label>
                <select
                  className={fieldInput}
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                >
                  <option value="">انتخاب شخص...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>بانک مرتبط</label>
                <select
                  className={fieldInput}
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <CollapsibleOptionalSection
              title="صیاد، تاریخ صدور، فاکتور و توضیحات (اختیاری)"
              filledCount={countFilledFields([sayadId, invoiceId, description])}
              mobileOnly
              testId="check-optional-section"
            >
              <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className={fieldLabel}>شناسه صیاد (اختیاری)</label>
                  <input
                    className={cn(fieldInput, 'tabular-nums')}
                    dir="ltr"
                    value={sayadId}
                    onChange={(e) => setSayadId(e.target.value)}
                    placeholder="16 digit Sayad ID"
                  />
                </div>
                <div>
                  <label className={fieldLabel}>تاریخ صدور / دریافت</label>
                  <PersianDatePicker value={issueDate} onChange={setIssueDate} />
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>اتصال به فاکتور (اختیاری)</label>
                  <select
                    className={fieldInput}
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                  >
                    <option value="">بدون اتصال به فاکتور خاص</option>
                    {invoices
                      .filter(
                        (i) =>
                          (!contactId || i.contactId === contactId) &&
                          ((formKind === 'payable' && i.kind === 'purchase') ||
                            (formKind === 'receivable' && i.kind === 'sale'))
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          فاکتور #{toPersianDigits(i.invoiceNumber)} — {contactName(i.contactId)} ({money(i.amount)} تومان)
                        </option>
                      ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>توضیحات</label>
                  <input
                    className={fieldInput}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="مثلاً بابت بخشی از فاکتور سم و کود"
                  />
                </div>
              </div>
            </CollapsibleOptionalSection>
          </div>
        </div>
      </FormSheet>

      {/* Clear Check Confirmation Modal */}
      <FormSheet
        isOpen={Boolean(clearingCheck)}
        onClose={() => setClearingCheck(null)}
        accent="income"
        size="sm"
        dock
        headerChip={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <CheckCircle2 size={19} />
          </span>
        }
        title="تأیید پاس‌شدن چک"
        subtitle={
          clearingCheck
            ? `چک #${toPersianDigits(clearingCheck.checkNumber)} به مبلغ ${money(clearingCheck.amount)} تومان (${getAccountById(accounts, clearingCheck.bankAccountId)?.name || 'بانک'})`
            : undefined
        }
        footer={
          <FormActions
            onCancel={() => setClearingCheck(null)}
            onSubmit={confirmClearCheck}
            submitLabel="ثبت پاس‌شدن و اعمال در بانک"
            submitIcon={CheckCircle2}
          />
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-xs leading-6 text-[color:var(--ink)]">
            با تأیید پاس‌شدن، مبلغ چک در تاریخ زیر از حساب بانکی{' '}
            {clearingCheck?.kind === 'payable' ? 'کسر' : 'واریز'} می‌شود بدون اینکه مجدداً حساب طرف‌حساب یا سود و زیان را دوباره‌شماری کند.
          </div>
          <div className="form-section">
            <div>
              <label className={fieldLabel}>تاریخ پاس‌شدن در بانک</label>
              <PersianDatePicker value={clearDate} onChange={setClearDate} />
            </div>
          </div>
        </div>
      </FormSheet>
    </div>
  );
};

export default ChecksPage;
