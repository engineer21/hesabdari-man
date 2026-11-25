import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  FolderTree,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  Account,
  AppSettings,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  PayrollContract,
  PayrollEntry,
  Transaction,
} from '../types';
import {
  APP_NAME,
  DAILY_LABOR_ACCOUNT_ID,
  FIXED_SALARY_ACCOUNT_ID,
  IRRIGATION_ACCOUNT_ID,
  LABOR_GROUP_ACCOUNT_ID,
} from '../constants';
import { getAccountById, getBankAccounts, getPostableLeaves } from '../utils/accountTree';
import { resolveDefaultAccountId } from '../utils/accountingTemplates';
import { filterPersonnelContacts, suggestUnitForHeadingName } from '../utils/contactStats';
import { computePersonBalance } from '../utils/accrualEngine';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  parseIntegerAmount,
  toPersianDigits,
} from '../utils/formatters';
import {
  JALALI_MONTH_NAMES,
  formatJalaliShort,
  getJalaliParts,
  getLocalDayKey,
  jalaliToGregorianDate,
} from '../utils/jalaliPeriod';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { useCan } from '../hooks/useSessionAuth';
import PersianDatePicker from './PersianDatePicker';
import AccountTreePicker from './AccountTreePicker';
import { ExportActions } from './export/ExportActions';
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

interface PayrollPageProps {
  accounts: Account[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  contracts: PayrollContract[];
  setContracts: (v: PayrollContract[] | ((p: PayrollContract[]) => PayrollContract[])) => void;
  entries: PayrollEntry[];
  setEntries: (v: PayrollEntry[] | ((p: PayrollEntry[]) => PayrollEntry[])) => void;
  invoices: Invoice[];
  checks: CheckItem[];
  transactions: Transaction[];
  onSaveTx: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  onOpenPersons?: () => void;
  onOpenChartOfAccounts?: () => void;
  settings?: AppSettings;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const PayrollPage: React.FC<PayrollPageProps> = ({
  accounts,
  contacts,
  contactGroups,
  contracts,
  setContracts,
  entries,
  setEntries,
  invoices,
  checks,
  transactions,
  onSaveTx,
  onOpenPersons,
  onOpenChartOfAccounts,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canCreate = can('journals.create');
  const canEdit = can('journals.edit');
  const canDelete = can('journals.delete');

  const storeName = settings?.name || APP_NAME;
  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const expenseLeaves = useMemo(() => getPostableLeaves(accounts, 'acc_expense'), [accounts]);

  /** Strictly contacts defined as Personnel in اشخاص و طرف‌حساب‌ها */
  const personnelContacts = useMemo(
    () => filterPersonnelContacts(contacts, contactGroups),
    [contacts, contactGroups]
  );

  /** Real Chart-of-Accounts headings under «هزینه‌های نیروی انسانی و کارکرد» */
  const laborHeadings = useMemo(
    () => getPostableLeaves(accounts, LABOR_GROUP_ACCOUNT_ID),
    [accounts]
  );

  /** Quick-pick work-log headings (آبگیری، کارگری روزمزد، کارگری دسته‌جمعی و هر سرفصل دلخواه زیرگروه کارکرد) */
  const workLogQuickHeadings = useMemo(
    () => laborHeadings.filter((a) => a.id !== FIXED_SALARY_ACCOUNT_ID),
    [laborHeadings]
  );

  const defaultSalaryAccount = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'payrollFixed') ||
      expenseLeaves.find((a) => a.id === FIXED_SALARY_ACCOUNT_ID)?.id ||
      expenseLeaves.find((a) => a.name.includes('حقوق') || a.name.includes('دستمزد'))?.id ||
      expenseLeaves[0]?.id ||
      '',
    [accounts, settings?.accountingDefaults, expenseLeaves]
  );

  const defaultWorkAccount = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'payrollDaily') ||
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'payrollIrrigation') ||
      expenseLeaves.find((a) => a.id === IRRIGATION_ACCOUNT_ID)?.id ||
      expenseLeaves.find((a) => a.id === DAILY_LABOR_ACCOUNT_ID)?.id ||
      workLogQuickHeadings[0]?.id ||
      defaultSalaryAccount,
    [accounts, settings?.accountingDefaults, expenseLeaves, workLogQuickHeadings, defaultSalaryAccount]
  );

  const currentJalaliYear = useMemo(() => getJalaliParts(new Date())?.year || 1405, []);
  const [tab, setTab] = useState<'fixed' | 'daily'>('fixed');
  const [selectedYear, setSelectedYear] = useState<number>(currentJalaliYear);
  const [workHeadingFilter, setWorkHeadingFilter] = useState<string>('');

  // Contract Form Modal
  const [contractOpen, setContractOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<PayrollContract | null>(null);
  const [cContactId, setCContactId] = useState('');
  const [cAccountId, setCAccountId] = useState('');
  const [cYear, setCYear] = useState(currentJalaliYear);
  const [cMonthlyRaw, setCMonthlyRaw] = useState('');
  const [cStartMonth, setCStartMonth] = useState(1);
  const [cEndMonth, setCEndMonth] = useState(12);
  const [cNotes, setCNotes] = useState('');

  // Heading-based Work-Log Form Modal (آبگیری، کارگری روزمزد، و هر سرفصل هزینه دیگر)
  const [workOpen, setWorkOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<PayrollEntry | null>(null);
  const [wContactId, setWContactId] = useState('');
  const [wAccountId, setWAccountId] = useState('');
  const [wDate, setWDate] = useState(() => getLocalDateISOString(new Date()));
  const [wQuantity, setWQuantity] = useState('1');
  const [wUnitLabel, setWUnitLabel] = useState('شبانه‌روز');
  const [wRateRaw, setWRateRaw] = useState('');
  const [wDesc, setWDesc] = useState('');

  // Payroll / Advance Payment Modal
  const [payContactId, setPayContactId] = useState<string | null>(null);
  const [payAccountId, setPayAccountId] = useState('');
  const [payEntryId, setPayEntryId] = useState<string | undefined>(undefined);
  const [payAmountRaw, setPayAmountRaw] = useState('');
  const [payBankId, setPayBankId] = useState('');
  const [payDate, setPayDate] = useState(() => getLocalDateISOString(new Date()));
  const [payDesc, setPayDesc] = useState('');

  const contactName = (id: string) => contacts.find((c) => c.id === id)?.fullName || 'شخص';
  const groupName = (id: string) => contactGroups.find((g) => g.id === id)?.name || '';
  const headingLabelOf = (accountId: string, fallback = 'کارکرد پرسنل') =>
    getAccountById(accounts, accountId)?.name || fallback;

  const yearContracts = useMemo(
    () => contracts.filter((c) => c.jalaliYear === selectedYear),
    [contracts, selectedYear]
  );

  const dailyEntries = useMemo(
    () =>
      entries
        .filter((e) => e.entryType !== 'fixed_month')
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  const filteredDailyEntries = useMemo(
    () =>
      workHeadingFilter
        ? dailyEntries.filter((e) => e.accountId === workHeadingFilter)
        : dailyEntries,
    [dailyEntries, workHeadingFilter]
  );

  const usedWorkHeadingIds = useMemo(
    () => Array.from(new Set(dailyEntries.map((e) => e.accountId))),
    [dailyEntries]
  );

  // Person balance lookup (with accounts so ledger shows real heading names)
  const balanceOf = (cid: string) =>
    computePersonBalance(cid, invoices, entries, checks, transactions, { accounts });

  const totalAccrued = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries]);
  const totalPaid = useMemo(
    () =>
      transactions
        .filter((t) => t.linkKind === 'payroll_payment' && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const netOwed = totalAccrued - totalPaid;

  const openContractModal = (existing?: PayrollContract) => {
    setEditingContract(existing || null);
    const defaultPersonnelId =
      existing?.contactId ||
      personnelContacts.find((c) => c.personnelType === 'fixed' || c.personnelType === 'both')
        ?.id ||
      personnelContacts[0]?.id ||
      '';
    setCContactId(defaultPersonnelId);
    setCAccountId(existing?.accountId || defaultSalaryAccount);
    setCYear(existing?.jalaliYear || selectedYear);
    setCMonthlyRaw(existing ? String(existing.monthlyAmount) : '');
    setCStartMonth(existing?.startMonth ?? 1);
    setCEndMonth(existing?.endMonth ?? 12);
    setCNotes(existing?.notes || '');
    setContractOpen(true);
  };

  const saveContract = async () => {
    const monthly = parseIntegerAmount(cMonthlyRaw);
    if (!cContactId) {
      await dialog.alert({ title: 'پرسنل', message: 'شخص مورد نظر را انتخاب کنید.' });
      return;
    }
    if (!cAccountId) {
      await dialog.alert({ title: 'سرفصل', message: 'سرفصل هزینه حقوق را انتخاب کنید.' });
      return;
    }
    if (monthly <= 0) {
      await dialog.alert({ title: 'مبلغ حقوق', message: 'حقوق ماهانه را وارد کنید.' });
      return;
    }
    const payload: PayrollContract = {
      id: editingContract ? editingContract.id : `pc_${crypto.randomUUID().slice(0, 10)}`,
      contactId: cContactId,
      accountId: cAccountId,
      jalaliYear: cYear,
      monthlyAmount: monthly,
      startMonth: Math.min(cStartMonth, cEndMonth),
      endMonth: Math.max(cStartMonth, cEndMonth),
      notes: cNotes.trim() || undefined,
      isActive: true,
    };
    if (editingContract) {
      setContracts((prev) => prev.map((x) => (x.id === editingContract.id ? payload : x)));
    } else {
      setContracts((prev) => [payload, ...prev]);
    }
    setContractOpen(false);
  };

  const deleteContract = async (c: PayrollContract) => {
    const ok = await dialog.confirm({
      title: 'حذف قرارداد حقوق',
      message: `قرارداد سال ${toPersianDigits(String(c.jalaliYear))} برای «${contactName(c.contactId)}» حذف شود؟ کارکردهای ثبت‌شده قبلی باقی می‌مانند.`,
      tone: 'danger',
      confirmLabel: 'حذف قرارداد',
    });
    if (ok) setContracts((prev) => prev.filter((x) => x.id !== c.id));
  };

  const accrueFixedMonth = (contract: PayrollContract, month: number) => {
    const already = entries.find(
      (e) =>
        e.entryType === 'fixed_month' &&
        e.contractId === contract.id &&
        e.jalaliYear === contract.jalaliYear &&
        e.jalaliMonth === month
    );
    if (already) return;
    const gDate = jalaliToGregorianDate(contract.jalaliYear, month, 1);
    const iso = getLocalDayKey(gDate);
    const monthName = JALALI_MONTH_NAMES[month - 1] || '';
    const entry: PayrollEntry = {
      id: `pe_${crypto.randomUUID().slice(0, 10)}`,
      entryType: 'fixed_month',
      contactId: contract.contactId,
      contractId: contract.id,
      accountId: contract.accountId,
      date: iso,
      jalaliYear: contract.jalaliYear,
      jalaliMonth: month,
      quantity: 1,
      unitLabel: 'ماه',
      unitRate: contract.monthlyAmount,
      amount: contract.monthlyAmount,
      description: `حقوق ${monthName} ${toPersianDigits(String(contract.jalaliYear))} — ${contactName(contract.contactId)}`,
    };
    setEntries((prev) => [entry, ...prev]);
  };

  const applyHeadingChange = (nextAccountId: string) => {
    setWAccountId(nextAccountId);
    const acc = getAccountById(accounts, nextAccountId);
    if (acc) {
      setWUnitLabel(suggestUnitForHeadingName(acc.name));
    }
  };

  const applyWorkerChange = (nextContactId: string) => {
    setWContactId(nextContactId);
    const worker = contacts.find((c) => c.id === nextContactId);
    if (!worker) return;
    if (worker.defaultRate && worker.defaultRate > 0) {
      setWRateRaw(String(worker.defaultRate));
    }
    if (worker.defaultUnitLabel) {
      setWUnitLabel(worker.defaultUnitLabel);
    }
  };

  const openWorkModal = (existing?: PayrollEntry, presetAccountId?: string) => {
    setEditingWork(existing || null);
    const nextAccId = existing?.accountId || presetAccountId || defaultWorkAccount;
    const nextWorker = existing
      ? contacts.find((c) => c.id === existing.contactId)
      : personnelContacts[0];
    setWContactId(existing?.contactId || nextWorker?.id || '');
    setWAccountId(nextAccId);
    setWDate(existing?.date || getLocalDateISOString(new Date()));
    setWQuantity(existing ? String(existing.quantity) : '1');
    const suggestedUnit = suggestUnitForHeadingName(getAccountById(accounts, nextAccId)?.name);
    setWUnitLabel(existing?.unitLabel || nextWorker?.defaultUnitLabel || suggestedUnit);
    setWRateRaw(
      existing
        ? String(existing.unitRate)
        : nextWorker?.defaultRate
          ? String(nextWorker.defaultRate)
          : ''
    );
    setWDesc(existing?.description || '');
    setWorkOpen(true);
  };

  const computedWorkAmount = useMemo(() => {
    const q = Math.max(0, Number(wQuantity.replace(',', '.')) || 0);
    const r = parseIntegerAmount(wRateRaw);
    return Math.round(q * r);
  }, [wQuantity, wRateRaw]);

  const saveWorkEntry = async () => {
    const q = Number(wQuantity.replace(',', '.'));
    const rate = parseIntegerAmount(wRateRaw);
    const amt = Math.round(q * rate);
    if (!wContactId) {
      await dialog.alert({
        title: 'پرسنل',
        message: 'کارگر یا پرسنل مورد نظر را انتخاب کنید. اگر در لیست نیست، ابتدا او را در بخش «اشخاص» به عنوان پرسنل تعریف کنید.',
      });
      return;
    }
    if (!wAccountId) {
      await dialog.alert({ title: 'سرفصل هزینه', message: 'سرفصل هزینه کارکرد (مثلاً آبگیری یا کارگری روزمزد) را انتخاب کنید.' });
      return;
    }
    if (!Number.isFinite(q) || q <= 0 || amt <= 0) {
      await dialog.alert({ title: 'کارکرد نامعتبر', message: 'تعداد/مقدار و نرخ واحد باید بیشتر از صفر باشد.' });
      return;
    }
    const jp = getJalaliParts(wDate);
    const headingName = headingLabelOf(wAccountId);
    const finalUnit = wUnitLabel.trim() || suggestUnitForHeadingName(headingName);
    const payload: PayrollEntry = {
      id: editingWork ? editingWork.id : `pe_${crypto.randomUUID().slice(0, 10)}`,
      entryType: 'work_log',
      contactId: wContactId,
      accountId: wAccountId,
      date: wDate,
      jalaliYear: jp?.year,
      jalaliMonth: jp?.month,
      quantity: q,
      unitLabel: finalUnit,
      unitRate: rate,
      amount: amt,
      description:
        wDesc.trim() || `${headingName} (${toPersianDigits(String(q))} ${finalUnit})`,
    };
    if (editingWork) {
      setEntries((prev) => prev.map((x) => (x.id === editingWork.id ? payload : x)));
    } else {
      setEntries((prev) => [payload, ...prev]);
    }
    setWorkOpen(false);
  };

  const deleteEntry = async (entry: PayrollEntry) => {
    const ok = await dialog.confirm({
      title: 'حذف کارکرد / حقوق',
      message: `ثبت «${entry.description}» به مبلغ ${money(entry.amount)} تومان حذف شود؟`,
      tone: 'danger',
      confirmLabel: 'حذف',
    });
    if (ok) setEntries((prev) => prev.filter((x) => x.id !== entry.id));
  };

  const openPaymentModal = (
    cid: string,
    accId: string,
    suggestedAmount?: number,
    entryId?: string,
    defaultDesc?: string
  ) => {
    setPayContactId(cid);
    setPayAccountId(accId || defaultSalaryAccount);
    setPayEntryId(entryId);
    const bal = balanceOf(cid);
    const amt = suggestedAmount ?? (bal.payableAmount > 0 ? bal.payableAmount : 0);
    setPayAmountRaw(amt > 0 ? String(amt) : '');
    setPayBankId(
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'defaultBank') ||
        banks[0]?.id ||
        ''
    );
    setPayDate(getLocalDateISOString(new Date()));
    setPayDesc(defaultDesc || `پرداخت حقوق / کارکرد — ${contactName(cid)}`);
  };

  const savePayrollPayment = async () => {
    if (!payContactId) return;
    const amt = parseIntegerAmount(payAmountRaw);
    if (amt <= 0) {
      await dialog.alert({ title: 'مبلغ', message: 'مبلغ پرداخت را وارد کنید.' });
      return;
    }
    if (!payBankId) {
      await dialog.alert({ title: 'بانک', message: 'حساب بانکی یا صندوق مبدأ را انتخاب کنید.' });
      return;
    }
    onSaveTx({
      type: 'expense',
      date: payDate,
      amount: amt,
      accountId: payAccountId || defaultSalaryAccount,
      bankAccountId: payBankId,
      contactId: payContactId,
      description: payDesc.trim() || `پرداخت حقوق — ${contactName(payContactId)}`,
      linkKind: 'payroll_payment',
      payrollEntryId: payEntryId,
    });
    setPayContactId(null);
  };

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      entries.map((e) => ({
        'سرفصل هزینه': headingLabelOf(e.accountId),
        پرسنل: contactName(e.contactId),
        تاریخ: formatJalaliShort(e.date),
        مقدار: `${e.quantity} ${e.unitLabel}`,
        'نرخ واحد': e.unitRate,
        'جمع (تومان)': e.amount,
        شرح: e.description,
      })),
      'حقوق و کارکرد پرسنل',
      'payroll-entries'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    await downloadTableReportPdf({
      title: 'گزارش حقوق و کارکرد پرسنل',
      storeName,
      subtitle: `${toPersianDigits(String(entries.length))} فقره کارکرد ثبت‌شده`,
      pageSize,
      filename: `payroll-${pageSize}`,
      columns: [
        { header: 'پرسنل', width: 1.6, align: 'right' },
        { header: 'سرفصل هزینه', width: 1.4, align: 'right' },
        { header: 'تاریخ', width: 1.1, align: 'right' },
        { header: 'کارکرد', width: 1.1, align: 'right' },
        { header: 'مبلغ', width: 1.4, align: 'amount' },
      ],
      rows: entries.map((e) => [
        contactName(e.contactId),
        headingLabelOf(e.accountId),
        formatDateFa(e.date),
        `${toPersianDigits(String(e.quantity))} ${e.unitLabel}`,
        formatMoneyFa(e.amount),
      ]),
      summary: [
        { label: 'جمع حقوق و کارکرد', value: formatMoneyFa(totalAccrued) },
        { label: 'جمع پرداختی‌ها', value: formatMoneyFa(totalPaid) },
        { label: 'مانده خالص', value: formatMoneyFa(netOwed) },
      ],
    });
  };

  /** Options for contract/work-log select: strictly personnelContacts (+ fallback for legacy edit) */
  const selectablePersonnel = (currentId: string) => {
    if (!currentId || personnelContacts.some((c) => c.id === currentId)) return personnelContacts;
    const legacy = contacts.find((c) => c.id === currentId);
    return legacy ? [legacy, ...personnelContacts] : personnelContacts;
  };

  return (
    <div className="animate-page-enter space-y-5 md:space-y-6" data-testid="payroll-page">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
            حقوق و کارکرد پرسنل
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)] md:text-sm">
            قراردادهای حقوق ثابت سالانه (۱۲ ماه شمسی) و ثبت کارکرد پرسنل روی سرفصل‌های هزینه (آبگیری، روزمزد و سرفصل‌های دلخواه)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {entries.length > 0 ? (
            <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="journals.export" />
          ) : null}
          {onOpenPersons ? (
            <Button size="sm" variant="secondary" icon={UserPlus} onClick={onOpenPersons}>
              مدیریت پرسنل ({toPersianDigits(String(personnelContacts.length))})
            </Button>
          ) : null}
          {canCreate ? (
            tab === 'fixed' ? (
              <Button icon={Plus} data-testid="payroll-add-contract" onClick={() => openContractModal()}>
                قرارداد حقوق ثابت
              </Button>
            ) : (
              <Button icon={Plus} data-testid="payroll-add-work" onClick={() => openWorkModal()}>
                ثبت کارکرد پرسنل
              </Button>
            )
          ) : null}
        </div>
      </div>

      {/* Prerequisite Banner when no contacts are defined as personnel yet */}
      {personnelContacts.length === 0 ? (
        <div
          data-testid="payroll-no-personnel-banner"
          className="flex flex-col gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-extrabold text-[color:var(--ink)]">
                هنوز پرسنل یا کارگری در بخش «اشخاص» تعریف نشده است
              </p>
              <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
                بر اساس ساختار اصولی حسابداری، ابتدا پرسنل و کارگران را در بخش «اشخاص» تعریف کنید (گزینه «تعریف به عنوان پرسنل / کارگر» یا گروه «پرسنل و کارگران») تا اینجا قابل انتخاب شوند.
              </p>
            </div>
          </div>
          {onOpenPersons ? (
            <Button size="sm" icon={UserPlus} onClick={onOpenPersons} data-testid="payroll-go-persons">
              تعریف پرسنل در بخش اشخاص
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* KPI Strip */}
      <section className="grid gap-3.5 md:grid-cols-3 lg:gap-4">
        <div className="balance-gradient rounded-[1.5rem] p-5 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Briefcase size={18} />
            </span>
            <p className="text-sm font-bold text-white/90">جمع حقوق و کارکرد محاسبه‌شده</p>
          </div>
          <p className="mt-4 truncate text-[1.75rem] font-black tabular-nums">
            {money(totalAccrued)}
            <span className="ms-2 text-xs font-bold text-white/80">تومان</span>
          </p>
          <span className="mt-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold tabular-nums">
            {toPersianDigits(String(entries.length))} ردیف حقوق و کارکرد
          </span>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted)]">مجموع پرداختی و مساعده</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-[color:var(--brand)]">
                {money(totalPaid)}
                <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl tone-brand">
              <Wallet size={20} />
            </div>
          </div>
          <p className="mt-3 text-xs text-[color:var(--muted)]">پرداخت‌شده از حساب‌های بانکی و صندوق</p>
        </div>

        <div className="dash-card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted)]">
                {netOwed >= 0 ? 'جمع طلب پرسنل از ما' : 'جمع مساعده (طلب ما از پرسنل)'}
              </p>
              <p
                className={cn(
                  'mt-2 text-2xl font-black tabular-nums',
                  netOwed > 0 ? 'text-[color:var(--expense)]' : 'text-[color:var(--income)]'
                )}
              >
                {money(Math.abs(netOwed))}
                <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl tone-expense">
              <Users size={20} />
            </div>
          </div>
          <p className="mt-3 text-xs text-[color:var(--muted)]">همگام با دفتر حساب اشخاص</p>
        </div>
      </section>

      {/* Tabs + Year Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] p-1 shadow-xs">
          <button
            type="button"
            data-testid="payroll-tab-fixed"
            onClick={() => setTab('fixed')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition',
              tab === 'fixed'
                ? 'btn-brand-gradient text-white shadow-sm'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            <Calendar size={14} />
            پرسنل ثابت (۱۲ ماهه)
          </button>
          <button
            type="button"
            data-testid="payroll-tab-daily"
            onClick={() => setTab('daily')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition',
              tab === 'daily'
                ? 'btn-brand-gradient text-white shadow-sm'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            <FolderTree size={14} />
            کارکرد پرسنل (بر اساس سرفصل)
          </button>
        </div>

        {tab === 'fixed' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[color:var(--muted)]">سال مالی:</span>
            <select
              aria-label="سال شمسی قراردادها"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3 text-xs font-extrabold tabular-nums text-[color:var(--ink)] outline-none"
            >
              {[currentJalaliYear - 1, currentJalaliYear, currentJalaliYear + 1].map((y) => (
                <option key={y} value={y}>
                  {toPersianDigits(String(y))}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {/* Tab 1: Fixed Monthly / Annual Contracts */}
      {tab === 'fixed' ? (
        yearContracts.length === 0 ? (
          <EmptyState
            title={`قرارداد حقوق ثابتی برای سال ${toPersianDigits(String(selectedYear))} ثبت نشده است`}
            description="برای هر کارمند ثابت، حقوق ماهانه (مثلاً ۳۰ میلیون تومان — سالانه ۳۶۰ میلیون تومان) تعریف کنید تا وضعیت ۱۲ ماه فروردین تا اسفند ردیابی شود."
            action={
              canCreate ? (
                <Button icon={Plus} onClick={() => openContractModal()}>
                  تعریف قرارداد حقوق ثابت
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4" data-testid="payroll-contracts-list">
            {yearContracts.map((contract) => {
              const monthsCount = Math.max(1, contract.endMonth - contract.startMonth + 1);
              const annualTotal = contract.monthlyAmount * monthsCount;
              const bal = balanceOf(contract.contactId);
              const contractEntries = entries.filter(
                (e) => e.entryType === 'fixed_month' && e.contractId === contract.id
              );
              const accruedMonths = new Map<number, PayrollEntry>();
              for (const ce of contractEntries) {
                if (ce.jalaliMonth) accruedMonths.set(ce.jalaliMonth, ce);
              }

              return (
                <div key={contract.id} className="dash-card space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-[color:var(--ink)]">
                          {contactName(contract.contactId)}
                        </h3>
                        <span className="rounded-full tone-brand px-2.5 py-0.5 text-[11px] font-bold">
                          ماهانه {money(contract.monthlyAmount)} تومان
                        </span>
                        <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--muted)]">
                          سالانه ({toPersianDigits(String(monthsCount))} ماه): {money(annualTotal)} تومان
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                        سرفصل: {getAccountById(accounts, contract.accountId)?.name || 'حقوق'} ·{' '}
                        {bal.status === 'creditor' ? (
                          <span className="font-extrabold text-[color:var(--expense)]">
                            طلبکار از ما: {money(bal.payableAmount)} تومان
                          </span>
                        ) : bal.status === 'debtor' ? (
                          <span className="font-extrabold text-[color:var(--income)]">
                            بدهکار به ما (مساعده): {money(bal.receivableAmount)} تومان
                          </span>
                        ) : (
                          <span className="font-extrabold text-[color:var(--income)]">تسویه‌شده</span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {canCreate ? (
                        <Button
                          size="sm"
                          icon={Wallet}
                          data-testid={`payroll-pay-${contract.contactId}`}
                          onClick={() =>
                            openPaymentModal(contract.contactId, contract.accountId)
                          }
                        >
                          پرداخت حقوق / مساعده
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <IconButton
                          icon={Pencil}
                          label="ویرایش قرارداد"
                          size="sm"
                          onClick={() => openContractModal(contract)}
                        />
                      ) : null}
                      {canDelete ? (
                        <IconButton
                          icon={Trash2}
                          label="حذف قرارداد"
                          size="sm"
                          variant="soft-danger"
                          onClick={() => void deleteContract(contract)}
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* 12-Month Jalali Grid */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {JALALI_MONTH_NAMES.map((mName, idx) => {
                      const monthNum = idx + 1;
                      const inContract =
                        monthNum >= contract.startMonth && monthNum <= contract.endMonth;
                      const accrued = accruedMonths.get(monthNum);
                      if (!inContract) {
                        return (
                          <div
                            key={monthNum}
                            className="rounded-xl border border-dashed border-[color:var(--line)]/60 bg-[color:var(--surface-2)]/30 p-2.5 opacity-50"
                          >
                            <p className="text-xs font-bold text-[color:var(--muted)]">{mName}</p>
                            <p className="mt-1 text-[10px] text-[color:var(--muted)]">خارج از قرارداد</p>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={monthNum}
                          className={cn(
                            'rounded-xl border p-2.5 transition',
                            accrued
                              ? 'border-emerald-500/35 bg-emerald-500/5'
                              : 'border-[color:var(--line)] bg-[color:var(--surface-1)]'
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-extrabold text-[color:var(--ink)]">
                              {mName}
                            </span>
                            {accrued ? (
                              <CheckCircle2 size={14} className="text-emerald-600" />
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                            {money(accrued ? accrued.amount : contract.monthlyAmount)}
                          </p>
                          <div className="mt-2">
                            {accrued ? (
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  ثبت‌شده
                                </span>
                                {canDelete ? (
                                  <button
                                    type="button"
                                    onClick={() => void deleteEntry(accrued)}
                                    className="text-[10px] font-bold text-rose-500 hover:underline"
                                  >
                                    حذف
                                  </button>
                                ) : null}
                              </div>
                            ) : canCreate ? (
                              <button
                                type="button"
                                data-testid={`accrue-${contract.id}-${monthNum}`}
                                onClick={() => accrueFixedMonth(contract, monthNum)}
                                className="w-full rounded-lg bg-[color:var(--brand-soft)] py-1 text-[10.5px] font-extrabold text-[color:var(--brand)] transition hover:opacity-85"
                              >
                                ثبت کارکرد ماه
                              </button>
                            ) : (
                              <span className="text-[10px] text-[color:var(--muted)]">ثبت‌نشده</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Tab 2: Heading-based Work-Logs (آبگیری، کارگری روزمزد، و هر سرفصل هزینه دیگر) */
        <section className="space-y-3.5">
          {usedWorkHeadingIds.length > 0 ? (
            <div className="dash-card flex flex-wrap items-center gap-2 rounded-2xl p-4" data-testid="payroll-heading-filters">
              <button
                type="button"
                onClick={() => setWorkHeadingFilter('')}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-extrabold transition',
                  workHeadingFilter === ''
                    ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                    : 'border-[color:var(--line)] bg-[color:var(--surface-1)] text-[color:var(--muted)]'
                )}
              >
                همه سرفصل‌ها ({toPersianDigits(String(dailyEntries.length))})
              </button>
              {usedWorkHeadingIds.map((hid) => (
                <button
                  key={hid}
                  type="button"
                  onClick={() => setWorkHeadingFilter(hid)}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-xs font-extrabold transition',
                    workHeadingFilter === hid
                      ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                      : 'border-[color:var(--line)] bg-[color:var(--surface-1)] text-[color:var(--muted)]'
                  )}
                >
                  {headingLabelOf(hid)}
                </button>
              ))}
            </div>
          ) : null}

          {filteredDailyEntries.length === 0 ? (
            <EmptyState
              title="کارکردی برای پرسنل ثبت نشده است"
              description="کارکرد پرسنل (مانند سرفصل آبگیری، کارگری روزمزد، کارگری دسته‌جمعی یا هر سرفصل هزینه دلخواه) را با تعداد و نرخ واحد ثبت کنید."
              action={
                canCreate ? (
                  personnelContacts.length === 0 && onOpenPersons ? (
                    <Button icon={UserPlus} onClick={onOpenPersons}>
                      ابتدا تعریف پرسنل در اشخاص
                    </Button>
                  ) : (
                    <Button icon={Plus} onClick={() => openWorkModal()}>
                      ثبت اولین کارکرد
                    </Button>
                  )
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-2.5" data-testid="payroll-daily-list">
              {filteredDailyEntries.map((entry) => {
                const headingAcc = getAccountById(accounts, entry.accountId);
                const headingTitle = headingAcc?.name || 'کارکرد پرسنل';
                const bal = balanceOf(entry.contactId);
                return (
                  <div
                    key={entry.id}
                    className="dash-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full tone-brand px-2.5 py-0.5 text-[11px] font-bold">
                          <FolderTree size={11} aria-hidden />
                          {headingTitle}
                          {headingAcc?.code ? (
                            <span className="opacity-75">({toPersianDigits(headingAcc.code)})</span>
                          ) : null}
                        </span>
                        <span className="text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                          {formatJalaliShort(entry.date)}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-[color:var(--ink)]">
                        {contactName(entry.contactId)}{' '}
                        <span className="text-xs font-bold text-[color:var(--muted)]">
                          ({toPersianDigits(String(entry.quantity))} {entry.unitLabel} × {money(entry.unitRate)} تومان)
                        </span>
                      </h3>
                      <p className="text-xs text-[color:var(--muted)]">
                        {entry.description} · مانده فعلی شخص:{' '}
                        {bal.status === 'creditor'
                          ? `${money(bal.payableAmount)} طلبکار`
                          : bal.status === 'debtor'
                            ? `${money(bal.receivableAmount)} بدهکار (مساعده)`
                            : 'تسویه‌شده'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2.5 sm:justify-end">
                      <p className="text-base font-black tabular-nums text-[color:var(--ink)]">
                        {money(entry.amount)}
                        <span className="ms-1 text-[10px] font-semibold text-[color:var(--muted)]">تومان</span>
                      </p>
                      <div className="flex items-center gap-1">
                        {canCreate ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={Wallet}
                            onClick={() =>
                              openPaymentModal(
                                entry.contactId,
                                entry.accountId,
                                entry.amount,
                                entry.id,
                                `پرداخت بابت ${headingTitle} — ${contactName(entry.contactId)}`
                              )
                            }
                          >
                            پرداخت
                          </Button>
                        ) : null}
                        {canEdit ? (
                          <IconButton
                            icon={Pencil}
                            label="ویرایش کارکرد"
                            size="sm"
                            onClick={() => openWorkModal(entry)}
                          />
                        ) : null}
                        {canDelete ? (
                          <IconButton
                            icon={Trash2}
                            label="حذف کارکرد"
                            size="sm"
                            variant="soft-danger"
                            onClick={() => void deleteEntry(entry)}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Fixed Salary Contract Modal */}
      <FormSheet
        isOpen={contractOpen}
        onClose={() => setContractOpen(false)}
        accent="brand"
        size="lg"
        dock
        headerChip={<StoreMark name={storeName} logo={settings?.logo || undefined} size="md" />}
        title={editingContract ? 'ویرایش قرارداد حقوق ثابت' : 'قرارداد حقوق ثابت سالانه'}
        subtitle="حقوق ماهانه را وارد کنید تا جدول ۱۲ ماهه فروردین تا اسفند ساخته شود"
        footer={
          <FormActions
            onCancel={() => setContractOpen(false)}
            onSubmit={() => void saveContract()}
            submitLabel={editingContract ? 'ذخیره تغییرات' : 'ثبت قرارداد'}
            submitIcon={editingContract ? Check : Plus}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          <AmountInput
            label="حقوق ماهانه (تومان)"
            value={cMonthlyRaw}
            onChange={setCMonthlyRaw}
            accent="brand"
            compact
          />
          {parseIntegerAmount(cMonthlyRaw) > 0 ? (
            <div className="rounded-xl border border-[color:var(--brand)]/20 bg-[color:var(--brand-soft)] px-4 py-2.5 text-xs font-extrabold tabular-nums text-[color:var(--brand)]">
              جمع حقوق قرارداد ({toPersianDigits(String(Math.max(1, Math.max(cStartMonth, cEndMonth) - Math.min(cStartMonth, cEndMonth) + 1)))} ماه):{' '}
              {money(
                parseIntegerAmount(cMonthlyRaw) *
                  Math.max(1, Math.max(cStartMonth, cEndMonth) - Math.min(cStartMonth, cEndMonth) + 1)
              )}{' '}
              تومان
            </div>
          ) : null}

          <div className="form-section grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
            <div>
              <div className="mb-1.5 flex min-h-[1.15rem] items-center justify-between gap-2">
                <label className="text-xs font-bold leading-[1.15rem] text-[color:var(--muted)]">
                  پرسنل / کارمند
                </label>
                {onOpenPersons ? (
                  <button
                    type="button"
                    onClick={() => {
                      setContractOpen(false);
                      onOpenPersons();
                    }}
                    className="text-[11px] font-bold leading-none text-[color:var(--brand)] hover:underline"
                  >
                    + تعریف پرسنل جدید
                  </button>
                ) : null}
              </div>
              <select
                data-testid="contract-personnel-select"
                className={fieldInput}
                value={cContactId}
                onChange={(e) => setCContactId(e.target.value)}
              >
                <option value="">
                  {personnelContacts.length === 0
                    ? 'ابتدا پرسنل را در بخش اشخاص تعریف کنید'
                    : 'انتخاب پرسنل...'}
                </option>
                {selectablePersonnel(cContactId).map((c) => {
                  const g = groupName(c.groupId);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                      {g ? ` (${g})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={cAccountId}
                onChange={setCAccountId}
                label="سرفصل هزینه حقوق"
              />
            </div>

            <div className="sm:col-span-2">
              <CollapsibleOptionalSection
                mobileOnly
                title="بازه ماه‌های قرارداد و یادداشت (اختیاری)"
                subtitle={`${JALALI_MONTH_NAMES[Math.max(0, cStartMonth - 1)] || 'فروردین'} تا ${JALALI_MONTH_NAMES[Math.max(0, cEndMonth - 1)] || 'اسفند'}`}
                filledCount={countFilledFields([
                  cStartMonth !== 1 ? String(cStartMonth) : '',
                  cEndMonth !== 12 ? String(cEndMonth) : '',
                  cNotes,
                ])}
                testId="contract-optional-section"
              >
                <div className="grid grid-cols-2 items-start gap-3 sm:gap-4">
                  <div>
                    <label className={fieldLabel}>از ماه</label>
                    <select
                      className={fieldInput}
                      value={cStartMonth}
                      onChange={(e) => setCStartMonth(Number(e.target.value))}
                    >
                      {JALALI_MONTH_NAMES.map((m, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabel}>تا ماه</label>
                    <select
                      className={fieldInput}
                      value={cEndMonth}
                      onChange={(e) => setCEndMonth(Number(e.target.value))}
                    >
                      {JALALI_MONTH_NAMES.map((m, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={fieldLabel}>یادداشت (اختیاری)</label>
                    <input
                      className={fieldInput}
                      value={cNotes}
                      onChange={(e) => setCNotes(e.target.value)}
                      placeholder="مثلاً قرارداد سال ۱۴۰۵ با بیمه و عیدی"
                    />
                  </div>
                </div>
              </CollapsibleOptionalSection>
            </div>
          </div>
        </div>
      </FormSheet>

      {/* Heading-Based Work-Log Modal */}
      <FormSheet
        isOpen={workOpen}
        onClose={() => setWorkOpen(false)}
        accent="brand"
        size="lg"
        dock
        headerChip={<StoreMark name={storeName} logo={settings?.logo || undefined} size="md" />}
        title={editingWork ? 'ویرایش کارکرد پرسنل' : 'ثبت کارکرد پرسنل (بر اساس سرفصل)'}
        subtitle="پرسنل و سرفصل هزینه (مانند آبگیری یا کارگری روزمزد) را انتخاب و مقدار کارکرد را وارد کنید"
        footer={
          <FormActions
            onCancel={() => setWorkOpen(false)}
            onSubmit={() => void saveWorkEntry()}
            submitLabel={editingWork ? 'ذخیره تغییرات' : 'ثبت کارکرد'}
            submitIcon={editingWork ? Check : Plus}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          {workLogQuickHeadings.length > 0 ? (
            <div className="space-y-2" data-testid="work-heading-quick-chips">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-[color:var(--muted)]">
                  انتخاب سریع سرفصل کارکرد:
                </span>
                {onOpenChartOfAccounts ? (
                  <button
                    type="button"
                    onClick={() => {
                      setWorkOpen(false);
                      onOpenChartOfAccounts();
                    }}
                    className="text-[11px] font-bold text-[color:var(--brand)] hover:underline"
                  >
                    + سرفصل جدید
                  </button>
                ) : null}
              </div>
              <div className="no-scrollbar flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                {workLogQuickHeadings.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    data-testid={`work-heading-chip-${acc.id}`}
                    onClick={() => applyHeadingChange(acc.id)}
                    className={cn(
                      'inline-flex min-h-[2.5rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-extrabold transition',
                      wAccountId === acc.id
                        ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                        : 'border-[color:var(--line)] bg-[color:var(--surface-solid)] text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                    )}
                  >
                    <span>{acc.name}</span>
                    <span className="text-[10px] opacity-70 tabular-nums">
                      ({toPersianDigits(acc.code)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="form-section grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
            <div>
              <div className="mb-1.5 flex min-h-[1.15rem] items-center justify-between gap-2">
                <label className="text-xs font-bold leading-[1.15rem] text-[color:var(--muted)]">
                  پرسنل / کارگر
                </label>
                {onOpenPersons ? (
                  <button
                    type="button"
                    onClick={() => {
                      setWorkOpen(false);
                      onOpenPersons();
                    }}
                    className="text-[11px] font-bold leading-none text-[color:var(--brand)] hover:underline"
                  >
                    + تعریف پرسنل جدید
                  </button>
                ) : null}
              </div>
              <select
                data-testid="work-personnel-select"
                className={fieldInput}
                value={wContactId}
                onChange={(e) => applyWorkerChange(e.target.value)}
              >
                <option value="">
                  {personnelContacts.length === 0
                    ? 'ابتدا پرسنل را در بخش اشخاص تعریف کنید'
                    : 'انتخاب پرسنل...'}
                </option>
                {selectablePersonnel(wContactId).map((c) => {
                  const g = groupName(c.groupId);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                      {g ? ` (${g})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={wAccountId}
                onChange={applyHeadingChange}
                label="سرفصل هزینه کارکرد"
              />
            </div>
            <div>
              <label className={fieldLabel}>تاریخ کارکرد</label>
              <PersianDatePicker value={wDate} onChange={setWDate} />
            </div>
            <div className="grid grid-cols-2 items-start gap-2.5">
              <div>
                <label className={fieldLabel}>تعداد</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  className={cn(fieldInput, 'tabular-nums')}
                  value={wQuantity}
                  onChange={(e) => setWQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className={fieldLabel}>واحد</label>
                <input
                  className={fieldInput}
                  value={wUnitLabel}
                  onChange={(e) => setWUnitLabel(e.target.value)}
                  placeholder="شبانه‌روز / روز"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <AmountInput
                label={`نرخ هر ${wUnitLabel || 'واحد'} (تومان)`}
                value={wRateRaw}
                onChange={setWRateRaw}
                accent="expense"
                compact
              />
            </div>
            {computedWorkAmount > 0 ? (
              <div className="sm:col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                مبلغ کل قابل پرداخت ({headingLabelOf(wAccountId)}): {money(computedWorkAmount)} تومان
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <CollapsibleOptionalSection
                mobileOnly
                title="شرح کارکرد (اختیاری)"
                subtitle="توضیح محل انجام کار یا جزئیات بیشتر"
                filledCount={countFilledFields([wDesc])}
                testId="work-optional-section"
              >
                <div>
                  <label className={fieldLabel}>شرح کارکرد</label>
                  <input
                    className={fieldInput}
                    value={wDesc}
                    onChange={(e) => setWDesc(e.target.value)}
                    placeholder="مثلاً یک شبانه‌روز آبگیری قطعه شمالی باغ پسته"
                  />
                </div>
              </CollapsibleOptionalSection>
            </div>
          </div>
        </div>
      </FormSheet>

      {/* Payroll / Advance Payment Modal */}
      <FormSheet
        isOpen={Boolean(payContactId)}
        onClose={() => setPayContactId(null)}
        accent="expense"
        size="md"
        dock
        headerChip={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm">
            <Wallet size={19} />
          </span>
        }
        title="ثبت پرداخت حقوق / مساعده"
        subtitle={payContactId ? `پرداخت به ${contactName(payContactId)}` : undefined}
        footer={
          <FormActions
            onCancel={() => setPayContactId(null)}
            onSubmit={() => void savePayrollPayment()}
            submitLabel="ثبت پرداخت"
            submitIcon={Check}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          <AmountInput
            label="مبلغ پرداخت (تومان)"
            value={payAmountRaw}
            onChange={setPayAmountRaw}
            accent="expense"
            compact
          />
          <div className="form-section grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
            <div>
              <label className={fieldLabel}>پرداخت از حساب</label>
              <select
                className={fieldInput}
                value={payBankId}
                onChange={(e) => setPayBankId(e.target.value)}
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>تاریخ پرداخت</label>
              <PersianDatePicker value={payDate} onChange={setPayDate} />
            </div>
            <div className="sm:col-span-2">
              <CollapsibleOptionalSection
                mobileOnly
                title="شرح پرداخت (اختیاری)"
                subtitle="توضیح تسویه یا بابت مساعده"
                filledCount={countFilledFields([payDesc])}
                testId="payroll-pay-optional-section"
              >
                <div>
                  <label className={fieldLabel}>شرح پرداخت</label>
                  <input
                    className={fieldInput}
                    value={payDesc}
                    onChange={(e) => setPayDesc(e.target.value)}
                  />
                </div>
              </CollapsibleOptionalSection>
            </div>
          </div>
        </div>
      </FormSheet>
    </div>
  );
};

export default PayrollPage;
