import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowDownUp,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  FileBarChart,
  Landmark,
  Layers,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Vault,
  Wallet,
  WalletCards,
} from 'lucide-react';
import type {
  Account,
  AppSettings,
  Contact,
  ContactGroup,
  Transaction,
  TreasuryAccountType,
} from '../types';
import { APP_NAME } from '../constants';
import { getAccountById, getBankAccounts, nextChildCode } from '../utils/accountTree';
import {
  CASHBOX_PRESETS,
  IRANIAN_BANKS_ONLY,
  PETTY_CASH_PRESETS,
  TREASURY_TYPE_META,
  detectBankBrand,
  maskAccountNumber,
  resolveTreasuryType,
  shortBankName,
} from '../utils/bankBrand';
import { computeBankBalance } from '../utils/accountBalance';
import { contactLabel } from '../utils/contactStats';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import {
  WorkspaceHeader,
  Button,
  CollapsibleOptionalSection,
  FormSheet,
  StoreMark,
  fieldInput,
  fieldLabel,
  AmountInput,
  FormActions,
  IconButton,
  cn,
} from './ui';
import { countFilledFields } from '../utils/formLayout';
import { BankLogo } from './ui/BankLogo';
import { formatNumberWithCommas, toPersianDigits, parseIntegerAmount } from '../utils/formatters';
import { ExportActions } from './export/ExportActions';
import { useDialog } from './DialogProvider';

interface BanksPageProps {
  accounts: Account[];
  setAccounts: (value: Account[] | ((v: Account[]) => Account[])) => void;
  transactions: Transaction[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  onOpenReport: (accountId: string) => void;
  onOpenTransfer?: (fromBankId?: string) => void;
  settings?: AppSettings;
}

type TypeFilter = 'all' | TreasuryAccountType;

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));
const FA_JALALI_DATE = new Intl.DateTimeFormat('fa-IR-u-ca-persian');
const CHIP_TONES = ['tone-brand', 'tone-info', 'tone-warning', 'tone-income'];
const chipTone = (i: number) => CHIP_TONES[i % CHIP_TONES.length];

const TYPE_OPTIONS: {
  id: TreasuryAccountType;
  label: string;
  short: string;
  desc: string;
  icon: typeof Landmark;
  activeRing: string;
  iconTone: string;
}[] = [
  {
    id: 'bank',
    label: 'حساب بانکی',
    short: 'بانک',
    desc: 'جاری، کارت‌خوان و بانکی',
    icon: Landmark,
    activeRing: 'border-[color:var(--brand)] bg-[color:var(--brand-soft)]/70 text-[color:var(--brand)] shadow-xs',
    iconTone: 'tone-brand',
  },
  {
    id: 'cashbox',
    label: 'صندوق نقدی',
    short: 'صندوق',
    desc: 'فروشگاه، دفتر و شعب',
    icon: Vault,
    activeRing: 'border-[color:var(--income)] bg-[color:var(--income-soft)]/70 text-[color:var(--income)] shadow-xs',
    iconTone: 'tone-income',
  },
  {
    id: 'pettyCash',
    label: 'تنخواه‌گردان',
    short: 'تنخواه',
    desc: 'پرسنل، خرید و پروژه',
    icon: WalletCards,
    activeRing: 'border-[color:var(--warning)] bg-[color:var(--warning-soft)]/70 text-[color:var(--warning)] shadow-xs',
    iconTone: 'tone-warning',
  },
];

function ChipSelect({
  value,
  onChange,
  label,
  options,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
  testId?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <select
        data-testid={testId}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 max-w-[13rem] appearance-none truncate rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] pe-8 ps-3 text-xs font-bold text-[color:var(--ink)] shadow-[var(--shadow-sm)] outline-none transition focus-visible:border-[color:var(--brand)]"
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

const BanksPage: React.FC<BanksPageProps> = ({
  accounts,
  setAccounts,
  transactions,
  contacts,
  contactGroups,
  onOpenReport,
  onOpenTransfer,
  settings,
}) => {
  const dialog = useDialog();
  const banks = getBankAccounts(accounts);
  const storeName = settings?.name || APP_NAME;

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [treasuryType, setTreasuryType] = useState<TreasuryAccountType>('bank');
  const [name, setName] = useState('');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [openingStr, setOpeningStr] = useState('0');
  const [hideAmount, setHideAmount] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moveFilter, setMoveFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canTransfer = banks.length >= 2 && Boolean(onOpenTransfer);

  const breakdown = useMemo(() => {
    const res = {
      total: 0,
      bank: { count: 0, balance: 0 },
      cashbox: { count: 0, balance: 0 },
      pettyCash: { count: 0, balance: 0 },
    };
    for (const b of banks) {
      const bal = computeBankBalance(b, transactions);
      const t = resolveTreasuryType(b);
      res.total += bal;
      res[t].count += 1;
      res[t].balance += bal;
    }
    return res;
  }, [banks, transactions]);

  const filteredBanks = useMemo(
    () =>
      typeFilter === 'all'
        ? banks
        : banks.filter((b) => resolveTreasuryType(b) === typeFilter),
    [banks, typeFilter]
  );

  const bankTx = useMemo(() => {
    const ids = new Set(banks.map((b) => b.id));
    return transactions
      .filter(
        (t) => ids.has(t.bankAccountId) || (t.type === 'transfer' && ids.has(t.accountId))
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, banks]);

  const recentTx = useMemo(() => bankTx.slice(0, 6), [bankTx]);
  const moveList = useMemo(
    () =>
      moveFilter
        ? bankTx.filter(
            (t) =>
              t.bankAccountId === moveFilter ||
              (t.type === 'transfer' && t.accountId === moveFilter)
          )
        : bankTx,
    [bankTx, moveFilter]
  );

  const contactById = (id: string | undefined) =>
    id ? contacts.find((c) => c.id === id) : undefined;
  const accountById = (id: string) => getAccountById(accounts, id);
  const bankNameOf = (id: string) => accountById(id)?.name || '—';

  const partyOf = (tx: Transaction) => {
    if (tx.type === 'transfer') {
      return `انتقال به ${shortBankName(bankNameOf(tx.accountId))}`;
    }
    const person = contactLabel(contacts, contactGroups, tx.contactId);
    if (person) return person;
    const catName = accountById(tx.accountId)?.name;
    if (catName) return catName;
    return tx.type === 'income' ? 'درآمد مستقیم' : 'هزینه مستقیم';
  };

  const resolveDirection = (tx: Transaction): 'in' | 'out' | 'transfer' => {
    if (tx.type === 'income') return 'in';
    if (tx.type === 'expense') return 'out';
    if (moveFilter) {
      if (tx.accountId === moveFilter && tx.bankAccountId !== moveFilter) return 'in';
      if (tx.bankAccountId === moveFilter) return 'out';
    }
    return 'transfer';
  };

  const signedClass = (tx: Transaction) => {
    const dir = resolveDirection(tx);
    if (dir === 'in') return 'text-[color:var(--income)]';
    if (dir === 'out') return 'text-[color:var(--expense)]';
    return 'text-[color:var(--info)]';
  };

  const signedValue = (tx: Transaction) => {
    const dir = resolveDirection(tx);
    if (dir === 'in') return `+${money(tx.amount)}`;
    if (dir === 'out') return `-${money(tx.amount)}`;
    return money(tx.amount);
  };

  const copyNumber = (id: string, num?: string) => {
    if (!num) return;
    navigator.clipboard?.writeText(num).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  };

  const handleExcel = async () => {
    await downloadRowsAsExcel(
      banks.map((b) => {
        const t = resolveTreasuryType(b);
        return {
          کد: b.code,
          نوع: TREASURY_TYPE_META[t].label,
          نام: b.name,
          'عنوان / محل': b.accountTitle || '',
          'شعبه / مسئول': b.holderName || '',
          'شماره حساب': b.accountNumber || '',
          'مانده اول دوره': b.openingBalance || 0,
          موجودی: computeBankBalance(b, transactions),
        };
      }),
      'بانک‌ها و صندوق‌ها',
      'treasury-accounts'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    const compact = pageSize === 'a5';
    const rows = banks.map((b) => {
      const t = resolveTreasuryType(b);
      if (compact) {
        return [b.name, TREASURY_TYPE_META[t].shortLabel, formatMoneyFa(computeBankBalance(b, transactions))];
      }
      return [
        b.code,
        TREASURY_TYPE_META[t].label,
        b.name,
        formatMoneyFa(b.openingBalance || 0),
        formatMoneyFa(computeBankBalance(b, transactions)),
      ];
    });
    await downloadTableReportPdf({
      title: 'گزارش بانک‌ها و صندوق‌ها',
      storeName,
      subtitle: `${toPersianDigits(String(banks.length))} حساب و صندوق فعال`,
      pageSize,
      filename: `treasury-${pageSize}`,
      columns: compact
        ? [
            { header: 'عنوان', width: 2.6, align: 'right' },
            { header: 'نوع', width: 1, align: 'right' },
            { header: 'موجودی', width: 1.6, align: 'amount' },
          ]
        : [
            { header: 'کد', width: 0.9, align: 'right' },
            { header: 'نوع', width: 1.3, align: 'right' },
            { header: 'نام بانک / صندوق', width: 2.3, align: 'right' },
            { header: 'اول دوره', width: 1.5, align: 'amount' },
            { header: 'موجودی', width: 1.5, align: 'amount' },
          ],
      rows,
      summary: [
        { label: 'تعداد کل', value: toPersianDigits(String(banks.length)) },
        { label: 'جمع موجودی خزانه', value: formatMoneyFa(breakdown.total) },
      ],
    });
  };

  const openNew = (initialType: TreasuryAccountType = 'bank') => {
    setEditId(null);
    setTreasuryType(initialType);
    setName('');
    setAccountTitle('');
    setAccountNumber('');
    setHolderName('');
    setOpeningStr('0');
    setOpen(true);
  };

  const openEdit = (b: Account) => {
    setEditId(b.id);
    setTreasuryType(resolveTreasuryType(b));
    setName(b.name);
    setAccountTitle(b.accountTitle || '');
    setAccountNumber(b.accountNumber || '');
    setHolderName(b.holderName || '');
    setOpeningStr(String(b.openingBalance || 0));
    setOpen(true);
  };

  const handleTypeSwitch = (nextType: TreasuryAccountType) => {
    if (nextType === treasuryType) return;
    setTreasuryType(nextType);
    if (!editId) {
      // Clear preset-mismatched names only when creating new
      const isOldPreset =
        IRANIAN_BANKS_ONLY.some((b) => b.fullName === name) ||
        CASHBOX_PRESETS.includes(name) ||
        PETTY_CASH_PRESETS.includes(name);
      if (isOldPreset) setName('');
      if (nextType !== 'bank') setAccountNumber('');
    }
  };

  const save = async () => {
    if (!name.trim()) {
      await dialog.alert({
        title: `نام ${TREASURY_TYPE_META[treasuryType].shortLabel}`,
        message: `لطفاً نام ${TREASURY_TYPE_META[treasuryType].label} را وارد کنید.`,
      });
      return;
    }
    const opening = parseIntegerAmount(openingStr, true);
    const extra: Partial<Account> = {
      treasuryType,
      accountTitle: accountTitle.trim() || undefined,
      accountNumber: treasuryType === 'bank' ? accountNumber.replace(/\s/g, '') || undefined : undefined,
      holderName: holderName.trim() || undefined,
    };

    if (editId) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editId
            ? { ...a, name: name.trim(), openingBalance: opening, ...extra }
            : a
        )
      );
    } else {
      const prefix =
        treasuryType === 'cashbox'
          ? 'acc_cash'
          : treasuryType === 'pettyCash'
            ? 'acc_petty'
            : 'acc_bank';
      setAccounts((prev) => [
        ...prev,
        {
          id: `${prefix}_${crypto.randomUUID().slice(0, 8)}`,
          code: nextChildCode(prev, 'acc_bank'),
          name: name.trim(),
          parentId: 'acc_bank',
          kind: 'postable',
          module: 'bank',
          isActive: true,
          openingBalance: opening,
          ...extra,
        },
      ]);
    }
    setOpen(false);
  };

  const renderAvatar = (tx: Transaction, index: number) => {
    if (tx.type === 'transfer') {
      return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full tone-info">
          <ArrowLeftRight size={15} aria-hidden />
        </span>
      );
    }
    const contact = contactById(tx.contactId);
    const label = partyOf(tx);
    if (contact?.picture) {
      return (
        <img
          src={contact.picture}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--line)]"
        />
      );
    }
    return (
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black',
          chipTone(index)
        )}
        aria-hidden
      >
        {label.trim().charAt(0)}
      </span>
    );
  };

  const renderCardMenu = (b: Account) =>
    menuFor === b.id ? (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} aria-hidden />
        <div className="absolute left-2 top-12 z-50 w-44 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-elevated)] py-1.5 shadow-[var(--shadow-lg)]">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--surface-2)]"
            onClick={() => {
              setMenuFor(null);
              onOpenReport(b.id);
            }}
          >
            <FileBarChart size={15} className="text-[color:var(--muted)]" />
            گزارش گردش حساب
          </button>
          {canTransfer ? (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[color:var(--info)] transition hover:bg-[color:var(--surface-2)]"
              onClick={() => {
                setMenuFor(null);
                onOpenTransfer?.(b.id);
              }}
            >
              <ArrowLeftRight size={15} />
              انتقال از این حساب
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[color:var(--ink)] transition hover:bg-[color:var(--surface-2)]"
            onClick={() => {
              setMenuFor(null);
              openEdit(b);
            }}
          >
            <Pencil size={15} className="text-[color:var(--muted)]" />
            ویرایش مشخصات
          </button>
        </div>
      </>
    ) : null;

  const previewAmount = parseIntegerAmount(openingStr, true);
  const previewBrand = detectBankBrand(name, treasuryType);
  const previewTypeMeta = TREASURY_TYPE_META[treasuryType];
  const previewSubtitle =
    treasuryType === 'bank'
      ? [accountTitle.trim(), holderName.trim() ? `شعبه ${holderName.trim()}` : ''].filter(Boolean).join(' · ') ||
        'حساب بانکی فعال'
      : treasuryType === 'cashbox'
        ? [accountTitle.trim(), holderName.trim() ? `مسئول: ${holderName.trim()}` : ''].filter(Boolean).join(' · ') ||
          'صندوق نقدی فعال'
        : [holderName.trim() ? `تنخواه‌دار: ${holderName.trim()}` : '', accountTitle.trim()].filter(Boolean).join(' · ') ||
          'تنخواه‌گردان فعال';

  const modalTitle = editId
    ? `ویرایش ${previewTypeMeta.label}`
    : `افزودن ${previewTypeMeta.label}`;
  const modalSubtitle =
    treasuryType === 'bank'
      ? 'مشخصات حساب بانکی را وارد یا بانک را از فهرست انتخاب کنید'
      : treasuryType === 'cashbox'
        ? 'صندوق نقدی جدید برای دریافت و پرداخت‌های نقدی تعریف کنید'
        : 'تنخواه‌گردان برای هزینه‌های جاری، خرید یا پروژه‌ها ثبت کنید';

  return (
    <div className="animate-page-enter mx-auto max-w-6xl space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="بانک‌ها و صندوق‌ها"
        subtitle="مدیریت یکپارچه حساب‌های بانکی، صندوق‌های نقدی و تنخواه‌گردان"
        actions={
          <div className="flex items-center gap-2">
            {canTransfer ? (
              <span className="hidden md:inline-flex">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ArrowLeftRight}
                  data-testid="bank-transfer-desktop"
                  onClick={() => onOpenTransfer?.()}
                >
                  انتقال بین حساب‌ها
                </Button>
              </span>
            ) : null}
            {banks.length > 0 ? (
              <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="reports.export" />
            ) : null}
          </div>
        }
        primaryAction={
          <Button size="sm" icon={Plus} data-testid="bank-add" onClick={() => openNew('bank')}>
            حساب یا صندوق جدید
          </Button>
        }
      />

      {/* Hero: Verdict Row + Treasury Type Breakdown */}
      {banks.length > 0 ? (
        <div
          className="balance-gradient relative overflow-hidden rounded-[1.5rem] px-5 py-5 text-white shadow-[0_22px_48px_-16px_rgba(10,95,243,0.48)] sm:px-7 sm:py-6"
          data-testid="bank-hero"
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 600 220"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M-30 165 C 120 115, 290 185, 640 92"
              stroke="rgba(56,225,255,0.34)"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M-30 192 C 150 142, 340 212, 640 125"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>

          <div className="relative flex items-start justify-between gap-2">
            <span className="dash-icon-glow flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm">
              <Wallet size={20} strokeWidth={1.85} />
            </span>
            <button
              type="button"
              onClick={() => setHideAmount((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              aria-label={hideAmount ? 'نمایش مبلغ' : 'پنهان‌سازی مبلغ'}
            >
              {hideAmount ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative mt-1 flex flex-col items-center text-center">
            <p className="text-xs font-bold tracking-tight text-white/80 sm:text-sm">
              موجودی کل خزانه (بانک‌ها و صندوق‌ها)
            </p>
            <p
              data-testid="bank-total"
              className="mt-1.5 flex items-baseline justify-center gap-2 text-3xl font-black tabular-nums tracking-tight sm:text-4xl"
            >
              <span>{hideAmount ? '••••••••' : money(breakdown.total)}</span>
              <span className="text-sm font-semibold text-white/80">تومان</span>
            </p>
          </div>

          {/* 3-Part Live Treasury Breakdown */}
          <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {(
              [
                { id: 'bank', label: 'حساب بانکی', short: 'بانک', icon: Landmark, stat: breakdown.bank },
                { id: 'cashbox', label: 'صندوق نقدی', short: 'صندوق', icon: Vault, stat: breakdown.cashbox },
                { id: 'pettyCash', label: 'تنخواه‌گردان', short: 'تنخواه', icon: WalletCards, stat: breakdown.pettyCash },
              ] as const
            ).map((seg) => {
              const SegIcon = seg.icon;
              const isSelected = typeFilter === seg.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setTypeFilter((prev) => (prev === seg.id ? 'all' : seg.id))}
                  className={cn(
                    'rounded-2xl border px-2.5 py-2.5 text-right transition backdrop-blur-md sm:px-3.5',
                    isSelected
                      ? 'border-white/55 bg-white/25 shadow-sm'
                      : 'border-white/15 bg-white/10 hover:bg-white/18'
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-white/90 sm:gap-1.5 sm:text-xs">
                      <SegIcon size={12} className="hidden shrink-0 opacity-90 sm:block" />
                      <span className="sm:hidden">{seg.short}</span>
                      <span className="hidden truncate sm:inline">{seg.label}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-white/18 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums">
                      {toPersianDigits(String(seg.stat.count))}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[11px] font-black tabular-nums text-white sm:text-sm">
                    {hideAmount ? '••••' : money(seg.stat.balance)}{' '}
                    <span className="hidden text-[10px] font-semibold text-white/75 sm:inline">تومان</span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Empty State: Principled 3-Type Onboarding Grid */}
      {banks.length === 0 ? (
        <section className="dash-card p-6 text-center sm:p-8" data-testid="treasury-empty-state">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl tone-brand">
            <Wallet size={26} />
          </div>
          <h2 className="mt-4 text-lg font-black text-[color:var(--ink)]">
            هنوز حساب بانکی یا صندوقی ثبت نشده است
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-6 text-[color:var(--muted)] sm:text-sm">
            نوع حساب خزانه خود را انتخاب کنید تا بتوانید درآمد، هزینه و انتقال بین حساب‌ها را با دقت کامل ثبت کنید.
          </p>

          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`empty-add-${opt.id}`}
                  onClick={() => openNew(opt.id)}
                  className="group flex flex-col items-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 p-5 text-center shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[color:var(--brand)]/45 hover:shadow-[var(--shadow-md)]"
                >
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-105',
                      opt.iconTone
                    )}
                  >
                    <Icon size={22} />
                  </span>
                  <span className="mt-3 text-sm font-black text-[color:var(--ink)]">
                    {opt.label}
                  </span>
                  <span className="mt-1 text-[11px] font-medium text-[color:var(--muted)]">
                    {opt.desc}
                  </span>
                  <span className="mt-3.5 inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-3 py-1 text-[11px] font-extrabold text-[color:var(--brand)] transition group-hover:bg-[color:var(--brand)] group-hover:text-white">
                    <Plus size={12} />
                    ثبت {opt.short}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          {/* Filter Bar + Quick Add Shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] p-1 shadow-[var(--shadow-sm)] sm:inline-flex sm:w-auto">
              {(
                [
                  { id: 'all', label: 'همه', count: banks.length },
                  { id: 'bank', label: 'بانک‌ها', count: breakdown.bank.count },
                  { id: 'cashbox', label: 'صندوق‌ها', count: breakdown.cashbox.count },
                  { id: 'pettyCash', label: 'تنخواه', count: breakdown.pettyCash.count },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-bold transition sm:px-3',
                    typeFilter === tab.id
                      ? 'btn-brand-gradient text-white'
                      : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
                      typeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-[color:var(--surface-2)]'
                    )}
                  >
                    {toPersianDigits(String(tab.count))}
                  </span>
                </button>
              ))}
            </div>

            <div className="hidden items-center gap-1.5 sm:flex">
              <button
                type="button"
                onClick={() => openNew('cashbox')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3 py-2 text-xs font-bold text-[color:var(--income)] transition hover:border-[color:var(--income)]/40 hover:bg-[color:var(--income-soft)]/50"
              >
                <Vault size={14} />
                + صندوق نقدی
              </button>
              <button
                type="button"
                onClick={() => openNew('pettyCash')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3 py-2 text-xs font-bold text-[color:var(--warning)] transition hover:border-[color:var(--warning)]/40 hover:bg-[color:var(--warning-soft)]/50"
              >
                <WalletCards size={14} />
                + تنخواه‌گردان
              </button>
            </div>
          </div>

          {filteredBanks.length === 0 ? (
            <div className="dash-card flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-extrabold text-[color:var(--ink)]">
                موردی در دسته «{typeFilter === 'all' ? 'همه' : TREASURY_TYPE_META[typeFilter].label}» ثبت نشده است
              </p>
              <Button
                size="sm"
                icon={Plus}
                className="mt-3"
                onClick={() => openNew(typeFilter === 'all' ? 'bank' : typeFilter)}
              >
                افزودن {typeFilter === 'all' ? 'حساب یا صندوق' : TREASURY_TYPE_META[typeFilter].label}
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop & Tablet: Frosted Treasury Cards */}
              <div
                className="hidden gap-3.5 md:grid md:grid-cols-2 xl:grid-cols-3"
                data-testid="bank-cards"
              >
                {filteredBanks.map((b) => {
                  const bal = computeBankBalance(b, transactions);
                  const tType = resolveTreasuryType(b);
                  const typeMeta = TREASURY_TYPE_META[tType];
                  const brand = detectBankBrand(b.name, tType);
                  const mask = tType === 'bank' ? maskAccountNumber(b.accountNumber) : '';
                  const subtitle =
                    [b.accountTitle, b.holderName ? (tType === 'bank' ? `شعبه ${b.holderName}` : b.holderName) : '']
                      .filter(Boolean)
                      .join(' · ') || `کد حساب ${toPersianDigits(b.code)}`;

                  return (
                    <div
                      key={b.id}
                      className="dash-card relative flex flex-col justify-between overflow-hidden p-4 transition hover:border-[color:var(--brand)]/35"
                      data-testid="bank-card"
                    >
                      {/* Subtle Brand Accent Top Hairline */}
                      <span
                        className="pointer-events-none absolute inset-x-4 top-0 h-[3px] rounded-b-full opacity-80"
                        style={{ backgroundColor: brand.primaryColor }}
                        aria-hidden
                      />

                      <div className="flex items-start gap-3 pt-1">
                        <BankLogo name={b.name} treasuryType={tType} size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[15px] font-extrabold text-[color:var(--ink)]">
                              {b.name}
                            </p>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-medium text-[color:var(--muted)]">
                            {subtitle}
                          </p>
                        </div>
                        <IconButton
                          icon={MoreVertical}
                          label="گزینه‌های حساب"
                          size="sm"
                          onClick={() => setMenuFor(menuFor === b.id ? null : b.id)}
                        />
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={cn(
                              'mb-1.5 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-extrabold',
                              typeMeta.toneClass
                            )}
                          >
                            {typeMeta.label}
                          </span>
                          <p className="truncate text-2xl font-black tabular-nums text-[color:var(--ink)]">
                            {hideAmount ? '••••••' : money(bal)}
                            <span className="ms-1.5 text-xs font-semibold text-[color:var(--muted)]">
                              تومان
                            </span>
                          </p>
                        </div>
                        {mask ? (
                          <button
                            type="button"
                            onClick={() => copyNumber(b.id, b.accountNumber)}
                            title="کپی شماره حساب"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--surface-2)] px-2 py-1 text-[11px] font-bold tabular-nums tracking-wider text-[color:var(--muted)] transition hover:text-[color:var(--brand)]"
                            dir="ltr"
                          >
                            {copiedId === b.id ? (
                              <Check size={12} className="text-[color:var(--income)]" />
                            ) : (
                              <Copy size={11} className="opacity-70" />
                            )}
                            <span>{mask}</span>
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[color:var(--line)] pt-3">
                        <button
                          type="button"
                          onClick={() => onOpenReport(b.id)}
                          aria-label="گزارش حساب"
                          className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-3.5 py-1.5 text-xs font-bold text-[color:var(--brand)] transition hover:opacity-90"
                        >
                          گردش حساب
                          <ChevronLeft size={13} aria-hidden />
                        </button>
                        <div className="flex items-center gap-1">
                          {canTransfer ? (
                            <IconButton
                              icon={ArrowLeftRight}
                              label="انتقال از این حساب"
                              size="sm"
                              onClick={() => onOpenTransfer?.(b.id)}
                            />
                          ) : null}
                          <IconButton
                            icon={Pencil}
                            label="ویرایش"
                            size="sm"
                            onClick={() => openEdit(b)}
                          />
                        </div>
                      </div>
                      {renderCardMenu(b)}
                    </div>
                  );
                })}
              </div>

              {/* Mobile: spacious 2-tier treasury cards + transfer CTA */}
              <div className="md:hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={17} className="text-[color:var(--brand)]" />
                    <h2 className="text-base font-extrabold text-[color:var(--ink)]">حساب‌ها و صندوق‌ها</h2>
                  </div>
                  <span className="text-xs font-bold text-[color:var(--muted)]">
                    {toPersianDigits(String(filteredBanks.length))} مورد
                  </span>
                </div>

                <div className="mt-3 space-y-2.5" data-testid="bank-rows-mobile">
                  {filteredBanks.map((b) => {
                    const bal = computeBankBalance(b, transactions);
                    const tType = resolveTreasuryType(b);
                    const typeMeta = TREASURY_TYPE_META[tType];
                    const mask = tType === 'bank' ? maskAccountNumber(b.accountNumber) : '';
                    const subtitle =
                      [b.accountTitle, b.holderName ? (tType === 'bank' ? `شعبه ${b.holderName}` : b.holderName) : '']
                        .filter(Boolean)
                        .join(' · ') || typeMeta.label;
                    return (
                      <div key={b.id} className="dash-card relative p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <BankLogo name={b.name} treasuryType={tType} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-extrabold text-[color:var(--ink)]">
                                {b.name}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] font-medium text-[color:var(--muted)]">
                                {subtitle}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-left">
                            <p className="text-sm font-black tabular-nums text-[color:var(--ink)]">
                              {hideAmount ? '••••' : money(bal)}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold text-[color:var(--muted)]">
                              تومان
                            </p>
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[color:var(--line)]/70 pt-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold',
                                typeMeta.toneClass
                              )}
                            >
                              {typeMeta.shortLabel}
                            </span>
                            {mask ? (
                              <span
                                dir="ltr"
                                className="truncate text-[10.5px] font-bold tabular-nums tracking-wider text-[color:var(--muted)]"
                              >
                                {mask}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenReport(b.id)}
                              aria-label="گزارش حساب"
                              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-2.5 py-1 text-[10.5px] font-bold text-[color:var(--brand)] transition hover:opacity-90"
                            >
                              گردش حساب
                              <ChevronLeft size={12} aria-hidden />
                            </button>
                            <IconButton
                              icon={MoreVertical}
                              label="گزینه‌ها"
                              size="sm"
                              onClick={() => setMenuFor(menuFor === b.id ? null : b.id)}
                            />
                          </div>
                        </div>
                        {renderCardMenu(b)}
                      </div>
                    );
                  })}
                </div>

                {canTransfer ? (
                  <button
                    type="button"
                    onClick={() => onOpenTransfer?.()}
                    data-testid="bank-transfer-mobile"
                    className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/60 bg-gradient-to-l from-emerald-50 via-cyan-50 to-sky-50 px-4 py-3.5 text-sm font-extrabold text-teal-800 shadow-[var(--shadow-sm)] transition hover:brightness-98 active:scale-[0.99] dark:border-cyan-500/30 dark:from-emerald-950/50 dark:via-cyan-950/50 dark:to-sky-950/50 dark:text-cyan-200"
                  >
                    <ArrowLeftRight size={17} aria-hidden />
                    انتقال بین حساب‌ها
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenReport('acc_bank')}
                    data-testid="bank-ledger-btn"
                    className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--brand)]/20 bg-[color:var(--brand-soft)] px-4 py-3 text-sm font-extrabold text-[color:var(--brand)] transition hover:opacity-90 active:scale-[0.99]"
                  >
                    <ArrowDownUp size={16} aria-hidden />
                    گزارش جامع گردش خزانه
                  </button>
                )}
              </div>
            </>
          )}

          {/* Movements Section */}
          {bankTx.length > 0 ? (
            <>
              <section className="dash-card hidden p-4 sm:p-5 md:block" data-testid="bank-moves">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <List size={18} className="text-[color:var(--brand)]" />
                    <h2 className="text-base font-extrabold text-[color:var(--ink)]">
                      آخرین گردش حساب‌ها و صندوق‌ها
                    </h2>
                  </div>
                  <ChipSelect
                    testId="bank-move-filter"
                    label="فیلتر حساب یا صندوق"
                    value={moveFilter}
                    onChange={setMoveFilter}
                    options={[
                      { value: '', label: 'همه حساب‌ها و صندوق‌ها' },
                      ...banks.map((b) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                </div>

                <div className="mt-3.5 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.15fr)_5.5rem_7.5rem_8.5rem] items-center gap-3 rounded-xl bg-[color:var(--surface-2)] px-3.5 py-2.5 text-[11px] font-bold text-[color:var(--muted)]">
                  <span>طرف حساب / سرفصل و شرح</span>
                  <span>حساب / صندوق</span>
                  <span>تاریخ</span>
                  <span>نوع گردش</span>
                  <span className="text-left">مبلغ (تومان)</span>
                </div>

                <div className="mt-1.5 space-y-1.5" data-testid="bank-moves-rows">
                  {moveList.slice(0, 25).map((tx, i) => {
                    const dir = resolveDirection(tx);
                    const bankAcc = accountById(tx.bankAccountId);
                    return (
                      <div
                        key={tx.id}
                        className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.15fr)_5.5rem_7.5rem_8.5rem] items-center gap-3 rounded-2xl border border-[color:var(--line)]/70 bg-[color:var(--surface-1)]/75 px-3.5 py-2.5 transition hover:border-[color:var(--brand)]/35 hover:bg-[color:var(--surface-2)]/55"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {renderAvatar(tx, i)}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[color:var(--ink)]">
                              {partyOf(tx)}
                            </p>
                            {tx.description ? (
                              <p className="truncate text-[11px] text-[color:var(--muted)]">
                                {tx.description}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex min-w-0 items-center gap-2">
                          <BankLogo
                            name={bankNameOf(tx.bankAccountId)}
                            treasuryType={bankAcc ? resolveTreasuryType(bankAcc) : undefined}
                            size="sm"
                          />
                          <span className="truncate text-xs font-semibold text-[color:var(--ink)]">
                            {tx.type === 'transfer'
                              ? `${shortBankName(bankNameOf(tx.bankAccountId))} ← ${shortBankName(bankNameOf(tx.accountId))}`
                              : bankNameOf(tx.bankAccountId)}
                          </span>
                        </div>

                        <span className="text-xs font-semibold tabular-nums text-[color:var(--muted)]">
                          {FA_JALALI_DATE.format(new Date(`${tx.date}T12:00:00`))}
                        </span>

                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
                            dir === 'in'
                              ? 'tone-income'
                              : dir === 'out'
                                ? 'tone-expense'
                                : 'tone-info'
                          )}
                        >
                          {dir === 'in' ? (
                            <ArrowDownLeft size={12} />
                          ) : dir === 'out' ? (
                            <ArrowUpRight size={12} />
                          ) : (
                            <ArrowLeftRight size={12} />
                          )}
                          {tx.type === 'transfer'
                            ? dir === 'in'
                              ? 'انتقال (واریز)'
                              : dir === 'out'
                                ? 'انتقال (برداشت)'
                                : 'انتقال'
                            : tx.type === 'income'
                              ? 'واریز'
                              : 'برداشت'}
                        </span>

                        <p className={cn('text-left text-sm font-black tabular-nums', signedClass(tx))}>
                          {signedValue(tx)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Mobile Recent Movements */}
              <div className="dash-card p-4 md:hidden" data-testid="bank-recent">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <List size={17} className="text-[color:var(--brand)]" />
                    <h2 className="text-base font-extrabold text-[color:var(--ink)]">آخرین گردش</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenReport('acc_bank')}
                    className="text-xs font-bold text-[color:var(--brand)]"
                  >
                    مشاهده همه
                  </button>
                </div>

                <div className="mt-3 space-y-2" data-testid="bank-recent-cards">
                  {recentTx.map((tx, i) => (
                    <div
                      key={tx.id}
                      className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] p-3 shadow-[var(--shadow-sm)]"
                    >
                      <div className="flex items-center gap-2.5">
                        {renderAvatar(tx, i)}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[color:var(--ink)]">
                            {partyOf(tx)}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">
                            {tx.type === 'transfer'
                              ? `${shortBankName(bankNameOf(tx.bankAccountId))} به ${shortBankName(bankNameOf(tx.accountId))}`
                              : tx.description || bankNameOf(tx.bankAccountId)}
                          </p>
                        </div>
                        <div className="shrink-0 text-left">
                          <p className={cn('text-sm font-black tabular-nums', signedClass(tx))}>
                            {signedValue(tx)}
                          </p>
                          <p className="mt-0.5 text-[10px] tabular-nums text-[color:var(--muted)]">
                            {FA_JALALI_DATE.format(new Date(`${tx.date}T12:00:00`))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* Redesigned Spacious Treasury Modal (Bank / Cashbox / Petty Cash) */}
      <FormSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        accent={treasuryType === 'cashbox' ? 'income' : 'brand'}
        size="lg"
        subtitle={modalSubtitle}
        headerChip={<StoreMark name={storeName} logo={settings?.logo || undefined} size="md" />}
        title={modalTitle}
        footer={
          <FormActions
            onCancel={() => setOpen(false)}
            onSubmit={() => void save()}
            submitLabel={editId ? 'ذخیره تغییرات' : `افزودن ${previewTypeMeta.label}`}
            submitDisabled={!name.trim()}
            submitIcon={Plus}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          {/* 1. Principled 3-Way Treasury Type Selector */}
          <div>
            <label className={fieldLabel}>نوع حساب خزانه</label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="نوع حساب خزانه">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = treasuryType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`treasury-type-${opt.id}`}
                    onClick={() => handleTypeSwitch(opt.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl border-[1.5px] px-2 py-2 text-center transition sm:flex-row sm:items-center sm:gap-2.5 sm:px-3 sm:py-2.5 sm:text-right',
                      active
                        ? opt.activeRing
                        : 'border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 text-[color:var(--ink)] hover:border-[color:var(--brand)]/35'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl',
                        active ? 'bg-white/80 dark:bg-slate-900/40' : opt.iconTone
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11.5px] sm:text-xs font-extrabold leading-tight">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 hidden truncate text-[10px] opacity-75 sm:block">
                        {opt.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2A. Mobile Compact Summary Strip (< 768px) so inputs stay above fold */}
          <div
            className={cn(
              'flex items-center justify-between gap-2.5 rounded-2xl bg-gradient-to-l px-3.5 py-2.5 text-white shadow-sm md:hidden',
              previewTypeMeta.gradientClass
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/95">
                <BankLogo
                  name={name || previewBrand.fullName}
                  treasuryType={treasuryType}
                  size="xs"
                  className="border-0 shadow-none"
                />
              </span>
              <span className="truncate text-xs font-black">
                {name.trim() || previewTypeMeta.label}
              </span>
            </div>
            <span className="shrink-0 text-xs font-black tabular-nums">
              {money(previewAmount)} تومان
            </span>
          </div>

          {/* 2B. Tablet & Desktop Full Card Preview (>= 768px) */}
          <div
            className={cn(
              'relative hidden overflow-hidden rounded-2xl bg-gradient-to-l px-4 py-3.5 text-white shadow-md md:block',
              previewTypeMeta.gradientClass
            )}
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
              viewBox="0 0 420 120"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M-10 92 C 95 55, 220 110, 430 42"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1.8"
                fill="none"
              />
              <path
                d="M-10 108 C 120 75, 260 120, 430 68"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="1.3"
                fill="none"
              />
            </svg>
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/95 shadow-sm">
                  <BankLogo
                    name={name || previewBrand.fullName}
                    treasuryType={treasuryType}
                    size="sm"
                    className="border-0 shadow-none"
                  />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-black">
                      {name.trim() || previewTypeMeta.label}
                    </span>
                    <span className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
                      {previewTypeMeta.shortLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-white/80">{previewSubtitle}</p>
                </div>
              </div>

              <div className="shrink-0 text-left">
                <p className="text-[10px] font-semibold text-white/75">موجودی اولیه</p>
                <p className="text-base font-black tabular-nums">
                  {money(previewAmount)} <span className="text-[10px] font-semibold">تومان</span>
                </p>
                {treasuryType === 'bank' && accountNumber.trim() ? (
                  <p className="mt-0.5 text-[10px] font-bold tabular-nums tracking-wider text-white/85" dir="ltr">
                    {maskAccountNumber(accountNumber)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* 3. Quick Presets: single-row swipeable on mobile, 4-col grid on tablet/desktop */}
          {treasuryType === 'bank' ? (
            <div>
              <label className={fieldLabel}>انتخاب سریع بانک ایرانی</label>
              <div className="no-scrollbar flex flex-nowrap gap-2 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
                {IRANIAN_BANKS_ONLY.map((preset) => {
                  const active = name === preset.fullName || name.includes(preset.shortName);
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setName(preset.fullName)}
                      className={cn(
                        'flex shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-right text-xs font-bold transition',
                        active
                          ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)] shadow-xs'
                          : 'border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 text-[color:var(--ink)] hover:border-[color:var(--brand)]/40'
                      )}
                    >
                      <BankLogo
                        name={preset.fullName}
                        treasuryType="bank"
                        size="xs"
                        className="h-6 w-6 shrink-0 rounded-lg"
                      />
                      <span className="whitespace-nowrap">{preset.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <label className={fieldLabel}>
                {treasuryType === 'cashbox' ? 'پیشنهاد سریع نام صندوق' : 'پیشنهاد سریع عنوان تنخواه'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(treasuryType === 'cashbox' ? CASHBOX_PRESETS : PETTY_CASH_PRESETS).map((preset) => {
                  const active = name === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setName(preset)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-right text-xs font-bold transition',
                        active
                          ? treasuryType === 'cashbox'
                            ? 'border-[color:var(--income)] bg-[color:var(--income-soft)] text-[color:var(--income)]'
                            : 'border-[color:var(--warning)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]'
                          : 'border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 text-[color:var(--ink)] hover:border-[color:var(--brand)]/40'
                      )}
                    >
                      <BankLogo name={preset} treasuryType={treasuryType} size="xs" />
                      <span className="truncate">{preset}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Essential Name + Opening Balance, plus collapsible optional details on mobile */}
          <div className="form-section space-y-3.5 sm:space-y-4">
            <div>
              <label className={fieldLabel}>
                {treasuryType === 'bank'
                  ? 'نام بانک'
                  : treasuryType === 'cashbox'
                    ? 'نام صندوق نقدی'
                    : 'عنوان تنخواه‌گردان'}
              </label>
              <div className="flex h-11 items-center gap-2.5 rounded-[0.9rem] border-[1.5px] border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-[3px] focus-within:ring-[color:var(--brand-glow)]">
                <BankLogo
                  name={name || previewTypeMeta.label}
                  treasuryType={treasuryType}
                  size="xs"
                  className="h-6 w-6 shrink-0 rounded-lg"
                />
                <input
                  data-testid="treasury-name-input"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-[color:var(--ink)] outline-none placeholder:font-normal placeholder:text-[color:var(--muted)]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    treasuryType === 'bank'
                      ? 'مثلاً بانک سامان یا بانک ملت'
                      : treasuryType === 'cashbox'
                        ? 'مثلاً صندوق اصلی فروشگاه'
                        : 'مثلاً تنخواه دفتر مرکزی'
                  }
                  autoFocus
                />
              </div>
            </div>

            <AmountInput
              value={openingStr}
              onChange={setOpeningStr}
              tone={treasuryType === 'cashbox' ? 'income' : 'brand'}
              label="موجودی اولیه (تومان)"
              chips={[1_000_000, 5_000_000, 10_000_000]}
              compact
            />

            <CollapsibleOptionalSection
              title={
                treasuryType === 'bank'
                  ? 'عنوان حساب، شعبه و شماره کارت (اختیاری)'
                  : 'مشخصات تکمیلی مسئول و محل (اختیاری)'
              }
              filledCount={countFilledFields([accountTitle, holderName, accountNumber])}
              mobileOnly
              testId="treasury-optional-section"
            >
              {treasuryType === 'bank' ? (
                <div className="space-y-3.5 sm:space-y-4">
                  <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <div className="mb-1.5 flex min-h-[22px] items-center justify-between gap-1.5">
                        <label className="whitespace-nowrap text-xs font-bold text-[color:var(--muted)]">
                          عنوان حساب
                        </label>
                        <div className="flex shrink-0 items-center gap-1">
                          {(
                            [
                              { label: 'جاری', value: 'حساب جاری' },
                              { label: 'قرض‌الحسنه', value: 'حساب قرض‌الحسنه' },
                              { label: 'سپرده', value: 'حساب سپرده' },
                            ] as const
                          ).map((t) => (
                            <button
                              key={t.label}
                              type="button"
                              onClick={() => setAccountTitle(t.value)}
                              className={cn(
                                'whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold transition',
                                accountTitle === t.value
                                  ? 'bg-[color:var(--brand)] text-white'
                                  : 'bg-[color:var(--surface-2)] text-[color:var(--muted)] hover:text-[color:var(--ink)]'
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        className={fieldInput}
                        value={accountTitle}
                        onChange={(e) => setAccountTitle(e.target.value)}
                        placeholder="مثلاً حساب جاری شرکت"
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex min-h-[22px] items-center">
                        <label className="text-xs font-bold text-[color:var(--muted)]">
                          نام شعبه (اختیاری)
                        </label>
                      </div>
                      <input
                        className={fieldInput}
                        value={holderName}
                        onChange={(e) => setHolderName(e.target.value)}
                        placeholder="مثلاً شعبه ولیعصر"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={fieldLabel}>شماره حساب یا کارت (اختیاری)</label>
                    <input
                      className={cn(fieldInput, 'tabular-nums')}
                      dir="ltr"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="6037-9972-••••-1324"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              ) : treasuryType === 'cashbox' ? (
                <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className={fieldLabel}>محل استقرار / توضیح (اختیاری)</label>
                    <input
                      className={fieldInput}
                      value={accountTitle}
                      onChange={(e) => setAccountTitle(e.target.value)}
                      placeholder="مثلاً شعبه مرکزی یا انبار"
                    />
                  </div>
                  <div>
                    <label className={fieldLabel}>مسئول صندوق (اختیاری)</label>
                    <input
                      className={fieldInput}
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      placeholder="مثلاً صندوقدار اصلی"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className={fieldLabel}>نام تنخواه‌دار</label>
                    <input
                      className={fieldInput}
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      placeholder="مثلاً آقای رضایی"
                    />
                  </div>
                  <div>
                    <label className={fieldLabel}>بخش یا پروژه (اختیاری)</label>
                    <input
                      className={fieldInput}
                      value={accountTitle}
                      onChange={(e) => setAccountTitle(e.target.value)}
                      placeholder="مثلاً خرید و تدارکات"
                    />
                  </div>
                </div>
              )}
            </CollapsibleOptionalSection>
          </div>
        </div>
      </FormSheet>
    </div>
  );
};

export default BanksPage;
