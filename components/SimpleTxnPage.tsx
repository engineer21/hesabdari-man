import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  Coins,
  Droplets,
  Eye,
  EyeOff,
  Home,
  List,
  Package,
  Paperclip,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sprout,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import type {
  Account,
  AppSettings,
  CheckItem,
  Contact,
  ContactGroup,
  Invoice,
  Transaction,
  TransactionType,
} from '../types';
import { getAccountById, getAccountPathLabel, getBankAccounts } from '../utils/accountTree';
import { shortBankName } from '../utils/bankBrand';
import { contactLabel } from '../utils/contactStats';
import {
  formatNumberWithCommas,
  toPersianDigits,
  getLocalDateISOString,
} from '../utils/formatters';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatDateFa,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { APP_NAME } from '../constants';
import AttachmentLightbox from './ui/AttachmentLightbox';
import { BankLogo } from './ui/BankLogo';
import { ExportActions } from './export/ExportActions';
import { TxnEditorTab } from './txn/TxnEditorTab';
import { useHideMobileNavWhen } from '../hooks/useFormWorkspace';
import {
  Button,
  EmptyState,
  IconButton,
  MdiTabWorkspace,
  type MdiTabDescriptor,
  cn,
} from './ui';
import MiniSparkline from './dashboard/MiniSparkline';
import { useDialog } from './DialogProvider';
import { useCan } from '../hooks/useSessionAuth';

interface SimpleTxnPageProps {
  mode: 'income' | 'expense';
  accounts: Account[];
  transactions: Transaction[];
  contactGroups: ContactGroup[];
  contacts: Contact[];
  invoices?: Invoice[];
  checks?: CheckItem[];
  onSave: (tx: Omit<Transaction, 'id'> | Transaction) => void;
  onSaveCheck?: (ch: Omit<CheckItem, 'id'> | CheckItem) => void;
  onDelete: (id: string) => void;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  settings?: AppSettings;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));
const FA_JALALI_DATE = new Intl.DateTimeFormat('fa-IR-u-ca-persian');
const FA_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

const jalaliKey = (iso: string): { y: number; m: number } => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date(`${iso}T12:00:00`));
  const num = (t: string) =>
    Number((parts.find((p) => p.type === t)?.value || '').replace(/[^\d]/g, '') || 0);
  return { y: num('year'), m: num('month') };
};

const jalaliLabel = (y: number, m: number) =>
  `${FA_MONTHS[m - 1] || ''} ${toPersianDigits(y)}`.trim();

const CURRENT_PERIOD_KEY = (() => {
  const k = jalaliKey(getLocalDateISOString(new Date()));
  return `${k.y}-${k.m}`;
})();

const CHIP_TONES = ['tone-brand', 'tone-info', 'tone-warning', 'tone-income'];
const chipTone = (i: number) => CHIP_TONES[i % CHIP_TONES.length];

const CAT_ICONS: [RegExp, React.ComponentType<{ size?: number; className?: string }>][] = [
  [/اجاره|دفتر/, Home],
  [/حقوق|پرسنل/, Users],
  [/خرید|مواد|پسته/, ShoppingCart],
  [/آب|برق|گاز|انرژی/, Zap],
  [/حمل|نقل|ترانزیت/, Truck],
  [/تعمیر|نگهداری/, Wrench],
  [/بسته/, Package],
  [/کود|سم|کشاورزی|باغ/, Sprout],
  [/خشک/, Droplets],
];
const catIcon = (name: string) => CAT_ICONS.find(([re]) => re.test(name))?.[1] ?? Tag;

function ChipSelect({
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
        className="h-10 max-w-[11.5rem] appearance-none truncate rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 pe-8 ps-3.5 text-xs font-bold text-[color:var(--ink)] shadow-xs outline-none transition hover:border-[color:var(--brand)]/35 focus-visible:border-[color:var(--brand)]"
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

function FilterChip({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  key?: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-bold transition active:scale-[0.97]',
        active
          ? 'btn-brand-gradient border-transparent text-white'
          : 'border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/88 text-[color:var(--ink)] shadow-xs hover:border-[color:var(--brand)]/30'
      )}
    >
      {children}
      {active ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
    </button>
  );
}

const SimpleTxnPage: React.FC<SimpleTxnPageProps> = ({
  mode,
  accounts,
  transactions,
  contactGroups,
  contacts,
  invoices = [],
  checks = [],
  onSave,
  onSaveCheck,
  onDelete,
  autoOpen,
  onAutoOpenConsumed,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canCreate = can('journals.create');
  const canEdit = can('journals.edit');
  const canDelete = can('journals.delete');
  const type: TransactionType = mode;
  const title = mode === 'income' ? 'درآمدها' : 'هزینه‌ها';
  const banks = getBankAccounts(accounts);
  const storeName = settings?.name || APP_NAME;

  const [query, setQuery] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [kindTab, setKindTab] = useState<'all' | 'direct' | 'settlement' | 'other'>('all');
  const [period, setPeriod] = useState<string>(CURRENT_PERIOD_KEY);
  const [hideAmount, setHideAmount] = useState(false);
  const [chipsOpen, setChipsOpen] = useState(false);
  const [showAllMobile, setShowAllMobile] = useState(false);

  const list = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.type === type)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, type]
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

  const periodList = useMemo(
    () =>
      list.filter((tx) => {
        if (period === 'all') return true;
        const k = jalaliKey(tx.date);
        return `${k.y}-${k.m}` === period;
      }),
    [list, period]
  );

  const catOptions = useMemo(
    () =>
      accounts.filter(
        (a) => a.kind === 'postable' && a.module === mode && a.isActive !== false
      ),
    [accounts, mode]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return periodList.filter((tx) => {
      if (bankFilter && tx.bankAccountId !== bankFilter) return false;
      if (catFilter && tx.accountId !== catFilter) return false;
      if (kindTab === 'direct' && Boolean(tx.linkKind)) return false;
      if (kindTab === 'settlement' && tx.linkKind !== 'invoice_settlement') return false;
      if (
        kindTab === 'other' &&
        (!tx.linkKind || tx.linkKind === 'invoice_settlement')
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        tx.description || '',
        contactLabel(contacts, contactGroups, tx.contactId) || '',
        getAccountById(accounts, tx.bankAccountId)?.name || '',
        getAccountPathLabel(accounts, tx.accountId),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [periodList, bankFilter, catFilter, kindTab, query, contacts, contactGroups, accounts]);

  const total = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);
  const count = filtered.length;
  const avg = count > 0 ? Math.round(total / count) : 0;
  const maxTx = useMemo(
    () =>
      filtered.reduce<Transaction | null>(
        (best, t) => (!best || t.amount > best.amount ? t : best),
        null
      ),
    [filtered]
  );

  const hasActiveFilter = Boolean(query.trim() || bankFilter || catFilter || kindTab !== 'all');
  const mobileCollapsed = !showAllMobile && !hasActiveFilter && filtered.length > 8;
  const visibleRows = mobileCollapsed ? filtered.slice(0, 8) : filtered;
  const showViewAll = !hasActiveFilter && filtered.length > 8;

  const heroLabel = useMemo(() => {
    const noun = mode === 'income' ? 'درآمد' : 'هزینه';
    if (period === 'all') return `جمع ${mode === 'income' ? 'درآمدها' : 'هزینه‌ها'}`;
    if (period === CURRENT_PERIOD_KEY) return `${noun} این ماه`;
    const opt = periodOptions.find((o) => o.key === period);
    return `${noun} ${opt ? opt.label : ''}`.trim();
  }, [mode, period, periodOptions]);

  const sparkValues = useMemo(() => {
    if (mode !== 'expense' || filtered.length < 2) return [];
    const sums = new Map<string, number>();
    for (const t of filtered) sums.set(t.date, (sums.get(t.date) || 0) + t.amount);
    const vals = [...sums.keys()].sort().slice(-10).map((k) => sums.get(k) || 0);
    const max = Math.max(...vals, 1);
    return vals.map((v) => v / max);
  }, [filtered, mode]);

  const contactById = (id: string | undefined) =>
    id ? contacts.find((c) => c.id === id) : undefined;
  const bankNameOf = (id: string) => getAccountById(accounts, id)?.name || '—';

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      filtered.map((tx) => ({
        تاریخ: tx.date,
        شرح: tx.description,
        مبلغ: tx.amount,
        سرفصل: getAccountPathLabel(accounts, tx.accountId),
        بانک: getAccountById(accounts, tx.bankAccountId)?.name || '',
        شخص: contactLabel(contacts, contactGroups, tx.contactId) || '',
      })),
      title,
      `${mode}-list`
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    const compact = pageSize === 'a5';
    const filteredTotal = filtered.reduce((s, t) => s + t.amount, 0);
    const rows = filtered.map((tx) => {
      const person = contactLabel(contacts, contactGroups, tx.contactId);
      const bank = getAccountById(accounts, tx.bankAccountId)?.name || '';
      const account = getAccountPathLabel(accounts, tx.accountId);
      if (compact) {
        const desc = [tx.description || '—', person, bank].filter((x) => x && x !== '—').join(' · ');
        return [formatDateFa(tx.date), desc, formatMoneyFa(tx.amount)];
      }
      const party = [person, bank].filter(Boolean).join(' · ') || '—';
      return [formatDateFa(tx.date), tx.description || '—', account, party, formatMoneyFa(tx.amount)];
    });

    await downloadTableReportPdf({
      title: `گزارش ${title}`,
      storeName,
      subtitle: `${toPersianDigits(String(filtered.length))} ردیف`,
      pageSize,
      filename: `${mode}-list-${pageSize}`,
      columns: compact
        ? [
            { header: 'تاریخ', width: 1.2, align: 'right' },
            { header: 'شرح', width: 4, align: 'right' },
            { header: 'مبلغ', width: 1.4, align: 'amount' },
          ]
        : [
            { header: 'تاریخ', width: 1.1, align: 'right' },
            { header: 'شرح', width: 2.4, align: 'right' },
            { header: 'سرفصل', width: 2.2, align: 'right' },
            { header: 'شخص / بانک', width: 1.8, align: 'right' },
            { header: 'مبلغ', width: 1.3, align: 'amount' },
          ],
      rows,
      summary: [
        { label: 'تعداد', value: toPersianDigits(String(filtered.length)) },
        { label: 'جمع مبلغ', value: formatMoneyFa(filteredTotal) },
      ],
    });
  };

  type TxnMdiTab = {
    id: string;
    kind: 'create' | 'edit';
    title: string;
    tx?: Transaction;
    dirty?: boolean;
  };

  const [openTabs, setOpenTabs] = useState<TxnMdiTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('list');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const openCreateTab = () => {
    if (banks.length === 0) return;
    const seq = openTabs.filter((t) => t.kind === 'create').length + 1;
    const id = `new_${Date.now()}_${seq}`;
    const baseLabel = mode === 'income' ? 'درآمد جدید' : 'هزینه جدید';
    const label = seq > 1 ? `${baseLabel} (${toPersianDigits(String(seq))})` : baseLabel;
    setOpenTabs((prev) => [...prev, { id, kind: 'create', title: label, dirty: false }]);
    setActiveTabId(id);
  };

  const openEditTab = (tx: Transaction) => {
    const tabId = `edit_${tx.id}`;
    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      const shortDesc = (tx.description || (mode === 'income' ? 'درآمد' : 'هزینه')).slice(0, 18);
      return [
        ...prev,
        {
          id: tabId,
          kind: 'edit',
          title: `ویرایش: ${shortDesc}`,
          tx,
          dirty: false,
        },
      ];
    });
    setActiveTabId(tabId);
  };

  const closeTab = (tabId: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        const fallback = next[Math.max(0, idx - 1)]?.id || 'list';
        setActiveTabId(fallback);
      }
      return next;
    });
  };

  const handleCloseTabRequest = async (tabId: string) => {
    const target = openTabs.find((t) => t.id === tabId);
    if (target?.dirty) {
      const ok = await dialog.confirm({
        title: 'بستن تب بدون ذخیره',
        message: 'تغییرات ذخیره‌نشده در این تب وجود دارد. آیا مطمئن هستید؟',
        tone: 'warning',
        confirmLabel: 'بستن تب',
      });
      if (!ok) return;
    }
    closeTab(tabId);
  };

  const setTabDirty = (tabId: string, dirty: boolean) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.id === tabId && t.dirty !== dirty ? { ...t, dirty } : t))
    );
  };

  React.useEffect(() => {
    if (!autoOpen) return;
    if (banks.length > 0) openCreateTab();
    onAutoOpenConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const isEditorTabActive = activeTabId !== 'list';
  useHideMobileNavWhen(isEditorTabActive);

  const remove = async (tx: Transaction) => {
    const ok = await dialog.confirm({
      title: 'حذف تراکنش',
      message: 'این ثبت حذف شود؟',
      tone: 'danger',
      confirmLabel: 'حذف',
    });
    if (ok) {
      onDelete(tx.id);
      closeTab(`edit_${tx.id}`);
    }
  };

  const openEdit = (tx: Transaction) => {
    openEditTab(tx);
  };

  const askDelete = (tx: Transaction) => {
    void remove(tx);
  };

  const clearFilters = () => {
    setQuery('');
    setBankFilter('');
    setCatFilter('');
    setKindTab('all');
    setPeriod('all');
  };

  const resolveTxnPrimaryTitle = (tx: Transaction): string => {
    const desc = (tx.description || '').trim();
    const leafName = getAccountById(accounts, tx.accountId)?.name || '';
    if (desc && desc !== 'هزینه' && desc !== 'درآمد') {
      return desc;
    }
    if (leafName) {
      return desc && desc !== leafName ? `${leafName} (${desc})` : leafName;
    }
    return desc || (mode === 'income' ? 'درآمد ثبت‌شده' : 'هزینه ثبت‌شده');
  };

  const mdiTabs: MdiTabDescriptor[] = useMemo(
    () => [
      {
        id: 'list',
        title: mode === 'income' ? 'فهرست درآمدها' : 'فهرست هزینه‌ها',
        icon: List,
        accent: mode,
        pinned: true,
        badge: toPersianDigits(String(filtered.length)),
      },
      ...openTabs.map((t) => ({
        id: t.id,
        title: t.title,
        icon: t.kind === 'edit' ? Pencil : Plus,
        accent: mode,
        pinned: false,
        dirty: t.dirty,
      })),
    ],
    [mode, filtered.length, openTabs]
  );

  const renderAvatar = (tx: Transaction, index: number) => {
    const contact = contactById(tx.contactId);
    if (contact?.picture) {
      return <img src={contact.picture} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
    }
    if (contact?.fullName) {
      return (
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black',
            chipTone(index)
          )}
          aria-hidden
        >
          {contact.fullName.trim().charAt(0)}
        </span>
      );
    }
    const leafName = getAccountById(accounts, tx.accountId)?.name || '';
    const CatIconComp = catIcon(leafName);
    return (
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black',
          mode === 'income' ? 'tone-income' : 'tone-expense'
        )}
        aria-hidden
      >
        <CatIconComp size={16} />
      </span>
    );
  };

  const linkBadge = (tx: Transaction): string | null => {
    switch (tx.linkKind) {
      case 'invoice_settlement': {
        if (tx.invoiceId) {
          const inv = invoices.find((i) => i.id === tx.invoiceId);
          return inv
            ? `تسویه فاکتور #${toPersianDigits(inv.invoiceNumber)}`
            : 'تسویه فاکتور';
        }
        return 'تسویه صورتحساب شخص';
      }
      case 'payroll_payment':
        return 'پرداخت حقوق';
      case 'check_clearing':
        return 'پاس چک';
      case 'loan_disbursement':
        return 'واریز اصل وام';
      case 'loan_principal':
        return 'اصل قسط وام';
      case 'loan_interest':
        return 'سود وام';
      default:
        return null;
    }
  };

  return (
    <div className="animate-page-enter space-y-3.5 sm:space-y-5 md:space-y-6">
      {/* Header Row — hidden on mobile when an MDI document tab is active so first field lands above fold */}
      <div
        className={cn(
          'flex-wrap items-center justify-between gap-3',
          isEditorTabActive ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
              {mode === 'income' ? 'درآمدها و دریافت‌ها' : 'هزینه‌ها و پرداخت‌ها'}
            </h1>
            {mode === 'income' ? (
              <TrendingUp size={19} className="text-[color:var(--income)] md:hidden" />
            ) : null}
          </div>
          <p
            className={cn(
              'mt-0.5 text-xs font-medium text-[color:var(--muted)] md:text-sm',
              isEditorTabActive && 'hidden xl:block'
            )}
          >
            {mode === 'income'
              ? 'فهرست، جست‌وجو و ثبت دریافت‌های نقدی، تسویه فاکتورهای فروش و صورتحساب اشخاص'
              : 'فهرست، جست‌وجو و ثبت هزینه‌های مستقیم، تسویه فاکتورهای خرید و پرداخت به اشخاص'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ChipSelect
            testId="txn-period"
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
              disabled={banks.length === 0}
              data-testid="txn-add"
              onClick={openCreateTab}
            >
              {mode === 'income' ? 'ثبت درآمد / دریافت' : 'ثبت هزینه / پرداخت'}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Contextual MDI Tabbed Workspace (List pinned + parallel Income/Expense tabs) */}
      <MdiTabWorkspace
        testId={`txn-mdi-${mode}`}
        tabs={mdiTabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={(id) => void handleCloseTabRequest(id)}
        stripActions={
          canCreate && banks.length > 0 ? (
            <button
              type="button"
              data-testid={`txn-mdi-new-${mode}`}
              aria-label={mode === 'income' ? 'تب جدید درآمد' : 'تب جدید هزینه'}
              onClick={openCreateTab}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-2 sm:px-2.5 text-[11px] font-extrabold text-[color:var(--brand)] transition hover:border-[color:var(--brand)]/40 hover:bg-[color:var(--brand-soft)]"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">تب جدید</span>
              <span className="sm:hidden">جدید</span>
            </button>
          ) : undefined
        }
        renderTab={(tab, isActive) => {
          if (tab.id !== 'list') {
            const tabObj = openTabs.find((t) => t.id === tab.id);
            if (!tabObj) return null;
            return (
              <TxnEditorTab
                mode={mode}
                isActive={isActive}
                accounts={accounts}
                banks={banks}
                contactGroups={contactGroups}
                contacts={contacts}
                invoices={invoices}
                checks={checks}
                transactions={transactions}
                settings={settings}
                initialTransaction={tabObj.tx || null}
                onDirtyChange={(dirty) => setTabDirty(tabObj.id, dirty)}
                onCancel={() => void handleCloseTabRequest(tabObj.id)}
                onSave={(payload) => {
                  onSave(payload);
                  closeTab(tabObj.id);
                }}
                onSaveCheck={
                  onSaveCheck
                    ? (checkPayload) => {
                        onSaveCheck(checkPayload);
                        closeTab(tabObj.id);
                      }
                    : undefined
                }
              />
            );
          }

          return (
            <div className="space-y-5 md:space-y-6">
              {/* KPI Row: 1 col mobile, 2 cols tablet, 3 cols desktop */}
              <section className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
                {mode === 'income' ? (
                  <div
                    className="balance-gradient rounded-[1.5rem] p-5 text-white md:col-span-2 lg:col-span-1"
                    data-testid="txn-hero"
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
                          <Coins size={19} />
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
                      data-testid="txn-total"
                      className="relative mt-4 truncate text-[1.85rem] font-black tabular-nums tracking-tight"
                    >
                      {hideAmount ? '••••••••' : money(total)}
                      <span className="ms-2 text-xs font-bold text-white/80">تومان</span>
                    </p>
                    <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold tabular-nums">
                      {toPersianDigits(String(count))} دریافت
                    </span>
                  </div>
                ) : (
                  <div
                    className="kpi-expense-card rounded-[1.5rem] p-5 md:col-span-2 lg:col-span-1"
                    data-testid="txn-hero"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[color:var(--muted)]">{heroLabel}</p>
                        <p
                          data-testid="txn-total"
                          className="mt-2 truncate text-[1.85rem] font-black tabular-nums tracking-tight text-[color:var(--ink)]"
                        >
                          {money(total)}
                          <span className="ms-2 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
                        </p>
                      </div>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tone-expense">
                        <ShoppingCart size={20} />
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--expense-soft)] px-3 py-1 text-[11px] font-bold tabular-nums text-[color:var(--expense)]">
                        {toPersianDigits(String(count))} پرداخت
                      </span>
                      <MiniSparkline values={sparkValues} tone="expense" />
                    </div>
                  </div>
                )}

                <div className="dash-card hidden p-5 md:flex md:flex-col md:justify-between" data-testid="txn-count">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[color:var(--muted)]">
                        {mode === 'income' ? 'تعداد دریافت‌ها' : 'تعداد پرداخت‌ها'}
                      </p>
                      <p className="mt-2 text-3xl font-black tabular-nums text-[color:var(--ink)]">
                        {toPersianDigits(String(count))}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                        mode === 'income' ? 'tone-info' : 'tone-income'
                      )}
                    >
                      {mode === 'income' ? <Users size={20} /> : <Wallet size={20} />}
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
                    {mode === 'income' ? 'تراکنش ثبت‌شده در بازه' : 'پرداخت در بازه انتخاب‌شده'}
                  </p>
                </div>

                {mode === 'income' ? (
                  <div className="dash-card hidden p-5 md:flex md:flex-col md:justify-between" data-testid="txn-avg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[color:var(--muted)]">میانگین دریافت</p>
                        <p className="mt-2 truncate text-2xl font-black tabular-nums text-[color:var(--ink)]">
                          {money(avg)}
                          <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
                        </p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tone-income">
                        <BarChart3 size={20} />
                      </div>
                    </div>
                    <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">
                      متوسط هر فقره دریافت در بازه
                    </p>
                  </div>
                ) : (
                  <div className="dash-card hidden p-5 md:flex md:flex-col md:justify-between" data-testid="txn-max">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[color:var(--muted)]">بیشترین هزینه</p>
                        <p className="mt-2 truncate text-base font-black text-[color:var(--ink)]">
                          {maxTx ? resolveTxnPrimaryTitle(maxTx) : '—'}
                        </p>
                        <p className="mt-1 truncate text-lg font-black tabular-nums text-[color:var(--expense)]">
                          {maxTx ? money(maxTx.amount) : '۰'}
                          <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">تومان</span>
                        </p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tone-expense">
                        <Tag size={20} />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {banks.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)] px-4 py-3.5 text-sm text-[color:var(--warning)]">
                  هنوز بانکی ندارید. <span className="font-black">از منوی بانک‌ها</span> یک حساب بسازید تا بتوانید ثبت کنید.
                </div>
              ) : null}

              {/* Main List Section (Structured Filter Card + Elevated Row Cards matching ChecksPage / LoansPage) */}
              <section className="space-y-3.5" data-testid="txn-list-card">
                {/* Filter & Search Toolbar Card */}
                <div className="dash-card rounded-2xl p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl tone-brand">
                          <List size={16} />
                        </span>
                        <h2 className="text-base font-extrabold text-[color:var(--ink)]">
                          فهرست {mode === 'income' ? 'درآمدها و دریافت‌ها' : 'هزینه‌ها و پرداخت‌ها'}
                        </h2>
                        <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[color:var(--muted)]">
                          {toPersianDigits(String(filtered.length))} مورد
                        </span>
                      </div>

                      {/* Segmented Document Type Tabs (like ChecksPage) */}
                      <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/70 p-1 sm:inline-flex sm:w-auto">
                        {(
                          [
                            { id: 'all', label: 'همه موارد' },
                            {
                              id: 'direct',
                              label: mode === 'income' ? 'درآمد مستقیم' : 'هزینه مستقیم',
                            },
                            { id: 'settlement', label: 'تسویه فاکتور و شخص' },
                            { id: 'other', label: 'چک، وام و حقوق' },
                          ] as const
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setKindTab(t.id)}
                            className={cn(
                              'flex-1 shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition sm:flex-none sm:px-3 sm:text-xs',
                              kindTab === t.id
                                ? 'btn-brand-gradient text-white shadow-sm'
                                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid="txn-filter-toggle"
                        aria-label="فیلترهای سریع"
                        aria-pressed={chipsOpen}
                        onClick={() => setChipsOpen((v) => !v)}
                        className={cn(
                          'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition md:hidden',
                          chipsOpen
                            ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                            : 'border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 text-[color:var(--ink)]'
                        )}
                      >
                        <SlidersHorizontal size={14} />
                        فیلتر سریع
                      </button>
                      {list.length > 0 ? (
                        <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="journals.export" />
                      ) : null}
                    </div>
                  </div>

                  {/* Search & Dropdown Filters */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                    <div className="flex h-10 min-w-[13rem] flex-1 items-center gap-2.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/90 px-3.5 shadow-xs transition focus-within:border-[color:var(--brand)] focus-within:ring-4 focus-within:ring-[color:var(--brand)]/10">
                      <Search size={16} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
                      <input
                        data-testid="txn-search"
                        aria-label="جست‌وجو در فهرست"
                        className="h-full min-w-0 flex-1 bg-transparent text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={
                          mode === 'income'
                            ? 'جست‌وجوی شرح، نام طرف‌حساب، سرفصل یا بانک...'
                            : 'جست‌وجوی شرح هزینه، نام طرف‌حساب، سرفصل یا بانک...'
                        }
                      />
                    </div>

                    <ChipSelect
                      testId="txn-bank-filter"
                      label="فیلتر حساب بانکی"
                      value={bankFilter}
                      onChange={setBankFilter}
                      options={[
                        { value: '', label: 'همه حساب‌ها' },
                        ...banks.map((b) => ({ value: b.id, label: b.name })),
                      ]}
                    />

                    <ChipSelect
                      testId="txn-cat-filter"
                      label="فیلتر سرفصل"
                      value={catFilter}
                      onChange={setCatFilter}
                      options={[
                        { value: '', label: 'همه سرفصل‌ها' },
                        ...catOptions.map((a) => ({ value: a.id, label: a.name })),
                      ]}
                    />
                  </div>

                  {/* Mobile Quick Filter Chips */}
                  {chipsOpen ? (
                    <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto border-t border-[color:var(--line)]/60 pt-3 md:hidden">
                      <FilterChip
                        active={bankFilter === '' && catFilter === ''}
                        onClick={() => {
                          setBankFilter('');
                          setCatFilter('');
                        }}
                      >
                        همه
                      </FilterChip>
                      {banks.map((b) => (
                        <FilterChip
                          key={b.id}
                          active={bankFilter === b.id}
                          onClick={() => setBankFilter(bankFilter === b.id ? '' : b.id)}
                          ariaLabel={b.name}
                        >
                          <BankLogo name={b.name} size="xs" />
                          {shortBankName(b.name)}
                        </FilterChip>
                      ))}
                      {catOptions.slice(0, 8).map((a) => {
                        const Icon = catIcon(a.name);
                        return (
                          <FilterChip
                            key={a.id}
                            active={catFilter === a.id}
                            onClick={() => setCatFilter(catFilter === a.id ? '' : a.id)}
                            ariaLabel={a.name}
                          >
                            <Icon size={13} />
                            {a.name}
                          </FilterChip>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                {/* Transaction Row-Cards List (matching ChecksPage & LoansPage) */}
                {list.length === 0 ? (
                  <EmptyState
                    title="هنوز ثبتی نیست"
                    description="با دکمه ثبت بالا یا + پایین صفحه اولین دریافت یا پرداخت خود را ثبت کنید."
                  />
                ) : filtered.length === 0 ? (
                  <div className="dash-card rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center">
                    <p className="text-sm font-bold text-[color:var(--ink)]">ثبتی با این فیلترها پیدا نشد.</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-3 inline-flex h-9 items-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-4 text-xs font-bold text-[color:var(--brand)]"
                    >
                      پاک‌کردن فیلترها
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5" data-testid="txn-rows">
                    {visibleRows.map((tx, i) => {
                      const contact = contactById(tx.contactId);
                      const bankName = bankNameOf(tx.bankAccountId);
                      const primaryTitle = resolveTxnPrimaryTitle(tx);
                      const accountPath = getAccountPathLabel(accounts, tx.accountId);
                      const badgeText = linkBadge(tx);
                      const jalaliDate = FA_JALALI_DATE.format(new Date(`${tx.date}T12:00:00`));

                      return (
                        <div
                          key={tx.id}
                          data-testid="txn-card"
                          className="dash-card rounded-2xl p-4 transition hover:border-[color:var(--brand)]/35"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            {/* Right Side: Avatar + Badges + Title + Counterparty/Bank + Account Path */}
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              {renderAvatar(tx, i)}

                              <div className="min-w-0 flex-1 space-y-1.5">
                                {/* Top Metadata Line */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={cn(
                                      'rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
                                      badgeText
                                        ? 'tone-brand'
                                        : mode === 'income'
                                          ? 'tone-income'
                                          : 'tone-expense'
                                    )}
                                  >
                                    {badgeText || (mode === 'income' ? 'درآمد مستقیم' : 'هزینه مستقیم')}
                                  </span>

                                  <span
                                    data-testid="txn-status"
                                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--income-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--income)]"
                                  >
                                    <Check size={11} strokeWidth={3} />
                                    {mode === 'income' ? 'دریافت شد' : 'پرداخت شد'}
                                  </span>

                                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                                    {jalaliDate}
                                  </span>

                                  {tx.attachment?.path ? (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewSrc(tx.attachment!.path)}
                                      className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--brand)] transition hover:opacity-85"
                                    >
                                      <Paperclip size={11} />
                                      مشاهده رسید
                                    </button>
                                  ) : null}
                                </div>

                                {/* Main Title + Counterparty + Bank */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <h3 className="text-sm font-black text-[color:var(--ink)] sm:text-[15px]">
                                    {primaryTitle}
                                  </h3>

                                  {contact ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--surface-2)]/90 px-2.5 py-0.5 text-xs font-extrabold text-[color:var(--ink)]">
                                      <Users size={12} className="text-[color:var(--brand)]" />
                                      طرف‌حساب: {contact.fullName}
                                    </span>
                                  ) : null}

                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--muted)]">
                                    <BankLogo name={bankName} size="xs" />
                                    {bankName}
                                  </span>
                                </div>

                                {/* Account Hierarchy Path */}
                                <p className="truncate text-xs font-medium text-[color:var(--muted)]">
                                  سرفصل: {accountPath}
                                </p>
                              </div>
                            </div>

                            {/* Left Side: Amount + Direct Action Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)]/60 pt-2.5 lg:justify-end lg:border-t-0 lg:pt-0">
                              <p
                                className={cn(
                                  'text-base font-black tabular-nums sm:text-lg',
                                  tx.type === 'income'
                                    ? 'text-[color:var(--income)]'
                                    : 'text-[color:var(--expense)]'
                                )}
                              >
                                {tx.type === 'income' ? '+' : '-'}
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
                                      label="ویرایش تراکنش"
                                      size="sm"
                                      onClick={() => openEdit(tx)}
                                    />
                                  ) : null}
                                  {canDelete ? (
                                    <IconButton
                                      icon={Trash2}
                                      label="حذف تراکنش"
                                      size="sm"
                                      variant="soft-danger"
                                      onClick={() => askDelete(tx)}
                                    />
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {showViewAll ? (
                      <div className="pt-1 text-center">
                        <button
                          type="button"
                          data-testid="txn-view-all"
                          onClick={() => setShowAllMobile((v) => !v)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-5 text-xs font-extrabold text-[color:var(--brand)] shadow-xs transition hover:border-[color:var(--brand)]/40"
                        >
                          {showAllMobile
                            ? 'نمایش کمتر'
                            : `مشاهده همه (${toPersianDigits(String(filtered.length))} مورد)`}
                          <ArrowLeft size={13} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            </div>
          );
        }}
      />

      {previewSrc ? (
        <AttachmentLightbox src={previewSrc} onClose={() => setPreviewSrc(null)} />
      ) : null}
    </div>
  );
};

export default SimpleTxnPage;
