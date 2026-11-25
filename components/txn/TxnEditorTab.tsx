import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Coins,
  CreditCard,
  FileCheck2,
  FileText,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type {
  Account,
  AppSettings,
  Attachment,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  Transaction,
  TransactionType,
} from '../../types';
import { normalizeAttachment } from '../../utils/attachments';
import { getAccountById, getAccountPathLabel } from '../../utils/accountTree';
import { resolveDefaultAccountId } from '../../utils/accountingTemplates';
import { computePersonBalance } from '../../utils/accrualEngine';
import { getInvoicesForSettlementPicker } from '../../utils/invoiceSettlementFlow';
import { resolveTreasuryType } from '../../utils/bankBrand';
import { contactLabel } from '../../utils/contactStats';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  parseIntegerAmount,
  toPersianDigits,
} from '../../utils/formatters';
import PersianDatePicker from '../PersianDatePicker';
import AccountTreePicker from '../AccountTreePicker';
import PersonCascadePicker from '../PersonCascadePicker';
import AttachmentField from '../ui/AttachmentField';
import { BankLogo } from '../ui/BankLogo';
import {
  AmountInput,
  Button,
  CollapsibleOptionalSection,
  MobileStickyBar,
  cn,
  fieldInput,
  fieldLabel,
} from '../ui';
import { countFilledFields } from '../../utils/formLayout';
import { useDialog } from '../DialogProvider';

export type TxnDocumentPurpose = 'direct' | 'invoice_settlement' | 'account_settlement';
export type TxnSettlementMethod = 'cash' | 'check';

export interface TxnEditorTabProps {
  mode: 'income' | 'expense';
  isActive?: boolean;
  accounts: Account[];
  banks: Account[];
  contactGroups: ContactGroup[];
  contacts: Contact[];
  invoices?: Invoice[];
  checks?: CheckItem[];
  transactions?: Transaction[];
  settings?: AppSettings;
  initialTransaction?: Transaction | null;
  onSave: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  onSaveCheck?: (ch: Omit<CheckItem, 'id'> | CheckItem) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

export const TxnEditorTab: React.FC<TxnEditorTabProps> = ({
  mode,
  isActive = true,
  accounts,
  banks,
  contactGroups,
  contacts,
  invoices = [],
  checks = [],
  transactions = [],
  settings,
  initialTransaction = null,
  onSave,
  onSaveCheck,
  onCancel,
  onDirtyChange,
}) => {
  const dialog = useDialog();
  const isEdit = Boolean(initialTransaction?.id);
  const type: TransactionType = mode;
  const targetInvoiceKind = mode === 'income' ? 'sale' : 'purchase';

  const catOptions = useMemo(
    () =>
      accounts.filter(
        (a) => a.kind === 'postable' && a.module === mode && a.isActive !== false
      ),
    [accounts, mode]
  );

  const [purpose, setPurpose] = useState<TxnDocumentPurpose>(() => {
    if (initialTransaction?.linkKind === 'invoice_settlement') {
      return initialTransaction.invoiceId ? 'invoice_settlement' : 'account_settlement';
    }
    return 'direct';
  });
  const [method, setMethod] = useState<TxnSettlementMethod>('cash');
  const [invoiceId, setInvoiceId] = useState<string>(initialTransaction?.invoiceId || '');

  const [amountStr, setAmountStr] = useState(
    initialTransaction ? String(initialTransaction.amount) : ''
  );
  const [date, setDate] = useState(
    initialTransaction?.date || getLocalDateISOString(new Date())
  );
  const [accountId, setAccountId] = useState(() => {
    if (initialTransaction?.accountId) return initialTransaction.accountId;
    return (
      resolveDefaultAccountId(
        accounts,
        settings?.accountingDefaults,
        mode === 'income' ? 'incomeTxn' : 'expenseTxn'
      ) ||
      catOptions[0]?.id ||
      ''
    );
  });
  const [bankAccountId, setBankAccountId] = useState(() => {
    if (
      initialTransaction?.bankAccountId &&
      banks.some((b) => b.id === initialTransaction.bankAccountId)
    ) {
      return initialTransaction.bankAccountId;
    }
    const defBank = resolveDefaultAccountId(
      accounts,
      settings?.accountingDefaults,
      'defaultBank'
    );
    if (defBank && banks.some((b) => b.id === defBank)) return defBank;
    return banks[0]?.id || '';
  });
  const [contactId, setContactId] = useState<string | undefined>(
    initialTransaction?.contactId
  );
  const [description, setDescription] = useState(
    initialTransaction?.description || ''
  );
  const [attachment, setAttachment] = useState<Attachment | undefined>(() =>
    normalizeAttachment(initialTransaction?.attachment)
  );

  // Check fields (used when method === 'check' in invoice_settlement or account_settlement)
  const [checkNumber, setCheckNumber] = useState('');
  const [checkSayadId, setCheckSayadId] = useState('');
  const [checkBankName, setCheckBankName] = useState('');
  const [checkDueDate, setCheckDueDate] = useState(() => getLocalDateISOString(new Date()));

  useEffect(() => {
    if (!bankAccountId && banks[0]?.id) {
      const defBank = resolveDefaultAccountId(
        accounts,
        settings?.accountingDefaults,
        'defaultBank'
      );
      setBankAccountId(defBank && banks.some((b) => b.id === defBank) ? defBank : banks[0].id);
    }
    if (bankAccountId && !banks.some((b) => b.id === bankAccountId)) {
      setBankAccountId(banks[0]?.id || '');
    }
  }, [banks, bankAccountId, accounts, settings?.accountingDefaults]);

  const pickerInvoices = useMemo(
    () =>
      getInvoicesForSettlementPicker({
        invoices,
        transactions,
        checks,
        kind: targetInvoiceKind,
        contactId,
        includePaid: false,
        selectedInvoiceId: invoiceId || undefined,
      }),
    [invoices, transactions, checks, targetInvoiceKind, contactId, invoiceId]
  );

  const selectedInvoiceEntry = useMemo(
    () => pickerInvoices.find((entry) => entry.invoice.id === invoiceId) || null,
    [pickerInvoices, invoiceId]
  );

  const selectedPersonBalance = useMemo(() => {
    if (!contactId) return null;
    return computePersonBalance(contactId, invoices, [], checks, transactions, { accounts });
  }, [contactId, invoices, checks, transactions, accounts]);

  const handleSelectInvoice = (nextInvId: string) => {
    setInvoiceId(nextInvId);
    const entry = pickerInvoices.find((e) => e.invoice.id === nextInvId);
    if (!entry) return;
    if (entry.invoice.contactId) {
      setContactId(entry.invoice.contactId);
    }
    if (entry.invoice.accountId) {
      setAccountId(entry.invoice.accountId);
    }
    if (!parseIntegerAmount(amountStr) && entry.remaining > 0) {
      setAmountStr(String(entry.remaining));
    }
  };

  const handlePurposeChange = (nextPurpose: TxnDocumentPurpose) => {
    setPurpose(nextPurpose);
    if (nextPurpose === 'direct') {
      setMethod('cash');
      setInvoiceId('');
    }
  };

  const parsedAmount = parseIntegerAmount(amountStr);

  const isDirty = useMemo(() => {
    if (initialTransaction) {
      return (
        parsedAmount !== initialTransaction.amount ||
        date !== initialTransaction.date ||
        accountId !== initialTransaction.accountId ||
        bankAccountId !== initialTransaction.bankAccountId ||
        (contactId || '') !== (initialTransaction.contactId || '') ||
        description !== (initialTransaction.description || '')
      );
    }
    return Boolean(
      parsedAmount > 0 ||
        description.trim() ||
        contactId ||
        invoiceId ||
        checkNumber.trim() ||
        attachment
    );
  }, [
    initialTransaction,
    parsedAmount,
    date,
    accountId,
    bankAccountId,
    contactId,
    invoiceId,
    checkNumber,
    description,
    attachment,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const canSubmit = useMemo(() => {
    if (parsedAmount <= 0) return false;
    if (purpose === 'invoice_settlement' && !invoiceId) return false;
    if (purpose === 'account_settlement' && !contactId) return false;

    if (method === 'check' && purpose !== 'direct') {
      return Boolean(onSaveCheck && checkNumber.trim() && (contactId || selectedInvoiceEntry?.invoice.contactId));
    }

    const acc = accountId ? getAccountById(accounts, accountId) : undefined;
    const bankOk = banks.some((b) => b.id === bankAccountId);
    return !!acc && acc.kind === 'postable' && acc.module === mode && bankOk;
  }, [
    parsedAmount,
    purpose,
    invoiceId,
    contactId,
    method,
    onSaveCheck,
    checkNumber,
    selectedInvoiceEntry,
    accountId,
    bankAccountId,
    accounts,
    banks,
    mode,
  ]);

  const selectedBank = banks.find((b) => b.id === bankAccountId);
  const selectedContactName = contactId
    ? contactLabel(contacts, contactGroups, contactId)
    : undefined;
  const selectedAccountPath = accountId ? getAccountPathLabel(accounts, accountId) : '—';

  const handleSubmit = async () => {
    if (!parsedAmount) {
      await dialog.alert({ title: 'مبلغ', message: 'مبلغ معتبر وارد کنید.' });
      return;
    }

    if (purpose === 'invoice_settlement' && !invoiceId) {
      await dialog.alert({
        title: 'انتخاب فاکتور',
        message: 'لطفاً فاکتوری که می‌خواهید تسویه کنید را انتخاب نمایید.',
      });
      return;
    }

    if (purpose === 'account_settlement' && !contactId) {
      await dialog.alert({
        title: 'انتخاب طرف‌حساب',
        message: 'برای ثبت دریافت یا پرداخت در صورتحساب، طرف‌حساب را انتخاب کنید.',
      });
      return;
    }

    const effectiveContactId =
      contactId || selectedInvoiceEntry?.invoice.contactId || undefined;
    const effectiveInvoiceNumber = selectedInvoiceEntry?.invoice.invoiceNumber;

    // 1. Check Settlement path (creates a CheckItem linked to the invoice or person statement)
    if (method === 'check' && purpose !== 'direct') {
      if (!onSaveCheck) return;
      if (!checkNumber.trim()) {
        await dialog.alert({ title: 'شماره چک', message: 'شماره چک را وارد کنید.' });
        return;
      }
      if (!effectiveContactId) {
        await dialog.alert({
          title: 'طرف‌حساب چک',
          message: 'برای ثبت چک، طرف‌حساب باید مشخص باشد.',
        });
        return;
      }

      const defaultCheckDesc =
        purpose === 'invoice_settlement' && effectiveInvoiceNumber
          ? `چک ${mode === 'income' ? 'دریافتی' : 'پرداختی'} بابت فاکتور #${effectiveInvoiceNumber}`
          : `چک ${mode === 'income' ? 'دریافتی' : 'پرداختی'} بابت تسویه حساب ${selectedContactName || ''}`.trim();

      onSaveCheck({
        kind: mode === 'income' ? 'receivable' : 'payable',
        checkNumber: checkNumber.trim(),
        sayadId: checkSayadId.trim() || undefined,
        amount: parsedAmount,
        issueDate: date,
        dueDate: checkDueDate || date,
        bankAccountId: bankAccountId || banks[0]?.id || '',
        contactId: effectiveContactId,
        invoiceId: purpose === 'invoice_settlement' ? invoiceId : undefined,
        status: 'pending',
        description: [checkBankName.trim(), description.trim() || defaultCheckDesc]
          .filter(Boolean)
          .join(' — '),
      });
      return;
    }

    // 2. Cash / Bank Transaction path
    const effectiveAccountId =
      purpose === 'invoice_settlement' && selectedInvoiceEntry?.invoice.accountId
        ? selectedInvoiceEntry.invoice.accountId
        : accountId;

    const acc = getAccountById(accounts, effectiveAccountId);
    if (!acc || acc.kind !== 'postable' || acc.module !== mode) {
      await dialog.alert({ title: 'سرفصل', message: 'سرفصل معتبر انتخاب کنید.' });
      return;
    }
    if (!banks.some((b) => b.id === bankAccountId)) {
      await dialog.alert({ title: 'بانک', message: 'ابتدا یک حساب بانکی بسازید.' });
      return;
    }

    const defaultDesc =
      purpose === 'invoice_settlement' && effectiveInvoiceNumber
        ? `${mode === 'income' ? 'دریافت' : 'پرداخت'} وجه بابت فاکتور #${effectiveInvoiceNumber}`
        : purpose === 'account_settlement'
          ? `${mode === 'income' ? 'دریافت' : 'پرداخت'} وجه علی‌الحساب (${selectedContactName || 'صورتحساب شخص'})`
          : mode === 'income'
            ? 'درآمد'
            : 'هزینه';

    const payload: Transaction | Omit<Transaction, 'id'> = {
      type,
      amount: parsedAmount,
      date,
      accountId: effectiveAccountId,
      bankAccountId,
      contactId: effectiveContactId,
      linkKind:
        purpose === 'invoice_settlement' || purpose === 'account_settlement'
          ? 'invoice_settlement'
          : undefined,
      invoiceId: purpose === 'invoice_settlement' ? invoiceId : undefined,
      description: description.trim() || defaultDesc,
      attachment,
      ...(initialTransaction?.id ? { id: initialTransaction.id } : {}),
    };
    onSave(payload);
  };

  const accentBadge =
    mode === 'income'
      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
      : 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25';

  const submitLabel = isEdit
    ? 'ذخیره تغییرات'
    : method === 'check' && purpose !== 'direct'
      ? mode === 'income'
        ? 'ثبت چک دریافتی'
        : 'ثبت چک پرداختی'
      : purpose === 'invoice_settlement'
        ? mode === 'income'
          ? 'ثبت دریافت بابت فاکتور'
          : 'ثبت پرداخت بابت فاکتور'
        : purpose === 'account_settlement'
          ? mode === 'income'
            ? 'ثبت دریافت در صورتحساب'
            : 'ثبت پرداخت در صورتحساب'
          : mode === 'income'
            ? 'ثبت نهایی درآمد'
            : 'ثبت نهایی هزینه';

  const optionalFilledCount = countFilledFields([contactId, description, attachment]);

  return (
    <div
      className={cn('space-y-4 md:space-y-5', isActive && 'pb-28 md:pb-0')}
      data-testid={`txn-mdi-editor-${mode}`}
    >
      {/* Contextual Document Banner */}
      <div className="dash-card relative hidden overflow-hidden p-4 md:block lg:p-5">
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-[3px]',
            mode === 'income'
              ? 'bg-gradient-to-l from-emerald-500 via-teal-400 to-cyan-500'
              : 'bg-gradient-to-l from-rose-500 via-pink-500 to-orange-400'
          )}
          aria-hidden
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm lg:h-11 lg:w-11',
                mode === 'income'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                  : 'bg-gradient-to-br from-rose-500 to-pink-600 text-white'
              )}
            >
              {mode === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-[color:var(--ink)] lg:text-lg">
                  {isEdit
                    ? mode === 'income'
                      ? 'ویرایش سند دریافت / درآمد'
                      : 'ویرایش سند پرداخت / هزینه'
                    : mode === 'income'
                      ? 'ثبت دریافت / درآمد جدید'
                      : 'ثبت پرداخت / هزینه جدید'}
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold',
                    accentBadge
                  )}
                >
                  <Sparkles size={11} aria-hidden />
                  {purpose === 'invoice_settlement'
                    ? 'تسویه فاکتور (نقد / چک)'
                    : purpose === 'account_settlement'
                      ? 'تسویه صورتحساب شخص'
                      : mode === 'income'
                        ? 'درآمد مستقیم'
                        : 'هزینه مستقیم'}
                </span>
              </div>
              <p className="mt-0.5 hidden text-xs font-medium text-[color:var(--muted)] xl:block">
                می‌توانید دریافت/پرداخت مستقیم، تسویه چندمرحله‌ای فاکتور یا علی‌الحساب صورتحساب شخص را به‌صورت نقدی یا چک ثبت کنید.
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 xl:flex">
            <Button variant="secondary" size="sm" onClick={onCancel}>
              بستن تب
            </Button>
            <Button
              size="sm"
              icon={Check}
              disabled={!canSubmit}
              data-testid="txn-mdi-submit"
              onClick={() => void handleSubmit()}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Responsive Workspace */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5">
        {/* Primary Form Card */}
        <div className="dash-card space-y-4 p-3.5 sm:p-5 lg:space-y-5 lg:p-6">
          {/* 3-Way Document Purpose Switcher */}
          <div>
            <label className={fieldLabel}>
              {mode === 'income' ? 'بابت / نوع ثبت دریافت' : 'بابت / نوع ثبت پرداخت'}
            </label>
            <div
              className="grid grid-cols-1 gap-1.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1 sm:grid-cols-3"
              data-testid="txn-purpose-switcher"
            >
              <button
                type="button"
                data-testid="txn-purpose-direct"
                onClick={() => handlePurposeChange('direct')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-extrabold transition',
                  purpose === 'direct'
                    ? 'bg-[color:var(--surface-solid)] text-[color:var(--brand)] shadow-xs ring-1 ring-[color:var(--brand)]/30'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <Coins size={14} />
                {mode === 'income' ? 'درآمد مستقیم' : 'هزینه مستقیم'}
              </button>
              <button
                type="button"
                data-testid="txn-purpose-invoice"
                onClick={() => handlePurposeChange('invoice_settlement')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-extrabold transition',
                  purpose === 'invoice_settlement'
                    ? 'bg-[color:var(--surface-solid)] text-[color:var(--brand)] shadow-xs ring-1 ring-[color:var(--brand)]/30'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <FileText size={14} />
                بابت تسویه فاکتور
              </button>
              <button
                type="button"
                data-testid="txn-purpose-account"
                onClick={() => handlePurposeChange('account_settlement')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-extrabold transition',
                  purpose === 'account_settlement'
                    ? 'bg-[color:var(--surface-solid)] text-[color:var(--brand)] shadow-xs ring-1 ring-[color:var(--brand)]/30'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <UserCheck size={14} />
                بابت صورتحساب شخص
              </button>
            </div>
          </div>

          {/* Settlement Method Switcher (Cash/Bank vs Check) when settling Invoice or Person Statement */}
          {purpose !== 'direct' && !isEdit && onSaveCheck ? (
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/50 p-1">
              <button
                type="button"
                data-testid="txn-method-cash"
                onClick={() => setMethod('cash')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition',
                  method === 'cash'
                    ? 'btn-brand-gradient text-white shadow-xs'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <Wallet size={14} />
                نقدی / واریز بانکی
              </button>
              <button
                type="button"
                data-testid="txn-method-check"
                onClick={() => setMethod('check')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition',
                  method === 'check'
                    ? 'btn-brand-gradient text-white shadow-xs'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <FileCheck2 size={14} />
                {mode === 'income' ? 'ثبت چک دریافتی' : 'ثبت چک پرداختی'}
              </button>
            </div>
          ) : null}

          {/* Invoice Settlement Picker & Live Balance Banner */}
          {purpose === 'invoice_settlement' ? (
            <div className="space-y-3 rounded-2xl border border-[color:var(--brand)]/25 bg-[color:var(--brand-soft)]/35 p-3.5 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <PersonCascadePicker
                    groups={contactGroups}
                    contacts={contacts}
                    value={contactId}
                    onChange={(nextContact) => {
                      setContactId(nextContact);
                      if (
                        invoiceId &&
                        nextContact &&
                        selectedInvoiceEntry?.invoice.contactId &&
                        selectedInvoiceEntry.invoice.contactId !== nextContact
                      ) {
                        setInvoiceId('');
                      }
                    }}
                    label={
                      mode === 'income'
                        ? 'فیلتر بر اساس مشتری / خریدار'
                        : 'فیلتر بر اساس فروشنده / تأمین‌کننده'
                    }
                  />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor={`txn-inv-picker-${mode}`}>
                    انتخاب فاکتور جهت تسویه
                  </label>
                  <select
                    id={`txn-inv-picker-${mode}`}
                    data-testid="txn-invoice-select"
                    className={fieldInput}
                    value={invoiceId}
                    onChange={(e) => handleSelectInvoice(e.target.value)}
                  >
                    <option value="">انتخاب فاکتور باز یا نیمه‌تسویه...</option>
                    {pickerInvoices.map((summary) => {
                      const { invoice } = summary;
                      const cName = invoice.contactId
                        ? contacts.find((c) => c.id === invoice.contactId)?.fullName || ''
                        : '';
                      return (
                        <option key={invoice.id} value={invoice.id}>
                          فاکتور #{toPersianDigits(invoice.invoiceNumber)}
                          {cName ? ` — ${cName}` : ''} | مانده: {money(summary.remaining)} تومان
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {selectedInvoiceEntry ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3.5 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      <span className="font-semibold text-[color:var(--muted)]">مبلغ فاکتور: </span>
                      <strong className="font-black tabular-nums text-[color:var(--ink)]">
                        {money(selectedInvoiceEntry.invoice.amount)} تومان
                      </strong>
                    </span>
                    <span>
                      <span className="font-semibold text-[color:var(--muted)]">تسویه‌شده: </span>
                      <strong className="font-black tabular-nums text-[color:var(--income)]">
                        {money(
                          selectedInvoiceEntry.paidCash +
                            selectedInvoiceEntry.clearedChecks +
                            selectedInvoiceEntry.pendingChecks
                        )}{' '}
                        تومان
                      </strong>
                    </span>
                    <span>
                      <span className="font-semibold text-[color:var(--muted)]">مانده باز: </span>
                      <strong className="font-black tabular-nums text-[color:var(--expense)]">
                        {money(selectedInvoiceEntry.remaining)} تومان
                      </strong>
                    </span>
                  </div>
                  {selectedInvoiceEntry.remaining > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="txn-fill-invoice-remaining"
                        onClick={() =>
                          setAmountStr(String(selectedInvoiceEntry.remaining))
                        }
                        className="rounded-lg bg-[color:var(--brand-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--brand)] transition hover:opacity-85"
                      >
                        درج کل مانده ({money(selectedInvoiceEntry.remaining)})
                      </button>
                      {selectedInvoiceEntry.remaining > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setAmountStr(
                              String(Math.round(selectedInvoiceEntry.remaining / 2))
                            )
                          }
                          className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-2)] px-2 py-1 text-[11px] font-bold text-[color:var(--ink)]"
                        >
                          ۵۰٪ مانده
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : pickerInvoices.length === 0 ? (
                <p className="text-xs font-bold text-[color:var(--muted)]">
                  هیچ فاکتور باز یا تسویه‌نشده‌ای برای این بخش یافت نشد.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Person Statement / On-Account Picker & Live Balance Banner */}
          {purpose === 'account_settlement' ? (
            <div className="space-y-3 rounded-2xl border border-[color:var(--brand)]/25 bg-[color:var(--brand-soft)]/35 p-3.5 sm:p-4">
              <div>
                <PersonCascadePicker
                  groups={contactGroups}
                  contacts={contacts}
                  value={contactId}
                  onChange={setContactId}
                  label="انتخاب طرف‌حساب (جهت ثبت در صورتحساب شخص)"
                />
              </div>

              {selectedPersonBalance ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3.5 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-[color:var(--muted)]">وضعیت فعلی حساب شخص:</span>
                    {selectedPersonBalance.status === 'creditor' ? (
                      <strong className="font-black tabular-nums text-[color:var(--expense)]">
                        {money(selectedPersonBalance.payableAmount)} تومان طلبکار از ما
                      </strong>
                    ) : selectedPersonBalance.status === 'debtor' ? (
                      <strong className="font-black tabular-nums text-[color:var(--income)]">
                        {money(selectedPersonBalance.receivableAmount)} تومان بدهکار به ما
                      </strong>
                    ) : (
                      <strong className="font-bold text-[color:var(--muted)]">تسویه‌شده (۰ تومان)</strong>
                    )}
                  </div>
                  {Math.abs(selectedPersonBalance.netBalance) > 0 ? (
                    <button
                      type="button"
                      data-testid="txn-fill-person-balance"
                      onClick={() =>
                        setAmountStr(String(Math.abs(selectedPersonBalance.netBalance)))
                      }
                      className="rounded-lg bg-[color:var(--brand-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[color:var(--brand)] transition hover:opacity-85"
                    >
                      درج کل مانده حساب ({money(Math.abs(selectedPersonBalance.netBalance))})
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <AmountInput
            id={`txn-amount-${mode}`}
            label={
              method === 'check' && purpose !== 'direct'
                ? 'مبلغ چک (تومان)'
                : mode === 'income'
                  ? 'مبلغ دریافت (تومان)'
                  : 'مبلغ پرداخت (تومان)'
            }
            value={amountStr}
            onChange={setAmountStr}
            placeholder="۰"
            accent={mode}
            autoFocus
          />

          {method === 'check' && purpose !== 'direct' ? (
            <div className="form-section grid grid-cols-1 items-start gap-3.5 md:grid-cols-2 md:gap-4">
              <div>
                <label className={fieldLabel}>شماره چک</label>
                <input
                  data-testid="txn-check-number"
                  className={cn(fieldInput, 'tabular-nums')}
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="مثلاً ۱۰۲۹۳۸"
                />
              </div>
              <div>
                <label className={fieldLabel}>شناسه صیادی ۱۶ رقمی (اختیاری)</label>
                <input
                  data-testid="txn-check-sayad"
                  className={cn(fieldInput, 'tabular-nums')}
                  value={checkSayadId}
                  onChange={(e) => setCheckSayadId(e.target.value)}
                  placeholder="۱۶ رقم صیاد"
                />
              </div>
              <div>
                <label className={fieldLabel}>تاریخ سررسید چک</label>
                <PersianDatePicker value={checkDueDate} onChange={setCheckDueDate} />
              </div>
              <div>
                <label className={fieldLabel}>نام بانک چک</label>
                <input
                  data-testid="txn-check-bank-name"
                  className={fieldInput}
                  value={checkBankName}
                  onChange={(e) => setCheckBankName(e.target.value)}
                  placeholder="مثلاً بانک ملت، ملی، صادرات..."
                />
              </div>
              <div className="md:col-span-2">
                <label className={fieldLabel}>شرح چک (اختیاری)</label>
                <input
                  data-testid="txn-mdi-desc"
                  className={fieldInput}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیحات تکمیلی درباره چک..."
                />
              </div>
            </div>
          ) : (
            <div className="form-section grid grid-cols-1 items-start gap-3.5 md:grid-cols-2 md:gap-4">
              {purpose !== 'invoice_settlement' ? (
                <div>
                  <AccountTreePicker
                    accounts={accounts}
                    module={mode}
                    value={accountId}
                    onChange={setAccountId}
                    label={mode === 'income' ? 'سرفصل درآمد / دریافت' : 'سرفصل هزینه / پرداخت'}
                  />
                </div>
              ) : null}

              <div className={cn(purpose === 'invoice_settlement' && 'md:col-span-1')}>
                <label className={fieldLabel} htmlFor={`txn-bank-${mode}`}>
                  {mode === 'income' ? 'واریز به حساب بانکی / صندوق' : 'پرداخت از حساب بانکی / صندوق'}
                </label>
                <div className="flex h-11 items-center gap-2.5 rounded-[0.9rem] border-[1.5px] border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-[3px] focus-within:ring-[color:var(--brand-glow)]">
                  {selectedBank ? (
                    <BankLogo
                      name={selectedBank.name}
                      treasuryType={resolveTreasuryType(selectedBank)}
                      size="xs"
                      className="h-6 w-6 shrink-0"
                    />
                  ) : null}
                  <select
                    id={`txn-bank-${mode}`}
                    data-testid="txn-mdi-bank"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="h-full w-full min-w-0 bg-transparent text-sm font-bold text-[color:var(--ink)] outline-none"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.accountTitle ? `— ${b.accountTitle}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={fieldLabel}>تاریخ ثبت</label>
                <PersianDatePicker value={date} onChange={setDate} />
              </div>

              {/* Optional contact field only shown in direct mode since invoice/account settlement already show it above */}
              {purpose === 'direct' ? (
                <div className="md:contents">
                  <CollapsibleOptionalSection
                    title="اطلاعات تکمیلی و تصویر رسید (اختیاری)"
                    subtitle="طرف‌حساب، شرح سند و پیوست تصویر"
                    filledCount={optionalFilledCount}
                    defaultOpenMobile={Boolean(isEdit && optionalFilledCount > 0)}
                    mobileOnly
                    testId={`txn-optional-${mode}`}
                  >
                    <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-1 md:gap-4">
                      <div>
                        <PersonCascadePicker
                          groups={contactGroups}
                          contacts={contacts}
                          value={contactId}
                          onChange={setContactId}
                          label="طرف حساب (اختیاری)"
                        />
                      </div>
                    </div>
                  </CollapsibleOptionalSection>
                </div>
              ) : null}

              <div className="hidden md:col-span-2 md:block">
                <label className={fieldLabel} htmlFor={`txn-desc-${mode}`}>
                  شرح و توضیحات
                </label>
                <input
                  id={`txn-desc-${mode}`}
                  data-testid="txn-mdi-desc"
                  className={fieldInput}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    purpose === 'invoice_settlement'
                      ? 'مثلاً قسط اول یا تسویه نهایی فاکتور'
                      : purpose === 'account_settlement'
                        ? 'مثلاً پرداخت علی‌الحساب بابت بدهی جاری'
                        : mode === 'income'
                          ? 'مثلاً دریافت بابت فروش نقدی یا ارائه خدمات'
                          : 'مثلاً خرید ملزومات اداری، هزینه حمل یا تعمیرات'
                  }
                />
              </div>
            </div>
          )}

          {/* Mobile-only optional description & attachment inside compact collapsible card */}
          <div className="md:hidden">
            <CollapsibleOptionalSection
              title="شرح سند و تصویر رسید"
              subtitle={description.trim() ? description.trim() : 'توضیحات متنی یا عکس فیش'}
              filledCount={countFilledFields([description, attachment])}
              defaultOpenMobile={Boolean(isEdit && (description.trim() || attachment))}
              mobileOnly={false}
              testId={`txn-mobile-notes-${mode}`}
            >
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className={fieldLabel} htmlFor={`txn-desc-mobile-${mode}`}>
                    شرح و توضیحات
                  </label>
                  <input
                    id={`txn-desc-mobile-${mode}`}
                    className={fieldInput}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      mode === 'income'
                        ? 'مثلاً دریافت بابت فروش نقدی یا ارائه خدمات'
                        : 'مثلاً خرید ملزومات اداری، هزینه حمل یا تعمیرات'
                    }
                  />
                </div>
                <AttachmentField value={attachment} onChange={setAttachment} />
              </div>
            </CollapsibleOptionalSection>
          </div>
        </div>

        {/* Summary & Receipt Sidebar */}
        <div className="hidden space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:block lg:space-y-4 lg:sticky lg:top-4">
          <div className="dash-card space-y-4 p-4 lg:p-5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl',
                  mode === 'income' ? 'tone-income' : 'tone-expense'
                )}
              >
                {method === 'check' && purpose !== 'direct' ? (
                  <CreditCard size={16} />
                ) : (
                  <Coins size={16} />
                )}
              </span>
              <h3 className="text-sm font-black text-[color:var(--ink)]">خلاصه سند</h3>
            </div>

            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/65 p-3.5 text-center">
              <p className="text-[11px] font-bold text-[color:var(--muted)]">
                {method === 'check' && purpose !== 'direct'
                  ? mode === 'income'
                    ? 'مبلغ چک دریافتی'
                    : 'مبلغ چک پرداختی'
                  : mode === 'income'
                    ? 'خالص دریافتی'
                    : 'خالص پرداختی'}
              </p>
              <p
                className={cn(
                  'mt-1 text-2xl font-black tabular-nums tracking-tight',
                  mode === 'income'
                    ? 'text-[color:var(--income)]'
                    : 'text-[color:var(--expense)]'
                )}
              >
                {parsedAmount > 0 ? (mode === 'income' ? '+' : '-') : ''}
                {money(parsedAmount)}
                <span className="ms-1.5 text-xs font-bold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>

            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line)]/60 pb-2">
                <dt className="font-semibold text-[color:var(--muted)]">نوع ثبت</dt>
                <dd className="truncate font-extrabold text-[color:var(--brand)]">
                  {purpose === 'invoice_settlement'
                    ? selectedInvoiceEntry
                      ? `تسویه فاکتور #${toPersianDigits(selectedInvoiceEntry.invoice.invoiceNumber)}`
                      : 'تسویه فاکتور'
                    : purpose === 'account_settlement'
                      ? 'تسویه صورتحساب شخص'
                      : mode === 'income'
                        ? 'درآمد مستقیم'
                        : 'هزینه مستقیم'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line)]/60 pb-2">
                <dt className="font-semibold text-[color:var(--muted)]">روش تسویه</dt>
                <dd className="truncate font-extrabold text-[color:var(--ink)]">
                  {method === 'check' && purpose !== 'direct'
                    ? `چک (${checkNumber || 'بدون شماره'})`
                    : selectedBank?.name || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line)]/60 pb-2">
                <dt className="font-semibold text-[color:var(--muted)]">سرفصل</dt>
                <dd className="truncate font-extrabold text-[color:var(--ink)]">
                  {purpose === 'invoice_settlement' && selectedInvoiceEntry?.invoice.accountId
                    ? getAccountPathLabel(accounts, selectedInvoiceEntry.invoice.accountId)
                    : selectedAccountPath}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="font-semibold text-[color:var(--muted)]">طرف حساب</dt>
                <dd className="truncate font-extrabold text-[color:var(--ink)]">
                  {selectedContactName || 'ثبت عمومی'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="dash-card space-y-3 p-4 lg:p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-brand">
                <Receipt size={16} />
              </span>
              <h3 className="text-sm font-black text-[color:var(--ink)]">تصویر رسید / فیش</h3>
            </div>
            <AttachmentField value={attachment} onChange={setAttachment} />
          </div>

          <div className="flex items-center gap-2.5 md:col-span-2 lg:col-span-1">
            <Button variant="secondary" className="flex-1" onClick={onCancel}>
              انصراف
            </Button>
            <Button
              className="flex-[1.5]"
              icon={Check}
              disabled={!canSubmit}
              data-testid="txn-mdi-submit-desktop"
              onClick={() => void handleSubmit()}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      {isActive ? (
        <MobileStickyBar
          submitLabel={submitLabel}
          onSubmit={() => void handleSubmit()}
          submitDisabled={!canSubmit}
          submitVariant={mode === 'income' ? 'income' : 'expense'}
          onCancel={onCancel}
          cancelLabel="بستن"
          summaryLabel={mode === 'income' ? 'خالص دریافتی' : 'خالص پرداختی'}
          summaryValue={parsedAmount > 0 ? `${money(parsedAmount)} تومان` : undefined}
          summaryTone={mode}
          submitTestId="txn-mdi-mobile-submit"
        />
      ) : null}
    </div>
  );
};

export default TxnEditorTab;
