import React, { useCallback, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  List,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
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
  InvoiceKind,
  Product,
  Transaction,
  Warehouse,
} from '../types';
import { APP_NAME } from '../constants';
import { getAccountById, getBankAccounts } from '../utils/accountTree';
import { resolveDefaultAccountId } from '../utils/accountingTemplates';
import { computeInvoiceSettlement, type InvoiceSettlementSummary } from '../utils/accrualEngine';
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
} from '../utils/jalaliPeriod';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { useCan } from '../hooks/useSessionAuth';
import { useHideMobileNavWhen } from '../hooks/useFormWorkspace';
import { countFilledFields } from '../utils/formLayout';
import PersianDatePicker from './PersianDatePicker';
import AttachmentLightbox from './ui/AttachmentLightbox';
import { ExportActions } from './export/ExportActions';
import InvoiceEditorTab from './invoices/InvoiceEditorTab';
import InvoiceDetailTab from './invoices/InvoiceDetailTab';
import {
  AmountInput,
  Button,
  CollapsibleOptionalSection,
  EmptyState,
  FormActions,
  FormSheet,
  IconButton,
  MdiTabWorkspace,
  type MdiTabDescriptor,
  cn,
  fieldInput,
  fieldLabel,
} from './ui';
import { useDialog } from './DialogProvider';

interface InvoicesPageProps {
  accounts: Account[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  warehouses: Warehouse[];
  products: Product[];
  setProducts: (v: Product[] | ((p: Product[]) => Product[])) => void;
  invoices: Invoice[];
  setInvoices: (v: Invoice[] | ((p: Invoice[]) => Invoice[])) => void;
  transactions: Transaction[];
  setTransactions?: (v: Transaction[] | ((p: Transaction[]) => Transaction[])) => void;
  onSaveTx: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  onDeleteTx?: (id: string) => void;
  checks: CheckItem[];
  setChecks?: (v: CheckItem[] | ((p: CheckItem[]) => CheckItem[])) => void;
  onSaveCheck?: (ch: Omit<CheckItem, 'id'> | CheckItem) => void;
  settings?: AppSettings;
}

type InvoiceDocTab =
  | {
      id: string;
      kind: 'create';
      invoiceKind: InvoiceKind;
      nextNumber: string;
      title: string;
      dirty: boolean;
      accent: 'income' | 'expense';
    }
  | {
      id: string;
      kind: 'edit';
      invoiceId: string;
      title: string;
      dirty: boolean;
      accent: 'income' | 'expense';
    }
  | {
      id: string;
      kind: 'detail';
      invoiceId: string;
      title: string;
      accent: 'income' | 'expense';
    };

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

const jalaliKey = (iso: string) => {
  const p = getJalaliParts(iso);
  return { y: p?.year ?? 1405, m: p?.month ?? 1 };
};

const jalaliLabel = (y: number, m: number) =>
  `${JALALI_MONTH_NAMES[m - 1] || ''} ${toPersianDigits(y)}`.trim();

function StatusBadge({ status }: { status: 'unpaid' | 'partial' | 'paid' }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center rounded-md tone-income px-2 py-0.5 text-[11px] font-bold">
        تسویه‌شده
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
        تسویه جزئی
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md tone-expense px-2 py-0.5 text-[11px] font-bold">
      تسویه‌نشده
    </span>
  );
}

const InvoicesPage: React.FC<InvoicesPageProps> = ({
  accounts,
  contacts,
  contactGroups,
  warehouses,
  products,
  setProducts,
  invoices,
  setInvoices,
  transactions,
  setTransactions,
  onSaveTx,
  onDeleteTx,
  checks,
  setChecks,
  onSaveCheck,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canCreate = can('journals.create');
  const canEdit = can('journals.edit');
  const canDelete = can('journals.delete');

  const storeName = settings?.name || APP_NAME;
  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);

  const [kindTab, setKindTab] = useState<'all' | InvoiceKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [contactFilter, setContactFilter] = useState('');
  const [period, setPeriod] = useState('all');
  const [query, setQuery] = useState('');
  const [hideAmount, setHideAmount] = useState(false);

  // Contextual In-Module MDI Tabbed Pages State
  const [docTabs, setDocTabs] = useState<InvoiceDocTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('list');
  const [draftSeq, setDraftSeq] = useState(1);

  const [lightboxAtt, setLightboxAtt] = useState<Attachment | null>(null);

  // Unified Settlement Hub Modal (Cash/Bank stage OR Check stage + previous stages history)
  const [settleInvoiceId, setSettleInvoiceId] = useState<string | null>(null);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'check'>('cash');
  const [settleAmountRaw, setSettleAmountRaw] = useState('');
  const [settleDate, setSettleDate] = useState(() => getLocalDateISOString(new Date()));
  const [settleBankId, setSettleBankId] = useState('');
  const [settleDesc, setSettleDesc] = useState('');

  // Check fields inside unified settlement modal (or direct check trigger)
  const [checkInvoiceSummary, setCheckInvoiceSummary] = useState<InvoiceSettlementSummary | null>(null);
  const [checkNumber, setCheckNumber] = useState('');
  const [checkSayadId, setCheckSayadId] = useState('');
  const [checkAmountRaw, setCheckAmountRaw] = useState('');
  const [checkIssueDate, setCheckIssueDate] = useState(() => getLocalDateISOString(new Date()));
  const [checkDueDate, setCheckDueDate] = useState(() => getLocalDateISOString(new Date()));
  const [checkBankId, setCheckBankId] = useState('');
  const [checkDesc, setCheckDesc] = useState('');

  const contactName = (id: string) => contacts.find((c) => c.id === id)?.fullName || 'شخص حذف‌شده';
  const warehouseName = (id?: string) => warehouses.find((w) => w.id === id)?.name || '';

  const summaries = useMemo(() => {
    return [...invoices]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .map((inv) => computeInvoiceSettlement(inv, transactions, checks));
  }, [invoices, transactions, checks]);

  const periodOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const inv of invoices) {
      const k = jalaliKey(inv.date);
      keys.add(`${k.y}-${k.m}`);
    }
    const nowK = jalaliKey(getLocalDateISOString(new Date()));
    keys.add(`${nowK.y}-${nowK.m}`);
    return [...keys]
      .map((key) => {
        const [y, m] = key.split('-').map(Number);
        return { key, y, m, label: jalaliLabel(y, m) };
      })
      .sort((a, b) => b.y - a.y || b.m - a.m);
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries.filter((s) => {
      const inv = s.invoice;
      if (kindTab !== 'all' && inv.kind !== kindTab) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (contactFilter && inv.contactId !== contactFilter) return false;
      if (period !== 'all') {
        const k = jalaliKey(inv.date);
        if (`${k.y}-${k.m}` !== period) return false;
      }
      if (!q) return true;
      const cName = contactName(inv.contactId);
      const aName = getAccountById(accounts, inv.accountId)?.name || '';
      const itemNames = (inv.items || []).map((i) => i.productName).join(' ');
      return `${inv.invoiceNumber} ${inv.description} ${cName} ${aName} ${itemNames}`
        .toLowerCase()
        .includes(q);
    });
  }, [summaries, kindTab, statusFilter, contactFilter, period, query, accounts, contacts]);

  const totalAmount = useMemo(() => filtered.reduce((sum, s) => sum + s.invoice.amount, 0), [filtered]);
  const totalSettled = useMemo(() => filtered.reduce((sum, s) => sum + s.settledTotal, 0), [filtered]);
  const totalRemaining = useMemo(() => filtered.reduce((sum, s) => sum + s.remaining, 0), [filtered]);

  // --- MDI Tab Helpers ---
  const openCreateTab = (defaultKind?: InvoiceKind) => {
    const k: InvoiceKind = defaultKind || (kindTab === 'sale' ? 'sale' : 'purchase');
    const id = `new-${draftSeq}`;
    setDraftSeq((n) => n + 1);
    const nextNum = String(invoices.filter((i) => i.kind === k).length + 1);
    const tab: InvoiceDocTab = {
      id,
      kind: 'create',
      invoiceKind: k,
      nextNumber: nextNum,
      title: `${k === 'purchase' ? 'فاکتور خرید جدید' : 'فاکتور فروش جدید'} #${toPersianDigits(nextNum)}`,
      dirty: false,
      accent: k === 'purchase' ? 'expense' : 'income',
    };
    setDocTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
  };

  const openEditTab = (inv: Invoice) => {
    const id = `edit-${inv.id}`;
    setDocTabs((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [
        ...prev,
        {
          id,
          kind: 'edit',
          invoiceId: inv.id,
          title: `ویرایش ${inv.kind === 'purchase' ? 'خرید' : 'فروش'} #${toPersianDigits(inv.invoiceNumber)}`,
          dirty: false,
          accent: inv.kind === 'purchase' ? 'expense' : 'income',
        },
      ];
    });
    setActiveTabId(id);
  };

  const openDetailTab = (inv: Invoice) => {
    const id = `detail-${inv.id}`;
    setDocTabs((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [
        ...prev,
        {
          id,
          kind: 'detail',
          invoiceId: inv.id,
          title: `جزئیات #${toPersianDigits(inv.invoiceNumber)}`,
          accent: inv.kind === 'purchase' ? 'expense' : 'income',
        },
      ];
    });
    setActiveTabId(id);
  };

  const closeDocTab = useCallback((id: string) => {
    setDocTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((cur) => {
        if (cur !== id) return cur;
        if (next.length === 0) return 'list';
        return next[Math.max(0, idx - 1)]?.id || 'list';
      });
      return next;
    });
  }, []);

  const updateDocTabMeta = useCallback(
    (tabId: string, meta: { title: string; dirty: boolean; accent: 'income' | 'expense' }) => {
      setDocTabs((prev) =>
        prev.map((t) =>
          t.id === tabId && (t.kind === 'create' || t.kind === 'edit')
            ? t.title === meta.title && t.dirty === meta.dirty && t.accent === meta.accent
              ? t
              : { ...t, title: meta.title, dirty: meta.dirty, accent: meta.accent }
            : t
        )
      );
    },
    []
  );

  const handleSaveInvoiceFromTab = (
    tabId: string,
    payload: Invoice,
    isEdit: boolean,
    settlements?: { transactions: Transaction[]; checks: CheckItem[] }
  ) => {
    if (isEdit) {
      setInvoices((prev) => prev.map((x) => (x.id === payload.id ? payload : x)));
    } else {
      setInvoices((prev) => [payload, ...prev]);
    }

    if (settlements) {
      if (setTransactions) {
        setTransactions((prev) => {
          const withoutThisInv = prev.filter(
            (t) => !(t.invoiceId === payload.id && t.linkKind === 'invoice_settlement')
          );
          return [...withoutThisInv, ...settlements.transactions];
        });
      } else {
        for (const tx of settlements.transactions) {
          onSaveTx(tx);
        }
      }

      if (setChecks) {
        setChecks((prev) => {
          const withoutThisInv = prev.filter((c) => c.invoiceId !== payload.id);
          return [...settlements.checks, ...withoutThisInv];
        });
      } else if (onSaveCheck) {
        for (const ch of settlements.checks) {
          onSaveCheck(ch);
        }
      }
    }

    closeDocTab(tabId);
  };

  const handleDeleteInvoice = async (s: InvoiceSettlementSummary) => {
    if (s.linkedTransactions.length > 0 || s.linkedChecks.length > 0) {
      await dialog.alert({
        title: 'امکان حذف نیست',
        message: 'برای این فاکتور پرداخت یا چک ثبت شده است. ابتدا پرداخت‌ها و چک‌های مرتبط را حذف کنید.',
      });
      return;
    }
    const ok = await dialog.confirm({
      title: 'حذف فاکتور',
      message: `فاکتور شماره ${s.invoice.invoiceNumber} به مبلغ ${money(s.invoice.amount)} تومان حذف شود؟`,
      tone: 'danger',
      confirmLabel: 'حذف فاکتور',
    });
    if (ok) {
      setInvoices((prev) => prev.filter((x) => x.id !== s.invoice.id));
      closeDocTab(`detail-${s.invoice.id}`);
      closeDocTab(`edit-${s.invoice.id}`);
    }
  };

  // --- Small Settlement & Check Modals ---
  const defaultBankId = useMemo(
    () =>
      resolveDefaultAccountId(accounts, settings?.accountingDefaults, 'defaultBank') ||
      banks[0]?.id ||
      '',
    [accounts, settings?.accountingDefaults, banks]
  );

  const settleSummary = useMemo(
    () => (settleInvoiceId ? summaries.find((s) => s.invoice.id === settleInvoiceId) || null : null),
    [settleInvoiceId, summaries]
  );

  const openSettle = (s: InvoiceSettlementSummary, initialMethod: 'cash' | 'check' = 'cash') => {
    setSettleInvoiceId(s.invoice.id);
    setSettleMethod(initialMethod);
    const stageNum = s.linkedTransactions.length + s.linkedChecks.length + 1;
    setSettleAmountRaw(String(s.remaining > 0 ? s.remaining : s.invoice.amount));
    const today = getLocalDateISOString(new Date());
    setSettleDate(today);
    setSettleBankId(defaultBankId);
    setSettleDesc(
      s.invoice.kind === 'purchase'
        ? `پرداخت مرحله ${toPersianDigits(String(stageNum))} بابت فاکتور #${s.invoice.invoiceNumber} — ${contactName(s.invoice.contactId)}`
        : `دریافت مرحله ${toPersianDigits(String(stageNum))} بابت فاکتور #${s.invoice.invoiceNumber} — ${contactName(s.invoice.contactId)}`
    );
    setCheckNumber('');
    setCheckSayadId('');
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setCheckDueDate(getLocalDateISOString(due));
  };

  const handleSaveSettlement = async () => {
    if (!settleSummary) return;
    const amt = parseIntegerAmount(settleAmountRaw);
    if (amt <= 0) {
      await dialog.alert({ title: 'مبلغ نامعتبر', message: 'مبلغ پرداخت/دریافت باید بیشتر از صفر باشد.' });
      return;
    }
    if (!settleBankId) {
      await dialog.alert({ title: 'حساب بانکی', message: 'یک حساب بانکی یا صندوق انتخاب کنید.' });
      return;
    }
    const inv = settleSummary.invoice;

    if (settleMethod === 'check') {
      if (!checkNumber.trim()) {
        await dialog.alert({ title: 'شماره چک', message: 'شماره چک را وارد کنید.' });
        return;
      }
      if (onSaveCheck) {
        onSaveCheck({
          kind: inv.kind === 'purchase' ? 'payable' : 'receivable',
          checkNumber: checkNumber.trim(),
          sayadId: checkSayadId.trim() || undefined,
          contactId: inv.contactId,
          bankAccountId: settleBankId,
          invoiceId: inv.id,
          amount: amt,
          issueDate: settleDate,
          dueDate: checkDueDate || settleDate,
          status: 'pending',
          description:
            settleDesc.trim() ||
            `چک بابت فاکتور #${inv.invoiceNumber} — ${contactName(inv.contactId)}`,
        });
      }
      setSettleInvoiceId(null);
      return;
    }

    onSaveTx({
      type: inv.kind === 'purchase' ? 'expense' : 'income',
      date: settleDate,
      amount: amt,
      accountId: inv.accountId,
      bankAccountId: settleBankId,
      contactId: inv.contactId,
      description: settleDesc.trim() || `تسویه فاکتور #${inv.invoiceNumber}`,
      linkKind: 'invoice_settlement',
      invoiceId: inv.id,
    });
    setSettleInvoiceId(null);
  };

  const handleDeleteSettlementTx = async (txId: string) => {
    if (onDeleteTx) {
      onDeleteTx(txId);
    } else if (setTransactions) {
      setTransactions((prev) => prev.filter((t) => t.id !== txId));
    }
  };

  const handleDeleteLinkedCheck = async (checkId: string) => {
    if (setChecks) {
      setChecks((prev) => prev.filter((c) => c.id !== checkId));
    }
  };

  const openCheckForInvoice = (s: InvoiceSettlementSummary) => {
    setCheckInvoiceSummary(s);
    setCheckNumber('');
    setCheckAmountRaw(String(s.remaining > 0 ? s.remaining : s.invoice.amount));
    const today = getLocalDateISOString(new Date());
    setCheckIssueDate(today);
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setCheckDueDate(getLocalDateISOString(due));
    setCheckBankId(defaultBankId);
    setCheckDesc(`چک بابت فاکتور #${s.invoice.invoiceNumber} — ${contactName(s.invoice.contactId)}`);
  };

  const handleSaveCheckForInvoice = async () => {
    if (!checkInvoiceSummary || !onSaveCheck) return;
    const amt = parseIntegerAmount(checkAmountRaw);
    if (amt <= 0) {
      await dialog.alert({ title: 'مبلغ چک', message: 'مبلغ چک را وارد کنید.' });
      return;
    }
    if (!checkNumber.trim()) {
      await dialog.alert({ title: 'شماره چک', message: 'شماره چک را وارد کنید.' });
      return;
    }
    if (!checkBankId) {
      await dialog.alert({ title: 'بانک', message: 'بانک مرتبط با چک را انتخاب کنید.' });
      return;
    }
    const inv = checkInvoiceSummary.invoice;
    onSaveCheck({
      kind: inv.kind === 'purchase' ? 'payable' : 'receivable',
      checkNumber: checkNumber.trim(),
      contactId: inv.contactId,
      bankAccountId: checkBankId,
      invoiceId: inv.id,
      amount: amt,
      issueDate: checkIssueDate,
      dueDate: checkDueDate,
      status: 'pending',
      description: checkDesc.trim(),
    });
    setCheckInvoiceSummary(null);
  };

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      filtered.map((s) => ({
        نوع: s.invoice.kind === 'purchase' ? 'خرید / هزینه' : 'فروش / درآمد',
        'شماره فاکتور': s.invoice.invoiceNumber,
        تاریخ: formatJalaliShort(s.invoice.date),
        طرف‌حساب: contactName(s.invoice.contactId),
        سرفصل: getAccountById(accounts, s.invoice.accountId)?.name || '—',
        'تعداد اقلام': s.invoice.items?.length || 0,
        'مبلغ کل': s.invoice.amount,
        'تسویه‌شده': s.settledTotal,
        'مانده باز': s.remaining,
        شرح: s.invoice.description,
      })),
      'فاکتورها',
      'invoices-report'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    const rows = filtered.map((s) => [
      s.invoice.kind === 'purchase' ? 'خرید' : 'فروش',
      toPersianDigits(s.invoice.invoiceNumber),
      formatDateFa(s.invoice.date),
      contactName(s.invoice.contactId),
      getAccountById(accounts, s.invoice.accountId)?.name || '—',
      formatMoneyFa(s.invoice.amount),
      formatMoneyFa(s.settledTotal),
      formatMoneyFa(s.remaining),
    ]);
    await downloadTableReportPdf({
      title: 'گزارش فاکتورهای خرید و فروش',
      storeName,
      subtitle: `${toPersianDigits(String(filtered.length))} فاکتور`,
      pageSize,
      filename: `invoices-${pageSize}`,
      columns: [
        { header: 'نوع', width: 0.8, align: 'right' },
        { header: 'شماره', width: 0.8, align: 'right' },
        { header: 'تاریخ', width: 1.1, align: 'right' },
        { header: 'طرف‌حساب', width: 1.6, align: 'right' },
        { header: 'سرفصل', width: 1.4, align: 'right' },
        { header: 'مبلغ کل', width: 1.3, align: 'amount' },
        { header: 'تسویه‌شده', width: 1.2, align: 'amount' },
        { header: 'مانده باز', width: 1.2, align: 'amount' },
      ],
      rows,
      summary: [
        { label: 'جمع کل فاکتورها', value: formatMoneyFa(totalAmount) },
        { label: 'تسویه‌شده', value: formatMoneyFa(totalSettled) },
        { label: 'مانده باز', value: formatMoneyFa(totalRemaining) },
      ],
    });
  };

  const mdiTabs: MdiTabDescriptor[] = useMemo(
    () => [
      {
        id: 'list',
        title: 'فهرست فاکتورها',
        icon: List,
        accent: 'brand',
        pinned: true,
        badge: toPersianDigits(String(invoices.length)),
      },
      ...docTabs.map((t) => ({
        id: t.id,
        title: t.title,
        icon: t.kind === 'detail' ? Eye : FileText,
        accent: t.accent,
        dirty: t.kind === 'detail' ? false : t.dirty,
      })),
    ],
    [invoices.length, docTabs]
  );

  const isDocTabActive = activeTabId !== 'list';
  useHideMobileNavWhen(isDocTabActive);

  return (
    <div className="animate-page-enter space-y-3.5 sm:space-y-4 md:space-y-5" data-testid="invoices-page">
      {/* Header — hidden on mobile while a document tab is open so form starts immediately */}
      <div
        className={cn(
          'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
          isDocTabActive ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
            فاکتورهای خرید و فروش
          </h1>
          <p
            className={cn(
              'mt-0.5 text-xs font-medium text-[color:var(--muted)] md:text-sm',
              isDocTabActive && 'hidden xl:block'
            )}
          >
            ثبت هم‌زمان چند فاکتور در تب‌های مجزا متصل به کالاها و انبارها، تسویه نقدی/چکی و پیوست تصویر
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canCreate ? (
            <>
              <Button
                size="md"
                variant="secondary"
                icon={Plus}
                data-testid="invoice-add-purchase"
                onClick={() => openCreateTab('purchase')}
              >
                فاکتور خرید
              </Button>
              <Button
                size="md"
                icon={Plus}
                data-testid="invoice-add"
                onClick={() => openCreateTab('sale')}
              >
                فاکتور فروش جدید
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Contextual In-Module MDI Tabbed Pages */}
      <MdiTabWorkspace
        testId="invoices-mdi-workspace"
        tabs={mdiTabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={closeDocTab}
        stripActions={
          canCreate ? (
            <button
              type="button"
              onClick={() => openCreateTab()}
              title="باز کردن تب فاکتور جدید"
              aria-label="تب فاکتور جدید"
              data-testid="invoices-mdi-new-tab"
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-[color:var(--brand-soft)] px-2 sm:px-3 text-[11px] sm:text-xs font-extrabold text-[color:var(--brand)] transition hover:bg-[color:var(--brand)] hover:text-white"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">تب جدید</span>
              <span className="sm:hidden">جدید</span>
            </button>
          ) : null
        }
        renderTab={(tab, isActive) => {
          if (tab.id === 'list') {
            return (
              <div className="space-y-5">
                {/* KPI Strip */}
                <section className="grid gap-3.5 md:grid-cols-3 lg:gap-4">
                  <div className="balance-gradient relative overflow-hidden rounded-[1.5rem] p-5 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                          <FileText size={18} />
                        </span>
                        <p className="text-sm font-bold text-white/90">جمع کل فاکتورها</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHideAmount((v) => !v)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                        aria-label={hideAmount ? 'نمایش مبالغ' : 'پنهان‌سازی مبالغ'}
                      >
                        {hideAmount ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="mt-4 truncate text-[1.75rem] font-black tabular-nums tracking-tight">
                      {hideAmount ? '••••••••' : money(totalAmount)}
                      <span className="ms-2 text-xs font-bold text-white/80">تومان</span>
                    </p>
                    <p className="mt-2 text-xs font-semibold tabular-nums text-white/80">
                      {toPersianDigits(String(filtered.length))} فاکتور در فهرست
                    </p>
                  </div>

                  <div className="dash-card flex flex-col justify-between p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[color:var(--muted)]">تسویه‌شده (نقدی و چک)</p>
                        <p className="mt-2 truncate text-2xl font-black tabular-nums text-[color:var(--income)]">
                          {hideAmount ? '••••••' : money(totalSettled)}
                          <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
                        </p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tone-income">
                        <Wallet size={20} />
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-medium text-[color:var(--muted)]">
                      شامل واریزی‌های نقدی و چک‌های صادر/دریافت‌شده
                    </p>
                  </div>

                  <div className="dash-card flex flex-col justify-between p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[color:var(--muted)]">مانده باز فاکتورها</p>
                        <p className="mt-2 truncate text-2xl font-black tabular-nums text-[color:var(--expense)]">
                          {hideAmount ? '••••••' : money(totalRemaining)}
                          <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
                        </p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tone-expense">
                        <CreditCard size={20} />
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-medium text-[color:var(--muted)]">
                      مبلغ باقی‌مانده قابل پرداخت یا دریافت
                    </p>
                  </div>
                </section>

                {/* Main List Section */}
                <section className="space-y-3.5">
                  <div className="dash-card rounded-2xl p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1 sm:inline-flex sm:w-auto">
                      {(
                        [
                          { id: 'all', label: 'همه فاکتورها' },
                          { id: 'purchase', label: 'فاکتورهای خرید' },
                          { id: 'sale', label: 'فاکتورهای فروش' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setKindTab(t.id)}
                          className={cn(
                            'flex-1 shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition sm:flex-none sm:px-3.5 sm:text-xs',
                            kindTab === t.id
                              ? 'btn-brand-gradient text-white shadow-sm'
                              : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="relative inline-flex shrink-0">
                        <select
                          aria-label="فیلتر ماه فاکتورها"
                          value={period}
                          onChange={(e) => setPeriod(e.target.value)}
                          className="h-9 max-w-[10.5rem] appearance-none truncate rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 pe-7 ps-3 text-xs font-bold text-[color:var(--ink)] outline-none"
                        >
                          <option value="all">همه ماه‌ها</option>
                          {periodOptions.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={13}
                          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
                          aria-hidden
                        />
                      </span>

                      {filtered.length > 0 ? (
                        <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="journals.export" />
                      ) : null}
                    </div>
                  </div>

                  {/* Search & Filters */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    <div className="flex h-10 min-w-[12rem] flex-1 items-center gap-2.5 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 px-3.5 focus-within:border-[color:var(--brand)]">
                      <Search size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
                      <input
                        aria-label="جست‌وجو در فاکتورها"
                        className="h-full min-w-0 flex-1 bg-transparent text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="شماره فاکتور، کالا، نام شخص، سرفصل یا شرح..."
                      />
                    </div>

                    <span className="relative inline-flex shrink-0">
                      <select
                        aria-label="فیلتر طرف‌حساب"
                        value={contactFilter}
                        onChange={(e) => setContactFilter(e.target.value)}
                        className="h-10 max-w-[12rem] appearance-none truncate rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 pe-8 ps-3 text-xs font-bold text-[color:var(--ink)] outline-none"
                      >
                        <option value="">همه اشخاص</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
                        aria-hidden
                      />
                    </span>

                    <span className="relative inline-flex shrink-0">
                      <select
                        aria-label="فیلتر وضعیت تسویه"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="h-10 appearance-none rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 pe-8 ps-3 text-xs font-bold text-[color:var(--ink)] outline-none"
                      >
                        <option value="all">همه وضعیت‌ها</option>
                        <option value="unpaid">تسویه‌نشده</option>
                        <option value="partial">تسویه جزئی</option>
                        <option value="paid">تسویه‌شده</option>
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
                        aria-hidden
                      />
                      </span>
                    </div>
                  </div>

                  {invoices.length === 0 ? (
                    <EmptyState
                      title="هنوز فاکتوری ثبت نشده است"
                      description="فاکتورهای خرید و فروش را به‌صورت چندردیفه با انتخاب کالا و انبار ثبت کنید تا موجودی انبار و مانده هر طرف‌حساب دقیق محاسبه شود."
                      action={
                        canCreate ? (
                          <Button icon={Plus} onClick={() => openCreateTab('purchase')}>
                            ثبت اولین فاکتور
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : filtered.length === 0 ? (
                    <div className="dash-card rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm font-bold text-[color:var(--muted)]">
                      فاکتوری مطابق فیلترهای انتخابی پیدا نشد.
                    </div>
                  ) : (
                    <div className="space-y-2.5" data-testid="invoices-list">
                      {filtered.map((s) => {
                        const inv = s.invoice;
                        const accName = getAccountById(accounts, inv.accountId)?.name || 'سرفصل';
                        const whLabel = warehouseName(inv.warehouseId);
                        const pct =
                          inv.amount > 0 ? Math.min(100, Math.round((s.settledTotal / inv.amount) * 100)) : 0;
                        return (
                          <div
                            key={inv.id}
                            className="dash-card rounded-2xl p-4 transition hover:border-[color:var(--brand)]/35"
                            data-testid="invoice-card"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0 flex-1 space-y-1.5">
                                {/* Top line: Invoice identity + single semantic status + unboxed metadata */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span
                                    className={cn(
                                      'h-2 w-2 shrink-0 rounded-full',
                                      inv.kind === 'purchase' ? 'bg-rose-500' : 'bg-emerald-500'
                                    )}
                                    aria-hidden
                                  />
                                  <button
                                    type="button"
                                    onClick={() => openDetailTab(inv)}
                                    className="text-xs font-black text-[color:var(--ink)] transition hover:text-[color:var(--brand)] tabular-nums"
                                  >
                                    {inv.kind === 'purchase' ? 'فاکتور خرید' : 'فاکتور فروش'} #
                                    {toPersianDigits(inv.invoiceNumber)}
                                  </button>
                                  <StatusBadge status={s.status} />
                                  <span className="text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                                    {formatJalaliShort(inv.date)}
                                  </span>
                                  {inv.items && inv.items.length > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--muted)]">
                                      <span>·</span>
                                      <Package size={11} aria-hidden />
                                      <span className="tabular-nums">
                                        {toPersianDigits(String(inv.items.length))} قلم
                                      </span>
                                      {whLabel ? <span>({whLabel})</span> : null}
                                    </span>
                                  ) : null}
                                  {inv.attachment ? (
                                    <button
                                      type="button"
                                      onClick={() => setLightboxAtt(inv.attachment!)}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--brand)] hover:underline"
                                    >
                                      <span>·</span>
                                      <ImageIcon size={11} aria-hidden />
                                      پیوست
                                    </button>
                                  ) : null}
                                </div>

                                {/* Counterparty + Account + Description */}
                                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                  <h3 className="text-sm font-black text-[color:var(--ink)]">
                                    {contactName(inv.contactId)}
                                  </h3>
                                  <span className="text-xs font-bold text-[color:var(--brand)]">
                                    {accName}
                                  </span>
                                  {inv.description ? (
                                    <span className="max-w-full truncate text-xs text-[color:var(--muted)]">
                                      — {inv.description}
                                    </span>
                                  ) : null}
                                </div>

                                {/* Settlement Progress Strip */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[color:var(--surface-2)] sm:w-36">
                                    <div
                                      className={cn(
                                        'h-full rounded-full transition-all',
                                        s.status === 'paid'
                                          ? 'bg-emerald-500'
                                          : 'bg-[color:var(--brand)]'
                                      )}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-semibold tabular-nums text-[color:var(--muted)]">
                                    تسویه {hideAmount ? '••••' : money(s.settledTotal)} از{' '}
                                    {hideAmount ? '••••' : money(inv.amount)} تومان (
                                    {toPersianDigits(String(pct))}٪)
                                  </span>
                                </div>
                              </div>

                              {/* Left Financial Figure + Compact Actions */}
                              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)]/60 pt-2.5 lg:justify-end lg:border-t-0 lg:pt-0">
                                <div className="text-right lg:text-left">
                                  <p className="text-[10.5px] font-semibold text-[color:var(--muted)]">
                                    {s.remaining > 0 ? 'مانده باز' : 'مبلغ کل فاکتور'}
                                  </p>
                                  <p
                                    className={cn(
                                      'text-base font-black tabular-nums',
                                      s.remaining > 0
                                        ? 'text-[color:var(--expense)]'
                                        : 'text-[color:var(--income)]'
                                    )}
                                  >
                                    {hideAmount ? '••••••' : money(s.remaining > 0 ? s.remaining : inv.amount)}
                                    <span className="ms-1 text-[10px] font-semibold text-[color:var(--muted)]">
                                      تومان
                                    </span>
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={Eye}
                                    data-testid={`invoice-details-${inv.id}`}
                                    onClick={() => openDetailTab(inv)}
                                  >
                                    جزئیات
                                  </Button>

                                  {canCreate && s.remaining > 0 ? (
                                    <Button
                                      size="sm"
                                      icon={Wallet}
                                      data-testid={`invoice-settle-${inv.id}`}
                                      onClick={() => openSettle(s)}
                                    >
                                      {inv.kind === 'purchase' ? 'ثبت پرداخت' : 'ثبت دریافت'}
                                    </Button>
                                  ) : null}

                                  {canCreate && onSaveCheck && s.remaining > 0 ? (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      icon={FileSpreadsheet}
                                      onClick={() => openCheckForInvoice(s)}
                                    >
                                      ثبت چک
                                    </Button>
                                  ) : null}

                                  {canEdit ? (
                                    <IconButton
                                      icon={Pencil}
                                      label={`ویرایش فاکتور ${inv.invoiceNumber}`}
                                      size="sm"
                                      onClick={() => openEditTab(inv)}
                                    />
                                  ) : null}
                                  {canDelete ? (
                                    <IconButton
                                      icon={Trash2}
                                      label={`حذف فاکتور ${inv.invoiceNumber}`}
                                      size="sm"
                                      variant="soft-danger"
                                      onClick={() => void handleDeleteInvoice(s)}
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
              </div>
            );
          }

          const doc = docTabs.find((d) => d.id === tab.id);
          if (!doc) return null;

          if (doc.kind === 'create') {
            return (
              <InvoiceEditorTab
                tabId={doc.id}
                isActive={isActive}
                initialKind={doc.invoiceKind}
                nextInvoiceNumber={doc.nextNumber}
                accounts={accounts}
                contacts={contacts}
                contactGroups={contactGroups}
                warehouses={warehouses}
                products={products}
                allInvoices={invoices}
                transactions={transactions}
                checks={checks}
                settings={settings}
                onQuickCreateProduct={(p) => setProducts((prev) => [p, ...prev])}
                onSave={(inv, settlements) =>
                  handleSaveInvoiceFromTab(doc.id, inv, false, settlements)
                }
                onCancel={() => closeDocTab(doc.id)}
                onMetaChange={(meta) => updateDocTabMeta(doc.id, meta)}
              />
            );
          }

          if (doc.kind === 'edit') {
            const targetInv = invoices.find((i) => i.id === doc.invoiceId);
            if (!targetInv) {
              return (
                <EmptyState
                  title="این فاکتور حذف شده است"
                  action={<Button onClick={() => closeDocTab(doc.id)}>بستن تب</Button>}
                />
              );
            }
            return (
              <InvoiceEditorTab
                tabId={doc.id}
                isActive={isActive}
                initialKind={targetInv.kind}
                initialInvoice={targetInv}
                nextInvoiceNumber={targetInv.invoiceNumber}
                accounts={accounts}
                contacts={contacts}
                contactGroups={contactGroups}
                warehouses={warehouses}
                products={products}
                allInvoices={invoices}
                transactions={transactions}
                checks={checks}
                settings={settings}
                onQuickCreateProduct={(p) => setProducts((prev) => [p, ...prev])}
                onSave={(inv, settlements) =>
                  handleSaveInvoiceFromTab(doc.id, inv, true, settlements)
                }
                onCancel={() => closeDocTab(doc.id)}
                onMetaChange={(meta) => updateDocTabMeta(doc.id, meta)}
              />
            );
          }

          const summary = summaries.find((s) => s.invoice.id === doc.invoiceId);
          if (!summary) {
            return (
              <EmptyState
                title="این فاکتور در دسترس نیست"
                action={<Button onClick={() => closeDocTab(doc.id)}>بستن تب</Button>}
              />
            );
          }

          return (
            <InvoiceDetailTab
              isActive={isActive}
              summary={summary}
              accounts={accounts}
              contacts={contacts}
              warehouses={warehouses}
              canCreate={canCreate}
              canEdit={canEdit}
              onEdit={() => openEditTab(summary.invoice)}
              onSettle={() => openSettle(summary, 'cash')}
              onIssueCheck={onSaveCheck ? () => openSettle(summary, 'check') : undefined}
              onPreviewAttachment={(att) => setLightboxAtt(att)}
              onClose={() => closeDocTab(doc.id)}
            />
          );
        }}
      />

      {/* UNIFIED MODAL 1: Multi-Stage Settlement Payment / Receipt & Check Hub */}
      <FormSheet
        isOpen={Boolean(settleSummary)}
        onClose={() => setSettleInvoiceId(null)}
        title={
          settleSummary?.invoice.kind === 'purchase'
            ? 'ثبت پرداخت یا چک بابت فاکتور خرید'
            : 'ثبت دریافت یا چک بابت فاکتور فروش'
        }
        subtitle={
          settleSummary
            ? `فاکتور #${toPersianDigits(settleSummary.invoice.invoiceNumber)} (${contactName(settleSummary.invoice.contactId)}) · مانده باز: ${money(settleSummary.remaining)} تومان`
            : undefined
        }
        size="lg"
        accent={settleSummary?.invoice.kind === 'purchase' ? 'expense' : 'income'}
        footer={
          <FormActions
            onCancel={() => setSettleInvoiceId(null)}
            onSubmit={() => void handleSaveSettlement()}
            submitLabel={
              settleMethod === 'check'
                ? 'ثبت چک در فاکتور'
                : settleSummary?.invoice.kind === 'purchase'
                  ? 'ثبت مرحله پرداخت'
                  : 'ثبت مرحله دریافت'
            }
            submitIcon={Check}
          />
        }
      >
        <div className="space-y-4">
          {/* Live Settlement Summary Banner inside Modal */}
          {settleSummary ? (
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3 text-center text-xs">
              <div>
                <p className="text-[10.5px] font-bold text-[color:var(--muted)]">مبلغ کل فاکتور</p>
                <p className="mt-1 font-black tabular-nums text-[color:var(--ink)]">
                  {money(settleSummary.invoice.amount)}
                </p>
              </div>
              <div className="border-x border-[color:var(--line)] px-2">
                <p className="text-[10.5px] font-bold text-[color:var(--muted)]">تسویه‌شده تاکنون</p>
                <p className="mt-1 font-black tabular-nums text-[color:var(--income)]">
                  {money(settleSummary.settledTotal)}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] font-bold text-[color:var(--muted)]">مانده قابل تسویه</p>
                <p className="mt-1 font-black tabular-nums text-[color:var(--expense)]">
                  {money(settleSummary.remaining)}
                </p>
              </div>
            </div>
          ) : null}

          {/* Previous Stages Timeline if any exist */}
          {settleSummary &&
          (settleSummary.linkedTransactions.length > 0 || settleSummary.linkedChecks.length > 0) ? (
            <div className="space-y-1.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] p-3">
              <p className="text-[11px] font-extrabold text-[color:var(--muted)]">
                مراحل دریافت / پرداخت و چک‌های ثبت‌شده قبلی این فاکتور:
              </p>
              <div className="max-h-36 space-y-1.5 overflow-y-auto">
                {settleSummary.linkedTransactions.map((tx, idx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/40 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-[color:var(--ink)]">
                        مرحله نقدی #{toPersianDigits(String(idx + 1))} ({getAccountById(accounts, tx.bankAccountId)?.name || 'بانک'})
                      </span>
                      <span className="ms-2 text-[11px] tabular-nums text-[color:var(--muted)]">
                        {formatJalaliShort(tx.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black tabular-nums text-[color:var(--income)]">
                        {money(tx.amount)} تومان
                      </span>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteSettlementTx(tx.id)}
                          className="rounded-md p-1 text-[color:var(--muted)] hover:bg-rose-500/10 hover:text-[color:var(--expense)]"
                          title="حذف این مرحله"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {settleSummary.linkedChecks.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/40 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-[color:var(--ink)]">
                        چک #{toPersianDigits(ch.checkNumber)}
                      </span>
                      <span className="ms-2 text-[11px] tabular-nums text-[color:var(--muted)]">
                        سررسید {formatJalaliShort(ch.dueDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black tabular-nums text-[color:var(--brand)]">
                        {money(ch.amount)} تومان
                      </span>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteLinkedCheck(ch.id)}
                          className="rounded-md p-1 text-[color:var(--muted)] hover:bg-rose-500/10 hover:text-[color:var(--expense)]"
                          title="حذف این چک"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Method Switcher: Cash/Bank vs Check */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1">
            <button
              type="button"
              data-testid="invoice-settle-method-cash"
              onClick={() => setSettleMethod('cash')}
              className={cn(
                'h-10 rounded-xl text-xs font-extrabold transition',
                settleMethod === 'cash'
                  ? 'btn-brand-gradient text-white shadow-sm'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              نقد / واریز بانکی / کارت‌خوان
            </button>
            <button
              type="button"
              data-testid="invoice-settle-method-check"
              onClick={() => setSettleMethod('check')}
              className={cn(
                'h-10 rounded-xl text-xs font-extrabold transition',
                settleMethod === 'check'
                  ? 'btn-brand-gradient text-white shadow-sm'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              ثبت چک (دریافتی / پرداختی)
            </button>
          </div>

          <div className="space-y-2">
            <AmountInput
              label={settleMethod === 'check' ? 'مبلغ چک (تومان)' : 'مبلغ این مرحله (تومان)'}
              value={settleAmountRaw}
              onChange={setSettleAmountRaw}
              accent={settleSummary?.invoice.kind === 'purchase' ? 'expense' : 'income'}
              compact
            />
            {settleSummary && settleSummary.remaining > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-bold text-[color:var(--muted)]">انتخاب سریع مبلغ:</span>
                <button
                  type="button"
                  onClick={() => setSettleAmountRaw(String(settleSummary.remaining))}
                  className="rounded-lg bg-[color:var(--brand-soft)] px-2.5 py-1 font-extrabold text-[color:var(--brand)] transition hover:opacity-90"
                >
                  کل مانده ({money(settleSummary.remaining)})
                </button>
                {settleSummary.remaining >= 1000 ? (
                  <button
                    type="button"
                    onClick={() => setSettleAmountRaw(String(Math.round(settleSummary.remaining / 2)))}
                    className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-2.5 py-1 font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--surface-2)]"
                  >
                    ۵۰٪ مانده ({money(Math.round(settleSummary.remaining / 2))})
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {settleMethod === 'cash' ? (
            <div className="form-section grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel}>تاریخ پرداخت / دریافت</label>
                <PersianDatePicker value={settleDate} onChange={setSettleDate} />
              </div>
              <div>
                <label className={fieldLabel}>حساب بانکی / صندوق</label>
                <select
                  className={fieldInput}
                  value={settleBankId}
                  onChange={(e) => setSettleBankId(e.target.value)}
                >
                  <option value="">انتخاب بانک...</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>شرح مرحله تسویه</label>
                <input
                  className={fieldInput}
                  value={settleDesc}
                  onChange={(e) => setSettleDesc(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="form-section grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel}>شماره چک</label>
                <input
                  className={cn(fieldInput, 'tabular-nums')}
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="مثلاً ۶۵۴۳۲۱"
                />
              </div>
              <div>
                <label className={fieldLabel}>تاریخ سررسید چک</label>
                <PersianDatePicker value={checkDueDate} onChange={setCheckDueDate} />
              </div>
              <div>
                <label className={fieldLabel}>بانک مرتبط با چک</label>
                <select
                  className={fieldInput}
                  value={settleBankId}
                  onChange={(e) => setSettleBankId(e.target.value)}
                >
                  <option value="">انتخاب بانک...</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>شناسه صیاد (اختیاری)</label>
                <input
                  className={cn(fieldInput, 'tabular-nums')}
                  dir="ltr"
                  value={checkSayadId}
                  onChange={(e) => setCheckSayadId(e.target.value)}
                  placeholder="16-digit Sayad ID"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>شرح چک</label>
                <input
                  className={fieldInput}
                  value={settleDesc}
                  onChange={(e) => setSettleDesc(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </FormSheet>

      {/* SMALL MODAL 2: Quick Issue Check for Invoice */}
      <FormSheet
        isOpen={Boolean(checkInvoiceSummary)}
        onClose={() => setCheckInvoiceSummary(null)}
        title={
          checkInvoiceSummary?.invoice.kind === 'purchase'
            ? 'صدور چک پرداختی بابت فاکتور'
            : 'ثبت چک دریافتی بابت فاکتور'
        }
        subtitle={
          checkInvoiceSummary
            ? `فاکتور #${toPersianDigits(checkInvoiceSummary.invoice.invoiceNumber)} · مانده: ${money(checkInvoiceSummary.remaining)} تومان`
            : undefined
        }
        size="md"
        accent="brand"
        footer={
          <FormActions
            onCancel={() => setCheckInvoiceSummary(null)}
            onSubmit={() => void handleSaveCheckForInvoice()}
            submitLabel="ثبت چک"
            submitIcon={Check}
          />
        }
      >
        <div className="space-y-4">
          <AmountInput
            label="مبلغ چک (تومان)"
            value={checkAmountRaw}
            onChange={setCheckAmountRaw}
            accent="brand"
            compact
          />
          <div className="form-section grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div>
              <label className={fieldLabel}>شماره چک</label>
              <input
                className={cn(fieldInput, 'tabular-nums')}
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="مثلاً ۶۵۴۳۲۱"
              />
            </div>
            <div>
              <label className={fieldLabel}>بانک مرتبط</label>
              <select
                className={fieldInput}
                value={checkBankId}
                onChange={(e) => setCheckBankId(e.target.value)}
              >
                <option value="">انتخاب بانک...</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>تاریخ سررسید</label>
              <PersianDatePicker value={checkDueDate} onChange={setCheckDueDate} />
            </div>
            <div className="sm:col-span-2">
              <CollapsibleOptionalSection
                title="تاریخ صدور و شرح چک (اختیاری)"
                filledCount={countFilledFields([checkDesc])}
                mobileOnly
              >
                <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className={fieldLabel}>تاریخ صدور</label>
                    <PersianDatePicker value={checkIssueDate} onChange={setCheckIssueDate} />
                  </div>
                  <div>
                    <label className={fieldLabel}>شرح چک</label>
                    <input
                      className={fieldInput}
                      value={checkDesc}
                      onChange={(e) => setCheckDesc(e.target.value)}
                    />
                  </div>
                </div>
              </CollapsibleOptionalSection>
            </div>
          </div>
        </div>
      </FormSheet>

      <AttachmentLightbox
        attachment={lightboxAtt}
        alt={lightboxAtt?.name || 'پیش‌نمایش'}
        onClose={() => setLightboxAtt(null)}
      />
    </div>
  );
};

export default InvoicesPage;
