import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  Coins,
  FileCheck2,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
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
  PayrollEntry,
  PersonnelType,
  Transaction,
} from '../types';
import { APP_NAME } from '../constants';
import { uploadImagePath } from '../utils/attachments';
import {
  sortGroups,
  contactsInGroup,
  contactIncomeTotal,
  contactExpenseTotal,
  contactTransactions,
  isPersonnelContact,
  isPersonnelGroup,
} from '../utils/contactStats';
import { computeInvoiceSettlement, computePersonBalance, type PersonBalanceSummary } from '../utils/accrualEngine';
import { getBankAccounts } from '../utils/accountTree';
import { resolveDefaultAccountId } from '../utils/accountingTemplates';
import { formatJalaliShort } from '../utils/jalaliPeriod';
import {
  formatNumberWithCommas,
  getLocalDateISOString,
  parseIntegerAmount,
  toPersianDigits,
} from '../utils/formatters';
import PersianDatePicker from './PersianDatePicker';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { useCan } from '../hooks/useSessionAuth';
import AttachmentLightbox from './ui/AttachmentLightbox';
import {
  AmountInput,
  WorkspaceHeader,
  Button,
  CollapsibleOptionalSection,
  FormSheet,
  StoreMark,
  fieldInput,
  fieldLabel,
  FormActions,
  EmptyState,
  IconButton,
  cn,
} from './ui';
import { countFilledFields } from '../utils/formLayout';
import { ExportActions } from './export/ExportActions';
import { useDialog } from './DialogProvider';

interface PersonsPageProps {
  accounts?: Account[];
  groups: ContactGroup[];
  setGroups: (v: ContactGroup[] | ((p: ContactGroup[]) => ContactGroup[])) => void;
  contacts: Contact[];
  setContacts: (v: Contact[] | ((p: Contact[]) => Contact[])) => void;
  transactions: Transaction[];
  invoices?: Invoice[];
  payrollEntries?: PayrollEntry[];
  checks?: CheckItem[];
  onSaveTx?: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  onSaveCheck?: (ch: Omit<CheckItem, 'id'> | CheckItem) => void;
  initialContactId?: string;
  initialTab?: 'groups' | 'people';
  onInitialConsumed?: () => void;
  settings?: AppSettings;
}

const PERSONNEL_TYPE_LABELS: Record<PersonnelType, string> = {
  fixed: 'حقوق ثابت ماهانه',
  daily: 'روزمزد / کارکردی',
  both: 'ثابت و کارکردی',
};

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));
const FA_JALALI_DATE = new Intl.DateTimeFormat('fa-IR-u-ca-persian');

const ContactAvatar: React.FC<{
  name: string;
  picture?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ name, picture, size = 'sm' }) => {
  const dim =
    size === 'xl'
      ? 'h-28 w-28 text-3xl'
      : size === 'lg'
        ? 'h-20 w-20 text-2xl'
        : size === 'md'
          ? 'h-12 w-12 text-sm'
          : 'h-10 w-10 text-sm';
  const initial = name.trim().charAt(0) || '؟';
  if (picture) {
    return (
      <img
        src={picture}
        alt=""
        className={cn(
          dim,
          'shrink-0 rounded-full object-cover ring-2 ring-white/80 shadow-[var(--shadow-sm)] dark:ring-slate-700'
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        dim,
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-blue-200 font-black text-blue-700 ring-2 ring-white/80 dark:from-blue-900/50 dark:to-sky-900/40 dark:text-sky-200 dark:ring-slate-700'
      )}
    >
      {initial}
    </div>
  );
};

function PersonSearch({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testId: string;
}) {
  return (
    <span className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3 shadow-[var(--shadow-sm)] transition focus-within:border-[color:var(--brand)] focus-within:ring-4 focus-within:ring-[color:var(--brand)]/10">
      <Search size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
      <input
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
      />
    </span>
  );
}

function GroupFilter({
  value,
  onChange,
  groups,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: ContactGroup[];
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <select
        data-testid="person-group-filter"
        aria-label="فیلتر گروه"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 max-w-[11.5rem] appearance-none truncate rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] pe-8 ps-3 text-xs font-bold text-[color:var(--ink)] shadow-[var(--shadow-sm)] outline-none transition focus-visible:border-[color:var(--brand)]"
      >
        <option value="">همه گروه‌ها</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
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

const PersonsPage: React.FC<PersonsPageProps> = ({
  accounts = [],
  groups,
  setGroups,
  contacts,
  setContacts,
  transactions,
  invoices = [],
  payrollEntries = [],
  checks = [],
  onSaveTx,
  onSaveCheck,
  initialContactId,
  initialTab,
  onInitialConsumed,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canCreate = can('contacts.create');
  const canEdit = can('contacts.edit');
  const canDelete = can('contacts.delete');
  const storeName = settings?.name || APP_NAME;
  const [tab, setTab] = useState<'groups' | 'people'>(initialTab ?? 'people');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initialContactId ?? null
  );
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'personnel' | 'other'>('all');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [lightboxAtt, setLightboxAtt] = useState<Attachment | null>(null);

  useEffect(() => {
    if (!initialContactId && !initialTab) return;
    if (initialContactId) {
      setSelectedContactId(initialContactId);
      setTab('people');
    } else if (initialTab) {
      setTab(initialTab);
    }
    onInitialConsumed?.();
  }, [initialContactId, initialTab, onInitialConsumed]);

  const [groupOpen, setGroupOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ContactGroup | null>(null);
  const [groupName, setGroupName] = useState('');

  const [personOpen, setPersonOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Contact | null>(null);
  const [personName, setPersonName] = useState('');
  const [personGroupId, setPersonGroupId] = useState('');
  const [personMobile, setPersonMobile] = useState('');
  const [personNotes, setPersonNotes] = useState('');
  const [personPicture, setPersonPicture] = useState('');
  const [personIsPersonnel, setPersonIsPersonnel] = useState(false);
  const [personPersonnelType, setPersonPersonnelType] = useState<PersonnelType>('daily');
  const [personDefaultRateRaw, setPersonDefaultRateRaw] = useState('');
  const [personDefaultUnit, setPersonDefaultUnit] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Person Statement Direct Settlement / Check Modal State
  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const [stmtSettleOpen, setStmtSettleOpen] = useState(false);
  const [stmtFlow, setStmtFlow] = useState<'receipt' | 'payment'>('receipt');
  const [stmtMethod, setStmtMethod] = useState<'cash' | 'check'>('cash');
  const [stmtInvoiceId, setStmtInvoiceId] = useState<string>('');
  const [stmtAmountRaw, setStmtAmountRaw] = useState<string>('');
  const [stmtBankId, setStmtBankId] = useState<string>('');
  const [stmtDate, setStmtDate] = useState<string>(() => getLocalDateISOString(new Date()));
  const [stmtDueDate, setStmtDueDate] = useState<string>(() => getLocalDateISOString(new Date()));
  const [stmtCheckNumber, setStmtCheckNumber] = useState<string>('');
  const [stmtCheckSayad, setStmtCheckSayad] = useState<string>('');
  const [stmtCheckBankName, setStmtCheckBankName] = useState<string>('');
  const [stmtNote, setStmtNote] = useState<string>('');

  const openPersonSettlementModal = (opts: {
    flow: 'receipt' | 'payment';
    method?: 'cash' | 'check';
    invoice?: Invoice;
    defaultAmount?: number;
  }) => {
    const defBank =
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'defaultBank') ||
      banks[0]?.id ||
      '';
    setStmtFlow(opts.flow);
    setStmtMethod(opts.method || 'cash');
    setStmtInvoiceId(opts.invoice?.id || '');
    setStmtAmountRaw(opts.defaultAmount && opts.defaultAmount > 0 ? String(opts.defaultAmount) : '');
    setStmtBankId(defBank);
    const today = getLocalDateISOString(new Date());
    setStmtDate(today);
    setStmtDueDate(today);
    setStmtCheckNumber('');
    setStmtCheckSayad('');
    setStmtCheckBankName('');
    setStmtNote('');
    setStmtSettleOpen(true);
  };

  const handleSavePersonStatementSettlement = async () => {
    if (!selectedContactId) return;
    const person = contacts.find((c) => c.id === selectedContactId);
    const amt = parseIntegerAmount(stmtAmountRaw);
    if (amt <= 0) {
      await dialog.alert({ title: 'مبلغ', message: 'مبلغ معتبر وارد کنید.' });
      return;
    }

    const linkedInv = stmtInvoiceId ? invoices.find((i) => i.id === stmtInvoiceId) : undefined;

    if (stmtMethod === 'check') {
      if (!onSaveCheck) return;
      if (!stmtCheckNumber.trim()) {
        await dialog.alert({ title: 'شماره چک', message: 'شماره چک را وارد کنید.' });
        return;
      }
      const bankObj = banks.find((b) => b.id === stmtBankId);
      const defaultDesc = linkedInv
        ? `چک ${stmtFlow === 'receipt' ? 'دریافتی' : 'پرداختی'} بابت فاکتور #${linkedInv.invoiceNumber}`
        : `چک ${stmtFlow === 'receipt' ? 'دریافتی' : 'پرداختی'} در صورتحساب (${person?.fullName || ''})`;

      onSaveCheck({
        kind: stmtFlow === 'receipt' ? 'receivable' : 'payable',
        checkNumber: stmtCheckNumber.trim(),
        sayadId: stmtCheckSayad.trim() || undefined,
        amount: amt,
        issueDate: stmtDate,
        dueDate: stmtDueDate || stmtDate,
        bankAccountId: stmtBankId || banks[0]?.id || '',
        contactId: selectedContactId,
        invoiceId: linkedInv?.id,
        status: 'pending',
        description:
          [stmtCheckBankName.trim(), stmtNote.trim() || defaultDesc].filter(Boolean).join(' — '),
      });
      setStmtSettleOpen(false);
      return;
    }

    if (!onSaveTx) return;
    if (!stmtBankId) {
      await dialog.alert({ title: 'حساب بانکی', message: 'حساب بانکی یا صندوق را انتخاب کنید.' });
      return;
    }

    const txType = stmtFlow === 'receipt' ? 'income' : 'expense';
    const fallbackAccId =
      linkedInv?.accountId ||
      resolveDefaultAccountId(
        accounts,
        settings?.accountingDefaults,
        txType === 'income' ? 'incomeTxn' : 'expenseTxn'
      ) ||
      accounts.find((a) => a.kind === 'postable' && a.module === txType && a.isActive !== false)?.id ||
      '';

    const defaultDesc = linkedInv
      ? `${stmtFlow === 'receipt' ? 'دریافت' : 'پرداخت'} وجه بابت فاکتور #${linkedInv.invoiceNumber}`
      : `${stmtFlow === 'receipt' ? 'دریافت' : 'پرداخت'} وجه (علی‌الحساب در صورتحساب ${person?.fullName || ''})`;

    onSaveTx({
      type: txType,
      amount: amt,
      date: stmtDate,
      accountId: fallbackAccId,
      bankAccountId: stmtBankId,
      contactId: selectedContactId,
      linkKind: 'invoice_settlement',
      invoiceId: linkedInv?.id,
      description: stmtNote.trim() || defaultDesc,
    });
    setStmtSettleOpen(false);
  };

  const sortedGroups = useMemo(() => sortGroups(groups), [groups]);
  const sortedPeople = useMemo(
    () => [...contacts].sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa')),
    [contacts]
  );

  const personnelCount = useMemo(
    () => contacts.filter((c) => isPersonnelContact(c, groups)).length,
    [contacts, groups]
  );

  const totalsByContact = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const c of contacts) {
      map.set(c.id, {
        income: contactIncomeTotal(c.id, transactions),
        expense: contactExpenseTotal(c.id, transactions),
      });
    }
    return map;
  }, [contacts, transactions]);

  const balanceByContact = useMemo(() => {
    const map = new Map<string, PersonBalanceSummary>();
    for (const c of contacts) {
      map.set(
        c.id,
        computePersonBalance(c.id, invoices, payrollEntries, checks, transactions, { accounts })
      );
    }
    return map;
  }, [contacts, invoices, payrollEntries, checks, transactions, accounts]);

  const q = query.trim();
  const filteredPeople = useMemo(
    () =>
      sortedPeople.filter((c) => {
        if (groupFilter && c.groupId !== groupFilter) return false;
        const isP = isPersonnelContact(c, groups);
        if (roleFilter === 'personnel' && !isP) return false;
        if (roleFilter === 'other' && isP) return false;
        if (!q) return true;
        const hay = `${c.fullName} ${c.mobile || ''} ${c.notes || ''}`;
        return hay.includes(q);
      }),
    [sortedPeople, groupFilter, roleFilter, groups, q]
  );
  const filteredGroups = useMemo(
    () => (q ? sortedGroups.filter((g) => g.name.includes(q)) : sortedGroups),
    [sortedGroups, q]
  );

  const handleExcel = async () => {
    if (tab === 'groups') {
      await downloadRowsAsExcel(
        sortedGroups.map((g) => ({
          گروه: g.name,
          تعداد: contactsInGroup(contacts, g.id).length,
        })),
        'گروه‌ها',
        'contact-groups'
      );
      return;
    }
    await downloadRowsAsExcel(
      sortedPeople.map((c) => {
        const g = groups.find((x) => x.id === c.groupId);
        const t = totalsByContact.get(c.id) || { income: 0, expense: 0 };
        return {
          نام: c.fullName,
          گروه: g?.name || '',
          موبایل: c.mobile || '',
          درآمد: t.income,
          هزینه: t.expense,
          خالص: t.income - t.expense,
        };
      }),
      'اشخاص',
      'contacts-list'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    const compact = pageSize === 'a5';
    if (tab === 'groups') {
      const rows = sortedGroups.map((g) => [
        g.name,
        toPersianDigits(String(contactsInGroup(contacts, g.id).length)),
      ]);
      await downloadTableReportPdf({
        title: 'گزارش گروه‌های اشخاص',
        storeName,
        pageSize,
        filename: `contact-groups-${pageSize}`,
        columns: [
          { header: 'گروه', width: 3, align: 'right' },
          { header: 'تعداد نفر', width: 1.2, align: 'amount' },
        ],
        rows,
        summary: [{ label: 'تعداد گروه', value: toPersianDigits(String(sortedGroups.length)) }],
      });
      return;
    }
    let sumIncome = 0;
    let sumExpense = 0;
    const rows = sortedPeople.map((c) => {
      const g = groups.find((x) => x.id === c.groupId);
      const t = totalsByContact.get(c.id) || { income: 0, expense: 0 };
      sumIncome += t.income;
      sumExpense += t.expense;
      if (compact) {
        return [c.fullName, g?.name || '—', formatMoneyFa(t.income - t.expense)];
      }
      return [
        c.fullName,
        g?.name || '—',
        c.mobile || '—',
        formatMoneyFa(t.income),
        formatMoneyFa(t.expense),
        formatMoneyFa(t.income - t.expense),
      ];
    });
    await downloadTableReportPdf({
      title: 'گزارش اشخاص',
      storeName,
      subtitle: `${toPersianDigits(String(sortedPeople.length))} نفر`,
      pageSize,
      filename: `contacts-${pageSize}`,
      columns: compact
        ? [
            { header: 'نام', width: 2.2, align: 'right' },
            { header: 'گروه', width: 1.4, align: 'right' },
            { header: 'خالص', width: 1.4, align: 'amount' },
          ]
        : [
            { header: 'نام', width: 2.2, align: 'right' },
            { header: 'گروه', width: 1.4, align: 'right' },
            { header: 'موبایل', width: 1.3, align: 'left' },
            { header: 'درآمد', width: 1.2, align: 'amount' },
            { header: 'هزینه', width: 1.2, align: 'amount' },
            { header: 'خالص', width: 1.2, align: 'amount' },
          ],
      rows,
      summary: [
        { label: 'تعداد', value: toPersianDigits(String(sortedPeople.length)) },
        { label: 'جمع درآمد', value: formatMoneyFa(sumIncome) },
        { label: 'جمع هزینه', value: formatMoneyFa(sumExpense) },
      ],
    });
  };

  const selectedTxs = useMemo(
    () => (selectedContactId ? contactTransactions(selectedContactId, transactions) : []),
    [selectedContactId, transactions]
  );

  const openGroup = (g?: ContactGroup) => {
    setEditGroup(g || null);
    setGroupName(g?.name || '');
    setGroupOpen(true);
  };

  const saveGroup = async () => {
    if (!groupName.trim()) {
      await dialog.alert({ title: 'نام', message: 'نام گروه را وارد کنید.' });
      return;
    }
    if (editGroup) {
      setGroups((prev) =>
        prev.map((g) => (g.id === editGroup.id ? { ...g, name: groupName.trim() } : g))
      );
    } else {
      setGroups((prev) => [
        ...prev,
        {
          id: `grp_${crypto.randomUUID().slice(0, 8)}`,
          name: groupName.trim(),
          sortOrder: prev.length + 1,
        },
      ]);
    }
    setGroupOpen(false);
  };

  const removeGroup = async (g: ContactGroup) => {
    if (contacts.some((c) => c.groupId === g.id)) {
      await dialog.alert({ title: 'حذف', message: 'ابتدا افراد این گروه را حذف یا جابه‌جا کنید.' });
      return;
    }
    const ok = await dialog.confirm({
      title: 'حذف گروه',
      message: `«${g.name}» حذف شود؟`,
      tone: 'danger',
      confirmLabel: 'حذف',
    });
    if (ok) setGroups((prev) => prev.filter((x) => x.id !== g.id));
  };

  const openPerson = (c?: Contact, presetPersonnel = false) => {
    setEditPerson(c || null);
    setPersonName(c?.fullName || '');
    const defaultPersonnelGrp = sortedGroups.find((g) => isPersonnelGroup(g));
    const nextGroupId =
      c?.groupId || (presetPersonnel && defaultPersonnelGrp ? defaultPersonnelGrp.id : sortedGroups[0]?.id || '');
    setPersonGroupId(nextGroupId);
    setPersonMobile(c?.mobile || '');
    setPersonNotes(c?.notes || '');
    setPersonPicture(c?.picture || '');
    const inferredPersonnel = c
      ? isPersonnelContact(c, groups)
      : presetPersonnel || isPersonnelGroup(sortedGroups.find((g) => g.id === nextGroupId));
    setPersonIsPersonnel(inferredPersonnel);
    setPersonPersonnelType(c?.personnelType || 'daily');
    setPersonDefaultRateRaw(c?.defaultRate ? String(c.defaultRate) : '');
    setPersonDefaultUnit(c?.defaultUnitLabel || '');
    setPersonOpen(true);
  };

  const savePerson = async () => {
    if (!personName.trim()) {
      await dialog.alert({ title: 'نام', message: 'نام شخص را وارد کنید.' });
      return;
    }
    if (!personGroupId) {
      await dialog.alert({ title: 'گروه', message: 'ابتدا یک گروه بسازید.' });
      return;
    }
    const parsedRate = parseIntegerAmount(personDefaultRateRaw);
    const personnelPayload = personIsPersonnel
      ? {
          isPersonnel: true as const,
          personnelType: personPersonnelType,
          defaultRate: parsedRate > 0 ? parsedRate : undefined,
          defaultUnitLabel: personDefaultUnit.trim() || undefined,
        }
      : {
          isPersonnel: undefined,
          personnelType: undefined,
          defaultRate: undefined,
          defaultUnitLabel: undefined,
        };
    if (editPerson) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === editPerson.id
            ? {
                ...c,
                fullName: personName.trim(),
                groupId: personGroupId,
                mobile: personMobile.trim() || undefined,
                notes: personNotes.trim() || undefined,
                picture: personPicture || undefined,
                ...personnelPayload,
              }
            : c
        )
      );
    } else {
      setContacts((prev) => [
        ...prev,
        {
          id: `ct_${crypto.randomUUID().slice(0, 8)}`,
          groupId: personGroupId,
          fullName: personName.trim(),
          mobile: personMobile.trim() || undefined,
          notes: personNotes.trim() || undefined,
          picture: personPicture || undefined,
          ...personnelPayload,
        },
      ]);
    }
    setPersonOpen(false);
  };

  const removePerson = async (c: Contact) => {
    if (transactions.some((t) => t.contactId === c.id)) {
      await dialog.alert({
        title: 'حذف',
        message: 'این شخص در ثبت‌ها استفاده شده و قابل حذف نیست.',
      });
      return;
    }
    const ok = await dialog.confirm({
      title: 'حذف شخص',
      message: `«${c.fullName}» حذف شود؟`,
      tone: 'danger',
      confirmLabel: 'حذف',
    });
    if (ok) {
      setContacts((prev) => prev.filter((x) => x.id !== c.id));
      if (selectedContactId === c.id) setSelectedContactId(null);
    }
  };

  const renderPersonMenu = (c: Contact) =>
    menuFor === c.id ? (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} aria-hidden />
        <div className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-elevated)] py-1.5 shadow-[var(--shadow-lg)]">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--surface-2)]"
            onClick={() => {
              setMenuFor(null);
              setSelectedContactId(c.id);
            }}
          >
            <RefreshCcw size={14} className="text-[color:var(--muted)]" />
            گردش حساب
          </button>
          {canEdit ? (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--surface-2)]"
              onClick={() => {
                setMenuFor(null);
                openPerson(c);
              }}
            >
              <Pencil size={14} className="text-[color:var(--muted)]" />
              ویرایش
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[color:var(--expense)] transition hover:bg-[color:var(--surface-2)]"
              onClick={() => {
                setMenuFor(null);
                void removePerson(c);
              }}
            >
              <Trash2 size={14} />
              حذف
            </button>
          ) : null}
        </div>
      </>
    ) : null;

  // ---------- Person Ledger View (Real Debit / Credit + Accrual Timeline) ----------
  if (selectedContactId) {
    const person = contacts.find((c) => c.id === selectedContactId);
    const group = groups.find((g) => g.id === person?.groupId);
    const t = (selectedContactId && totalsByContact.get(selectedContactId)) || {
      income: 0,
      expense: 0,
    };
    const bal =
      (selectedContactId && balanceByContact.get(selectedContactId)) ||
      computePersonBalance(selectedContactId, invoices, payrollEntries, checks, transactions);

    return (
      <div className="animate-page-enter mx-auto max-w-5xl space-y-5 pb-28 md:pb-8">
        <button
          type="button"
          onClick={() => setSelectedContactId(null)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--surface-1)] px-3.5 py-2 text-xs font-bold text-[color:var(--brand)] shadow-[var(--shadow-sm)] ring-1 ring-[color:var(--line)] transition hover:bg-[color:var(--brand-soft)]"
        >
          ← بازگشت به فهرست اشخاص
        </button>

        <div className="dash-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <ContactAvatar name={person?.fullName || ''} picture={person?.picture} size="lg" />
            <div className="min-w-0 flex-1">
              {group ? (
                <span className="inline-flex items-center gap-1.5 rounded-full tone-brand px-2.5 py-1 text-[11px] font-bold">
                  <Users size={12} aria-hidden />
                  {group.name}
                </span>
              ) : null}
              <h2 className="mt-2 text-2xl font-black text-[color:var(--ink)]">
                {person?.fullName}
              </h2>
              {person?.mobile ? (
                <p
                  className="mt-1 inline-block text-sm font-semibold tabular-nums text-[color:var(--muted)]"
                  dir="ltr"
                >
                  {person.mobile}
                </p>
              ) : null}
              {person?.notes ? (
                <p className="mt-1.5 text-xs leading-6 text-[color:var(--muted)]">{person.notes}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onSaveTx && banks.length > 0 ? (
                <>
                  <Button
                    size="sm"
                    variant="income"
                    icon={ArrowDown}
                    data-testid="person-stmt-add-receipt"
                    onClick={() =>
                      openPersonSettlementModal({
                        flow: 'receipt',
                        method: 'cash',
                        defaultAmount: bal.status === 'debtor' ? bal.receivableAmount : undefined,
                      })
                    }
                  >
                    ثبت دریافت
                  </Button>
                  <Button
                    size="sm"
                    variant="expense"
                    icon={ArrowUp}
                    data-testid="person-stmt-add-payment"
                    onClick={() =>
                      openPersonSettlementModal({
                        flow: 'payment',
                        method: 'cash',
                        defaultAmount: bal.status === 'creditor' ? bal.payableAmount : undefined,
                      })
                    }
                  >
                    ثبت پرداخت
                  </Button>
                </>
              ) : null}
              {onSaveCheck ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={FileCheck2}
                  data-testid="person-stmt-add-check"
                  onClick={() =>
                    openPersonSettlementModal({
                      flow: bal.status === 'debtor' ? 'receipt' : 'payment',
                      method: 'check',
                      defaultAmount:
                        bal.status === 'debtor'
                          ? bal.receivableAmount
                          : bal.status === 'creditor'
                            ? bal.payableAmount
                            : undefined,
                    })
                  }
                >
                  ثبت چک
                </Button>
              ) : null}
              {canEdit ? (
                <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openPerson(person)}>
                  ویرایش شخص
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-4">
              <p className="text-xs font-bold text-[color:var(--muted)]">جمع بستانکار (فاکتور خرید / حقوق)</p>
              <p className="mt-1 text-xl font-black tabular-nums text-[color:var(--ink)]">
                {money(bal.totalCredit)}
                <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-4">
              <p className="text-xs font-bold text-[color:var(--muted)]">جمع بدهکار (پرداختی / چک / فروش)</p>
              <p className="mt-1 text-xl font-black tabular-nums text-[color:var(--brand)]">
                {money(bal.totalDebit)}
                <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
            <div
              className={cn(
                'rounded-2xl p-4',
                bal.status === 'creditor'
                  ? 'kpi-expense-card'
                  : bal.status === 'debtor'
                    ? 'kpi-income-card'
                    : 'border border-[color:var(--line)] bg-[color:var(--surface-2)]/70'
              )}
              data-testid="person-net-balance"
            >
              <p className="text-xs font-bold text-[color:var(--muted)]">
                {bal.status === 'creditor'
                  ? 'مانده نهایی: طلبکار از ما (بدهکاری ما)'
                  : bal.status === 'debtor'
                    ? 'مانده نهایی: بدهکار به ما (طلب ما)'
                    : 'وضعیت حساب: تسویه‌شده'}
              </p>
              <p
                className={cn(
                  'mt-1 text-xl font-black tabular-nums',
                  bal.status === 'creditor'
                    ? 'text-[color:var(--expense)]'
                    : 'text-[color:var(--income)]'
                )}
              >
                {money(Math.abs(bal.netBalance))}
                <span className="ms-1 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
              </p>
            </div>
          </div>
        </div>

        {/* Open / Unsettled Invoices for this Person */}
        {(() => {
          const personOpenInvoices = invoices
            .filter((inv) => inv.contactId === selectedContactId)
            .map((inv) => ({
              invoice: inv,
              settlement: computeInvoiceSettlement(inv, transactions, checks),
            }))
            .filter((item) => item.settlement.remaining > 0);

          if (personOpenInvoices.length === 0) return null;

          return (
            <div className="dash-card p-4 sm:p-5" data-testid="person-open-invoices">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-warning">
                    <FileText size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-[color:var(--ink)]">
                      فاکتورهای باز و در انتظار تسویه این شخص
                    </h3>
                    <p className="text-[11px] font-medium text-[color:var(--muted)]">
                      می‌توانید هر فاکتور را در یک یا چند مرحله با نقد، واریز بانکی یا چک تسویه کنید
                    </p>
                  </div>
                </div>
                <span className="rounded-full tone-warning px-2.5 py-0.5 text-[11px] font-extrabold">
                  {toPersianDigits(String(personOpenInvoices.length))} فاکتور باز
                </span>
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {personOpenInvoices.map(({ invoice: inv, settlement: st }) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/65 p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[color:var(--ink)]">
                          {inv.kind === 'sale' ? 'فاکتور فروش' : 'فاکتور خرید'} #
                          {toPersianDigits(inv.invoiceNumber)}
                        </span>
                        <span className="text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                          {formatJalaliShort(inv.date)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-[color:var(--muted)]">
                        مبلغ کل: {money(inv.amount)} · مانده باز:{' '}
                        <strong className="font-black text-[color:var(--expense)]">
                          {money(st.remaining)} تومان
                        </strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onSaveTx && banks.length > 0 ? (
                        <button
                          type="button"
                          data-testid={`person-settle-inv-cash-${inv.id}`}
                          onClick={() =>
                            openPersonSettlementModal({
                              flow: inv.kind === 'sale' ? 'receipt' : 'payment',
                              method: 'cash',
                              invoice: inv,
                              defaultAmount: st.remaining,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-xl bg-[color:var(--brand-soft)] px-2.5 py-1.5 text-[11px] font-extrabold text-[color:var(--brand)] transition hover:opacity-85"
                        >
                          <Coins size={12} />
                          تسویه نقدی
                        </button>
                      ) : null}
                      {onSaveCheck ? (
                        <button
                          type="button"
                          data-testid={`person-settle-inv-check-${inv.id}`}
                          onClick={() =>
                            openPersonSettlementModal({
                              flow: inv.kind === 'sale' ? 'receipt' : 'payment',
                              method: 'check',
                              invoice: inv,
                              defaultAmount: st.remaining,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-2.5 py-1.5 text-[11px] font-extrabold text-[color:var(--ink)] transition hover:border-[color:var(--brand)]/40"
                        >
                          <FileCheck2 size={12} />
                          ثبت چک
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Chronological Running Balance Ledger */}
        <div className="dash-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-[color:var(--ink)]">
              صورت‌حساب کامل و گردش مانده (بدهکار / بستانکار)
            </h3>
            <span className="text-xs font-semibold text-[color:var(--muted)]">
              {toPersianDigits(String(bal.rows.length))} سند تعهدی و تسویه
            </span>
          </div>

          {bal.rows.length === 0 && selectedTxs.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="گردشی ثبت نشده است"
                description="فاکتور، کارکرد حقوق، چک یا پرداختی برای این شخص ثبت کنید تا مانده لحظه‌ای نمایش داده شود."
              />
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {bal.rows.length > 0 ? (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[38rem] text-right text-xs">
                      <thead>
                        <tr className="border-b border-[color:var(--line)] bg-[color:var(--surface-2)] text-[11px] font-bold text-[color:var(--muted)]">
                          <th className="px-3 py-2.5">تاریخ</th>
                          <th className="px-3 py-2.5">شرح سند</th>
                          <th className="px-3 py-2.5 text-left">بدهکار</th>
                          <th className="px-3 py-2.5 text-left">بستانکار</th>
                          <th className="px-3 py-2.5 text-left">مانده لحظه‌ای</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--line)]/60">
                        {bal.rows.map((r) => {
                          const inv = r.invoiceId
                            ? invoices.find((i) => i.id === r.invoiceId)
                            : undefined;
                          return (
                            <tr key={r.id} className="hover:bg-[color:var(--surface-2)]/50">
                              <td className="px-3 py-2.5 font-semibold tabular-nums text-[color:var(--muted)]">
                                {formatJalaliShort(r.date)}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-[color:var(--ink)]">{r.title}</span>
                                  {r.statusTag ? (
                                    <span className="rounded-full bg-[color:var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand)]">
                                      {r.statusTag}
                                    </span>
                                  ) : null}
                                  {inv?.attachment ? (
                                    <button
                                      type="button"
                                      onClick={() => setLightboxAtt(inv.attachment!)}
                                      className="rounded-lg bg-[color:var(--brand-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[color:var(--brand)] hover:opacity-80"
                                    >
                                      تصویر فاکتور
                                    </button>
                                  ) : null}
                                </div>
                                {r.description ? (
                                  <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                                    {r.description}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-left font-bold tabular-nums text-[color:var(--brand)]">
                                {r.debit > 0 ? money(r.debit) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-left font-bold tabular-nums text-[color:var(--expense)]">
                                {r.credit > 0 ? money(r.credit) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-left font-black tabular-nums">
                                <span
                                  className={
                                    r.runningBalance > 0
                                      ? 'text-[color:var(--expense)]'
                                      : r.runningBalance < 0
                                        ? 'text-[color:var(--income)]'
                                        : 'text-[color:var(--muted)]'
                                  }
                                >
                                  {money(Math.abs(r.runningBalance))}{' '}
                                  <span className="text-[10px] font-bold">
                                    {r.runningBalance > 0
                                      ? 'بستانکار'
                                      : r.runningBalance < 0
                                        ? 'بدهکار'
                                        : 'تسویه'}
                                  </span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Running Balance Cards */}
                  <div className="space-y-2.5 md:hidden" data-testid="person-ledger-mobile">
                    {bal.rows.map((r) => {
                      const inv = r.invoiceId
                        ? invoices.find((i) => i.id === r.invoiceId)
                        : undefined;
                      return (
                        <div
                          key={r.id}
                          className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/85 p-3.5 shadow-[var(--shadow-sm)]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-extrabold text-[color:var(--ink)]">
                                  {r.title}
                                </span>
                                {r.statusTag ? (
                                  <span className="rounded-full bg-[color:var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand)]">
                                    {r.statusTag}
                                  </span>
                                ) : null}
                                {inv?.attachment ? (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxAtt(inv.attachment!)}
                                    className="rounded-lg bg-[color:var(--brand-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[color:var(--brand)]"
                                  >
                                    تصویر فاکتور
                                  </button>
                                ) : null}
                              </div>
                              {r.description ? (
                                <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                                  {r.description}
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                              {formatJalaliShort(r.date)}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[color:var(--line)]/70 pt-2 text-xs tabular-nums">
                            <div>
                              {r.debit > 0 ? (
                                <span className="font-extrabold text-[color:var(--brand)]">
                                  بدهکار: {money(r.debit)} تومان
                                </span>
                              ) : r.credit > 0 ? (
                                <span className="font-extrabold text-[color:var(--expense)]">
                                  بستانکار: {money(r.credit)} تومان
                                </span>
                              ) : null}
                            </div>
                            <div className="text-left font-black">
                              <span className="text-[10.5px] font-semibold text-[color:var(--muted)]">
                                مانده:{' '}
                              </span>
                              <span
                                className={
                                  r.runningBalance > 0
                                    ? 'text-[color:var(--expense)]'
                                    : r.runningBalance < 0
                                      ? 'text-[color:var(--income)]'
                                      : 'text-[color:var(--muted)]'
                                }
                              >
                                {money(Math.abs(r.runningBalance))}{' '}
                                <span className="text-[10px] font-bold">
                                  {r.runningBalance > 0
                                    ? 'بستانکار'
                                    : r.runningBalance < 0
                                      ? 'بدهکار'
                                      : 'تسویه'}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {selectedTxs.filter((tx) => !tx.linkKind || tx.linkKind === 'regular').length > 0 ? (
                <div>
                  <h4 className="mb-2 text-xs font-extrabold text-[color:var(--muted)]">
                    تراکنش‌های نقدی مستقیم (تسویه در لحظه)
                  </h4>
                  <div className="divide-y divide-[color:var(--line)]/70">
                    {selectedTxs
                      .filter((tx) => !tx.linkKind || tx.linkKind === 'regular')
                      .map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[color:var(--ink)]">
                              {tx.description || (tx.type === 'income' ? 'دریافت وجه' : 'پرداخت وجه')}
                            </p>
                            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                              {tx.type === 'income' ? 'درآمد نقدی' : 'هزینه نقدی'} ·{' '}
                              {FA_JALALI_DATE.format(new Date(`${tx.date}T12:00:00`))}
                            </p>
                          </div>
                          <p
                            className={cn(
                              'shrink-0 text-sm font-black tabular-nums',
                              tx.type === 'income'
                                ? 'text-[color:var(--income)]'
                                : 'text-[color:var(--expense)]'
                            )}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {money(tx.amount)} تومان
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Person Statement Settlement & Check Modal */}
        <FormSheet
          isOpen={stmtSettleOpen}
          onClose={() => setStmtSettleOpen(false)}
          accent={stmtFlow === 'receipt' ? 'income' : 'expense'}
          size="md"
          dock
          title={
            stmtMethod === 'check'
              ? stmtFlow === 'receipt'
                ? `ثبت چک دریافتی از ${person?.fullName || ''}`
                : `ثبت چک پرداختی به ${person?.fullName || ''}`
              : stmtFlow === 'receipt'
                ? `ثبت دریافت وجه از ${person?.fullName || ''}`
                : `ثبت پرداخت وجه به ${person?.fullName || ''}`
          }
          subtitle="مبلغ ثبت‌شده مستقیماً در صورتحساب و مانده بدهکار/بستانکار شخص اعمال می‌شود"
          footer={
            <FormActions
              onCancel={() => setStmtSettleOpen(false)}
              onSubmit={() => void handleSavePersonStatementSettlement()}
              submitLabel={
                stmtMethod === 'check'
                  ? stmtFlow === 'receipt'
                    ? 'ثبت چک دریافتی'
                    : 'ثبت چک پرداختی'
                  : stmtFlow === 'receipt'
                    ? 'ثبت دریافت در صورتحساب'
                    : 'ثبت پرداخت در صورتحساب'
              }
              submitVariant={stmtFlow === 'receipt' ? 'income' : 'expense'}
              submitIcon={Check}
            />
          }
        >
          <div className="space-y-4">
            {/* Flow Switcher (Receipt vs Payment) */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)] p-1">
              <button
                type="button"
                data-testid="person-stmt-flow-receipt"
                onClick={() => setStmtFlow('receipt')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition',
                  stmtFlow === 'receipt'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <ArrowDown size={14} />
                دریافت از شخص
              </button>
              <button
                type="button"
                data-testid="person-stmt-flow-payment"
                onClick={() => setStmtFlow('payment')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition',
                  stmtFlow === 'payment'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <ArrowUp size={14} />
                پرداخت به شخص
              </button>
            </div>

            {/* Method Switcher (Cash/Bank vs Check) */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/65 p-1">
              <button
                type="button"
                data-testid="person-stmt-method-cash"
                onClick={() => setStmtMethod('cash')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition',
                  stmtMethod === 'cash'
                    ? 'btn-brand-gradient text-white shadow-xs'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <Wallet size={14} />
                نقدی / واریز بانکی
              </button>
              <button
                type="button"
                data-testid="person-stmt-method-check"
                onClick={() => setStmtMethod('check')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition',
                  stmtMethod === 'check'
                    ? 'btn-brand-gradient text-white shadow-xs'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                )}
              >
                <FileCheck2 size={14} />
                ثبت چک
              </button>
            </div>

            {/* Optional Invoice Link Selector */}
            <div>
              <label className={fieldLabel}>بابت (فاکتور مشخص یا علی‌الحساب در صورتحساب)</label>
              <select
                data-testid="person-stmt-invoice-select"
                className={fieldInput}
                value={stmtInvoiceId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setStmtInvoiceId(nextId);
                  if (nextId) {
                    const inv = invoices.find((i) => i.id === nextId);
                    if (inv) {
                      const st = computeInvoiceSettlement(inv, transactions, checks);
                      if (st.remaining > 0) setStmtAmountRaw(String(st.remaining));
                    }
                  }
                }}
              >
                <option value="">علی‌الحساب / تسویه کلی صورتحساب شخص</option>
                {invoices
                  .filter((inv) => inv.contactId === selectedContactId)
                  .map((inv) => {
                    const st = computeInvoiceSettlement(inv, transactions, checks);
                    return (
                      <option key={inv.id} value={inv.id}>
                        {inv.kind === 'sale' ? 'فاکتور فروش' : 'فاکتور خرید'} #
                        {toPersianDigits(inv.invoiceNumber)} — مانده: {money(st.remaining)} تومان
                      </option>
                    );
                  })}
              </select>
            </div>

            <AmountInput
              label="مبلغ (تومان)"
              value={stmtAmountRaw}
              onChange={setStmtAmountRaw}
              placeholder="۰"
              accent={stmtFlow === 'receipt' ? 'income' : 'expense'}
              autoFocus
            />

            {stmtMethod === 'cash' ? (
              <div className="form-section grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel}>
                    {stmtFlow === 'receipt' ? 'واریز به بانک / صندوق' : 'پرداخت از بانک / صندوق'}
                  </label>
                  <select
                    data-testid="person-stmt-bank-select"
                    className={fieldInput}
                    value={stmtBankId}
                    onChange={(e) => setStmtBankId(e.target.value)}
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>تاریخ</label>
                  <PersianDatePicker value={stmtDate} onChange={setStmtDate} />
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>شرح (اختیاری)</label>
                  <input
                    data-testid="person-stmt-note"
                    className={fieldInput}
                    value={stmtNote}
                    onChange={(e) => setStmtNote(e.target.value)}
                    placeholder="توضیحات دریافت یا پرداخت..."
                  />
                </div>
              </div>
            ) : (
              <div className="form-section grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel}>شماره چک</label>
                  <input
                    data-testid="person-stmt-check-number"
                    className={cn(fieldInput, 'tabular-nums')}
                    value={stmtCheckNumber}
                    onChange={(e) => setStmtCheckNumber(e.target.value)}
                    placeholder="مثلاً ۴۵۸۹۲۰"
                  />
                </div>
                <div>
                  <label className={fieldLabel}>شناسه صیادی (اختیاری)</label>
                  <input
                    className={cn(fieldInput, 'tabular-nums')}
                    value={stmtCheckSayad}
                    onChange={(e) => setStmtCheckSayad(e.target.value)}
                    placeholder="۱۶ رقم صیاد"
                  />
                </div>
                <div>
                  <label className={fieldLabel}>تاریخ سررسید چک</label>
                  <PersianDatePicker value={stmtDueDate} onChange={setStmtDueDate} />
                </div>
                <div>
                  <label className={fieldLabel}>نام بانک چک</label>
                  <input
                    className={fieldInput}
                    value={stmtCheckBankName}
                    onChange={(e) => setStmtCheckBankName(e.target.value)}
                    placeholder="مثلاً بانک ملت، ملی..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>شرح چک (اختیاری)</label>
                  <input
                    className={fieldInput}
                    value={stmtNote}
                    onChange={(e) => setStmtNote(e.target.value)}
                    placeholder="توضیحات چک..."
                  />
                </div>
              </div>
            )}
          </div>
        </FormSheet>

        <AttachmentLightbox attachment={lightboxAtt} onClose={() => setLightboxAtt(null)} />
      </div>
    );
  }

  return (
    <div className="animate-page-enter mx-auto max-w-6xl space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="اشخاص"
        subtitle="گروه و افراد خود را مدیریت کنید"
        actions={
          (tab === 'people' ? sortedPeople.length > 0 : sortedGroups.length > 0) ? (
            <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="reports.export" />
          ) : undefined
        }
        primaryAction={
          canCreate ? (
            <Button
              size="sm"
              icon={Plus}
              data-testid="person-add"
              onClick={() => (tab === 'groups' ? openGroup() : openPerson())}
            >
              {tab === 'groups' ? 'گروه جدید' : 'شخص جدید'}
            </Button>
          ) : undefined
        }
      />

      {/* Segmented pill + Search/Filter */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] p-1 shadow-[var(--shadow-sm)] md:w-64"
          data-testid="persons-tabs"
        >
          <button
            type="button"
            data-testid="tab-people"
            onClick={() => setTab('people')}
            className={cn(
              'rounded-xl py-2 text-xs font-extrabold transition',
              tab === 'people'
                ? 'btn-brand-gradient text-white shadow-[0_6px_16px_var(--brand-glow)]'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            افراد
          </button>
          <button
            type="button"
            data-testid="tab-groups"
            onClick={() => setTab('groups')}
            className={cn(
              'rounded-xl py-2 text-xs font-extrabold transition',
              tab === 'groups'
                ? 'btn-brand-gradient text-white shadow-[0_6px_16px_var(--brand-glow)]'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            گروه‌ها
          </button>
        </div>

        <div className="flex flex-1 items-center gap-2 md:max-w-lg">
          <PersonSearch
            testId="person-search"
            value={query}
            onChange={setQuery}
            placeholder={tab === 'groups' ? 'جست‌وجوی گروه...' : 'جست‌وجوی شخص...'}
          />
          {tab === 'people' ? (
            <GroupFilter value={groupFilter} onChange={setGroupFilter} groups={sortedGroups} />
          ) : null}
        </div>
      </div>

      {/* Role Filter Chips (All / Personnel / Other counterparties) */}
      {tab === 'people' && sortedPeople.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="persons-role-filter">
          {(
            [
              { id: 'all', label: `همه اشخاص (${toPersianDigits(String(sortedPeople.length))})` },
              {
                id: 'personnel',
                label: `پرسنل و کارگران (${toPersianDigits(String(personnelCount))})`,
              },
              {
                id: 'other',
                label: `سایر طرف‌حساب‌ها (${toPersianDigits(String(sortedPeople.length - personnelCount))})`,
              },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              data-testid={`role-filter-${chip.id}`}
              onClick={() => setRoleFilter(chip.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold transition',
                roleFilter === chip.id
                  ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                  : 'border-[color:var(--line)] bg-[color:var(--surface-1)] text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              {chip.id === 'personnel' ? <Briefcase size={13} aria-hidden /> : null}
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'groups' ? (
        sortedGroups.length === 0 ? (
          <EmptyState
            title="گروهی نیست"
            description="اولین گروه اشخاص مانند مشتریان، شرکا یا پرسنل را بسازید."
            action={
              canCreate ? (
                <Button size="sm" icon={Plus} onClick={() => openGroup()}>
                  گروه جدید
                </Button>
              ) : undefined
            }
          />
        ) : filteredGroups.length === 0 ? (
          <EmptyState title="موردی یافت نشد" description="عبارت جست‌وجو را تغییر دهید." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="group-cards">
            {filteredGroups.map((g) => (
              <div
                key={g.id}
                className="dash-card flex items-center gap-3 p-4 transition hover:border-[color:var(--brand)]/35"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tone-brand">
                  <Users size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-[color:var(--ink)]">{g.name}</p>
                  <p className="mt-0.5 text-xs font-semibold text-[color:var(--muted)]">
                    {toPersianDigits(String(contactsInGroup(contacts, g.id).length))} نفر
                  </p>
                </div>
                {canEdit || canDelete ? (
                  <div className="flex items-center gap-1">
                    {canEdit ? (
                      <IconButton icon={Pencil} label="ویرایش گروه" size="sm" onClick={() => openGroup(g)} />
                    ) : null}
                    {canDelete ? (
                      <IconButton
                        icon={Trash2}
                        label="حذف گروه"
                        size="sm"
                        variant="soft-danger"
                        onClick={() => void removeGroup(g)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : sortedPeople.length === 0 ? (
        <EmptyState
          title="شخصی ثبت نشده است"
          description="افراد، مشتریان یا شرکا را اضافه کنید تا گردش مالی هرکدام جداگانه ثبت شود."
          action={
            canCreate ? (
              <Button size="sm" icon={Plus} onClick={() => openPerson()}>
                شخص جدید
              </Button>
            ) : undefined
          }
        />
      ) : filteredPeople.length === 0 ? (
        <EmptyState title="موردی یافت نشد" description="عبارت جست‌وجو یا فیلتر گروه را تغییر دهید." />
      ) : (
        <>
          {/* Desktop & Tablet frosted table */}
          <div className="dash-card hidden overflow-hidden md:block" data-testid="person-table">
            <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)_minmax(0,1.15fr)_minmax(0,0.95fr)_7.5rem] items-center gap-3 border-b border-[color:var(--line)] bg-[color:var(--surface-2)] px-5 py-3 text-[11px] font-bold text-[color:var(--muted)]">
              <span>نام طرف‌حساب</span>
              <span>گروه</span>
              <span className="text-left">وضعیت مانده (بدهکار / بستانکار)</span>
              <span className="text-left">گردش نقدی</span>
              <span className="text-left">عملیات</span>
            </div>
            <div className="divide-y divide-[color:var(--line)]/60" data-testid="person-table-rows">
              {filteredPeople.map((c) => {
                const g = groups.find((x) => x.id === c.groupId);
                const t = totalsByContact.get(c.id) || { income: 0, expense: 0 };
                const bal = balanceByContact.get(c.id);
                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)_minmax(0,1.15fr)_minmax(0,0.95fr)_7.5rem] items-center gap-3 px-5 py-3 transition hover:bg-[color:var(--surface-2)]/65"
                    data-testid="person-row"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ContactAvatar name={c.fullName} picture={c.picture} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="block max-w-full truncate text-sm font-extrabold text-[color:var(--ink)] transition hover:text-[color:var(--brand)]"
                            onClick={() => setSelectedContactId(c.id)}
                          >
                            {c.fullName}
                          </button>
                          {isPersonnelContact(c, groups) ? (
                            <span
                              data-testid={`personnel-badge-${c.id}`}
                              className="inline-flex shrink-0 items-center gap-1 rounded-full tone-income px-2 py-0.5 text-[10px] font-extrabold"
                            >
                              <Briefcase size={10} aria-hidden />
                              پرسنل
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {c.mobile ? (
                            <span className="text-[11px] tabular-nums text-[color:var(--muted)]" dir="ltr">
                              {c.mobile}
                            </span>
                          ) : null}
                          {c.defaultRate ? (
                            <span className="text-[10.5px] font-semibold text-[color:var(--muted)]">
                              نرخ پیش‌فرض: {money(c.defaultRate)} / {c.defaultUnitLabel || 'روز'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      {g ? (
                        <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full tone-brand px-2.5 py-1 text-[11px] font-bold">
                          <Users size={11} aria-hidden />
                          <span className="truncate">{g.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-[color:var(--muted)]">—</span>
                      )}
                    </div>

                    <div className="text-left">
                      {bal && bal.status === 'creditor' ? (
                        <p className="truncate text-sm font-black tabular-nums text-[color:var(--expense)]">
                          {money(bal.payableAmount)}
                          <span className="ms-1 text-[10px] font-bold">طلبکار از ما</span>
                        </p>
                      ) : bal && bal.status === 'debtor' ? (
                        <p className="truncate text-sm font-black tabular-nums text-[color:var(--income)]">
                          {money(bal.receivableAmount)}
                          <span className="ms-1 text-[10px] font-bold">بدهکار به ما</span>
                        </p>
                      ) : (
                        <span className="text-xs font-bold text-[color:var(--muted)]">تسویه‌شده</span>
                      )}
                    </div>

                    <p className="truncate text-left text-xs font-bold tabular-nums text-[color:var(--muted)]">
                      +{money(t.income)} / -{money(t.expense)}
                    </p>

                    <div className="relative flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedContactId(c.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--brand)] transition hover:opacity-90"
                      >
                        <RefreshCcw size={11} aria-hidden />
                        گردش حساب
                      </button>
                      {canEdit ? (
                        <IconButton icon={Pencil} label="ویرایش" size="sm" onClick={() => openPerson(c)} />
                      ) : null}
                      {canEdit || canDelete ? (
                        <IconButton
                          icon={MoreVertical}
                          label="گزینه‌ها"
                          size="sm"
                          onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                        />
                      ) : null}
                      {renderPersonMenu(c)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2.5 md:hidden" data-testid="person-cards">
            {filteredPeople.map((c) => {
              const g = groups.find((x) => x.id === c.groupId);
              const t = totalsByContact.get(c.id) || { income: 0, expense: 0 };
              const bal = balanceByContact.get(c.id);
              return (
                <div
                  key={c.id}
                  className="dash-card relative p-3.5"
                  data-testid="person-card"
                >
                  <div className="flex items-start gap-3">
                    <ContactAvatar name={c.fullName} picture={c.picture} size="md" />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="block max-w-full truncate text-start text-sm font-extrabold text-[color:var(--ink)]"
                          onClick={() => setSelectedContactId(c.id)}
                        >
                          {c.fullName}
                        </button>
                        {isPersonnelContact(c, groups) ? (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full tone-income px-2 py-0.5 text-[10px] font-extrabold">
                            <Briefcase size={10} aria-hidden />
                            پرسنل
                          </span>
                        ) : null}
                      </div>
                      {g ? (
                        <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full tone-brand px-2.5 py-0.5 text-[11px] font-bold">
                          <Users size={11} aria-hidden />
                          <span className="truncate">{g.name}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {canEdit || canDelete ? (
                        <IconButton
                          icon={MoreVertical}
                          label="گزینه‌ها"
                          size="sm"
                          onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                        />
                      ) : null}
                      <button
                        type="button"
                        aria-label="گردش حساب"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)]"
                        onClick={() => setSelectedContactId(c.id)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bal && bal.status === 'creditor' ? (
                      <span className="inline-flex items-center gap-1 rounded-full tone-expense px-3 py-1.5 text-[11px] font-extrabold tabular-nums">
                        طلبکار از ما: {money(bal.payableAmount)} تومان
                      </span>
                    ) : bal && bal.status === 'debtor' ? (
                      <span className="inline-flex items-center gap-1 rounded-full tone-income px-3 py-1.5 text-[11px] font-extrabold tabular-nums">
                        بدهکار به ما: {money(bal.receivableAmount)} تومان
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-2)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--muted)]">
                        تسویه‌شده
                      </span>
                    )}
                    {t.income > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full tone-income px-2.5 py-1 text-[10.5px] font-bold tabular-nums">
                        <ArrowUp size={10} aria-hidden />
                        {money(t.income)}
                      </span>
                    ) : null}
                    {t.expense > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full tone-expense px-2.5 py-1 text-[10.5px] font-bold tabular-nums">
                        <ArrowDown size={10} aria-hidden />
                        {money(t.expense)}
                      </span>
                    ) : null}
                  </div>
                  {renderPersonMenu(c)}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Group Modal */}
      <FormSheet
        isOpen={groupOpen}
        onClose={() => setGroupOpen(false)}
        accent="brand"
        size="sm"
        dock
        subtitle={editGroup ? 'نام گروه را ویرایش کنید' : 'نام گروه جدید را وارد کنید'}
        headerChip={<StoreMark name={storeName} logo={settings?.logo || undefined} size="md" />}
        title={editGroup ? 'ویرایش گروه' : 'گروه جدید'}
        footer={
          <FormActions
            onCancel={() => setGroupOpen(false)}
            onSubmit={() => void saveGroup()}
            submitLabel={editGroup ? 'ذخیره تغییرات' : 'افزودن گروه'}
            submitDisabled={!groupName.trim()}
            submitIcon={editGroup ? Check : Plus}
          />
        }
      >
        <div className="form-section">
          <div>
            <label className={fieldLabel}>نام گروه</label>
            <input
              className={fieldInput}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="مثلاً شرکا یا مشتریان"
              autoFocus
            />
          </div>
        </div>
      </FormSheet>

      {/* Person Modal — Side-by-side on md+ with strictly aligned fields */}
      <FormSheet
        isOpen={personOpen}
        onClose={() => setPersonOpen(false)}
        accent="brand"
        size="lg"
        dock
        subtitle={
          editPerson ? 'اطلاعات شخص را ویرایش کنید' : 'اطلاعات شخص جدید را وارد و تکمیل کنید'
        }
        headerChip={<StoreMark name={storeName} logo={settings?.logo || undefined} size="md" />}
        title={editPerson ? 'ویرایش شخص' : 'شخص جدید'}
        footer={
          <FormActions
            onCancel={() => setPersonOpen(false)}
            onSubmit={() => void savePerson()}
            submitLabel={editPerson ? 'ذخیره تغییرات' : 'افزودن شخص'}
            submitDisabled={!personName.trim()}
            submitIcon={editPerson ? Check : Plus}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_184px] md:items-start md:gap-5">
          {/* Fields Column */}
          <div className="order-2 space-y-3.5 md:order-1 md:space-y-4">
            <div className="form-section grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
              <div className="sm:col-span-2">
                <label className={fieldLabel}>نام و نام خانوادگی</label>
                <input
                  className={fieldInput}
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="مثلاً علی رضایی"
                  autoFocus
                />
              </div>

              <div>
                <label className={fieldLabel}>گروه</label>
                <select
                  className={fieldInput}
                  value={personGroupId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setPersonGroupId(nextId);
                    const grp = sortedGroups.find((x) => x.id === nextId);
                    if (isPersonnelGroup(grp)) setPersonIsPersonnel(true);
                  }}
                >
                  {sortedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={fieldLabel}>شماره تماس (اختیاری)</label>
                <input
                  className={cn(fieldInput, 'tabular-nums')}
                  dir="ltr"
                  inputMode="tel"
                  value={personMobile}
                  onChange={(e) => setPersonMobile(e.target.value)}
                  placeholder="09xxxxxxxxx"
                />
              </div>

              <div className="sm:col-span-2">
                <CollapsibleOptionalSection
                  mobileOnly
                  title="یادداشت و توضیحات (اختیاری)"
                  subtitle="اطلاعات تکمیلی یا آدرس طرف حساب"
                  filledCount={countFilledFields([personNotes])}
                  testId="person-optional-section"
                >
                  <div>
                    <label className={fieldLabel}>توضیحات (اختیاری)</label>
                    <textarea
                      className={cn(fieldInput, 'min-h-[4.5rem] py-2.5 leading-6')}
                      value={personNotes}
                      onChange={(e) => setPersonNotes(e.target.value)}
                      placeholder="یادداشت درباره این شخص..."
                    />
                  </div>
                </CollapsibleOptionalSection>
              </div>
            </div>

            {/* Personnel Classification Section */}
            <div className="form-section space-y-3.5">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-extrabold text-[color:var(--ink)]">
                    <Briefcase size={14} className="text-[color:var(--brand)]" aria-hidden />
                    تعریف به عنوان پرسنل / کارگر
                  </span>
                  <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                    با فعال‌سازی، این شخص در بخش «حقوق و کارکرد پرسنل» برای قرارداد و ثبت کارکرد قابل انتخاب می‌شود.
                  </p>
                </div>
                <input
                  type="checkbox"
                  data-testid="person-is-personnel-toggle"
                  checked={personIsPersonnel}
                  onChange={(e) => setPersonIsPersonnel(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[color:var(--brand)]"
                />
              </label>

              {personIsPersonnel ? (
                <div className="grid grid-cols-1 items-start gap-4 border-t border-[color:var(--line)]/70 pt-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={fieldLabel}>نوع همکاری</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['fixed', 'daily', 'both'] as PersonnelType[]).map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => setPersonPersonnelType(pt)}
                          className={cn(
                            'min-h-[2.75rem] rounded-xl border px-2 text-[11px] font-extrabold transition',
                            personPersonnelType === pt
                              ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                              : 'border-[color:var(--line)] bg-[color:var(--surface-solid)] text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                          )}
                        >
                          {PERSONNEL_TYPE_LABELS[pt]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>واحد پیش‌فرض کارکرد</label>
                    <input
                      className={fieldInput}
                      data-testid="person-default-unit"
                      value={personDefaultUnit}
                      onChange={(e) => setPersonDefaultUnit(e.target.value)}
                      placeholder="مثلاً روز یا شبانه‌روز"
                    />
                  </div>
                  <div>
                    <label className={fieldLabel}>نرخ پیش‌فرض (تومان)</label>
                    <input
                      className={cn(fieldInput, 'tabular-nums')}
                      dir="ltr"
                      inputMode="numeric"
                      data-testid="person-default-rate"
                      value={
                        parseIntegerAmount(personDefaultRateRaw) > 0
                          ? formatNumberWithCommas(parseIntegerAmount(personDefaultRateRaw))
                          : ''
                      }
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9۰-۹]/g, '');
                        setPersonDefaultRateRaw(digits);
                      }}
                      placeholder="مثلاً 1,000,000"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Avatar Column (compact horizontal strip on mobile, vertical sidebar card on md+) */}
          <div className="order-1 flex flex-row items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3 md:order-2 md:flex-col md:justify-start md:p-4">
            <div className="flex min-w-0 items-center gap-3 md:flex-col">
              <span className="shrink-0 md:hidden">
                <ContactAvatar name={personName || 'شخص'} picture={personPicture} size="lg" />
              </span>
              <span className="hidden shrink-0 md:inline-flex">
                <ContactAvatar name={personName || 'شخص'} picture={personPicture} size="xl" />
              </span>
              <div className="min-w-0 md:hidden">
                <p className="truncate text-xs font-extrabold text-[color:var(--ink)]">
                  {personName.trim() || 'تصویر پروفایل'}
                </p>
                <p className="text-[11px] font-medium text-[color:var(--muted)]">
                  {personPicture ? 'تصویر بارگذاری شد' : 'اختیاری'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:w-full md:flex-col">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex min-h-[2.625rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 text-xs font-bold text-[color:var(--ink)] shadow-xs transition hover:border-[color:var(--brand)]/40 hover:text-[color:var(--brand)] md:w-full"
              >
                <Camera size={14} aria-hidden />
                {personPicture ? 'تغییر عکس' : 'افزودن عکس'}
              </button>
              {personPicture ? (
                <button
                  type="button"
                  onClick={() => setPersonPicture('')}
                  className="min-h-[2.25rem] px-2 text-xs font-semibold text-[color:var(--expense)] transition hover:underline"
                >
                  حذف عکس
                </button>
              ) : null}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void uploadImagePath(file, 'avatars')
                  .then(setPersonPicture)
                  .catch((err) =>
                    void dialog.alert({
                      title: 'عکس',
                      message: err instanceof Error ? err.message : 'خطا در بارگذاری.',
                    })
                  )
                  .finally(() => {
                    if (photoInputRef.current) photoInputRef.current.value = '';
                  });
              }}
            />
          </div>
        </div>
      </FormSheet>
    </div>
  );
};

export default PersonsPage;
