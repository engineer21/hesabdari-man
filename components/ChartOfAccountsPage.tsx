import React, { useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  FileBarChart,
  ChevronDown,
  ChevronLeft,
  Search,
  FolderTree,
  Layers,
  ChevronsUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  Account,
  AccountKind,
  AccountModule,
  AppSettings,
  Invoice,
  PayrollEntry,
  Transaction,
} from '../types';
import { APP_NAME } from '../constants';
import {
  getChildren,
  nextChildCode,
  canDeleteAccount,
  moduleLabel,
} from '../utils/accountTree';
import { computeHeadingBalance } from '../utils/accountBalance';
import { formatNumberWithCommas, toPersianDigits, parseIntegerAmount } from '../utils/formatters';
import {
  downloadRowsAsExcel,
  downloadTableReportPdf,
  formatMoneyFa,
  type PdfPageSize,
} from '../utils/export';
import { useCan } from '../hooks/useSessionAuth';
import {
  WorkspaceHeader,
  Button,
  FormSheet,
  fieldInput,
  fieldLabel,
  AmountInput,
  FormActions,
  cn,
} from './ui';
import { BankLogo } from './ui/BankLogo';
import { ExportActions } from './export/ExportActions';
import { useDialog } from './DialogProvider';

interface ChartOfAccountsPageProps {
  accounts: Account[];
  setAccounts: (value: Account[] | ((v: Account[]) => Account[])) => void;
  transactions: Transaction[];
  invoices?: Invoice[];
  payrollEntries?: PayrollEntry[];
  onOpenReport: (accountId: string) => void;
  onOpenAccountingDefaults?: () => void;
  settings?: AppSettings;
}

const money = (n: number) => toPersianDigits(formatNumberWithCommas(Math.round(n)));

type ModuleFilter = 'all' | AccountModule;

const ChartOfAccountsPage: React.FC<ChartOfAccountsPageProps> = ({
  accounts,
  setAccounts,
  transactions,
  invoices = [],
  payrollEntries = [],
  onOpenReport,
  onOpenAccountingDefaults,
  settings,
}) => {
  const dialog = useDialog();
  const can = useCan();
  const canManageAccounts = can('settings.accounts');
  const storeName = settings?.name || APP_NAME;
  const roots = getChildren(accounts, null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(accounts.filter((a) => a.kind === 'group').map((r) => [r.id, true]))
  );
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all');
  const [query, setQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [parentId, setParentId] = useState('acc_income');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('postable');
  const [openingStr, setOpeningStr] = useState('0');

  const stats = useMemo(() => {
    const active = accounts.filter((a) => a.isActive !== false);
    const groups = active.filter((a) => a.kind === 'group').length;
    const leaves = active.filter((a) => a.kind === 'postable').length;
    const banks = active.filter((a) => a.module === 'bank' && a.kind === 'postable').length;
    return { total: active.length, groups, leaves, banks };
  }, [accounts]);

  const visibleRoots = useMemo(
    () => (moduleFilter === 'all' ? roots : roots.filter((r) => r.module === moduleFilter)),
    [roots, moduleFilter]
  );

  const q = query.trim().toLowerCase();

  const matchesTree = (acc: Account): boolean => {
    if (!q) return true;
    if (acc.name.toLowerCase().includes(q) || acc.code.toLowerCase().includes(q)) return true;
    return getChildren(accounts, acc.id).some(matchesTree);
  };

  const toggleAll = () => {
    const groupIds = accounts.filter((a) => a.kind === 'group').map((a) => a.id);
    const allOpen = groupIds.every((id) => expanded[id]);
    setExpanded(Object.fromEntries(groupIds.map((id) => [id, !allOpen])));
  };

  const flattenAccounts = (parentId: string | null, depth: number): { account: Account; depth: number }[] => {
    const out: { account: Account; depth: number }[] = [];
    for (const a of getChildren(accounts, parentId)) {
      out.push({ account: a, depth });
      out.push(...flattenAccounts(a.id, depth + 1));
    }
    return out;
  };

  const handleExcel = async () => {
    const flat = flattenAccounts(null, 0);
    await downloadRowsAsExcel(
      flat.map(({ account: a, depth }) => ({
        کد: a.code,
        نام: `${'  '.repeat(depth)}${a.name}`,
        نوع: a.kind === 'group' ? 'گروه' : 'قابل ثبت',
        ماژول: moduleLabel(a.module),
        مانده: computeHeadingBalance(a, accounts, transactions, invoices, payrollEntries),
      })),
      'کدینگ سرفصل‌ها',
      'chart-of-accounts'
    );
  };

  const handlePdf = async (pageSize: PdfPageSize) => {
    const compact = pageSize === 'a5';
    const flat = flattenAccounts(null, 0);
    const rows = flat.map(({ account: a, depth }) => {
      const indent = depth > 0 ? `${'— '.repeat(Math.min(depth, 4))}` : '';
      const bal = computeHeadingBalance(a, accounts, transactions, invoices, payrollEntries);
      if (compact) {
        return [a.code, `${indent}${a.name}`, formatMoneyFa(bal)];
      }
      return [
        a.code,
        `${indent}${a.name}`,
        a.kind === 'group' ? 'گروه' : 'قابل ثبت',
        moduleLabel(a.module),
        formatMoneyFa(bal),
      ];
    });
    await downloadTableReportPdf({
      title: 'گزارش کدینگ و سرفصل‌ها',
      storeName,
      subtitle: `${toPersianDigits(String(accounts.length))} سرفصل`,
      pageSize,
      filename: `coa-${pageSize}`,
      columns: compact
        ? [
            { header: 'کد', width: 1.1, align: 'right' },
            { header: 'نام سرفصل', width: 3.2, align: 'right' },
            { header: 'مانده', width: 1.4, align: 'amount' },
          ]
        : [
            { header: 'کد', width: 1.1, align: 'right' },
            { header: 'نام سرفصل', width: 3, align: 'right' },
            { header: 'نوع', width: 1, align: 'right' },
            { header: 'ماژول', width: 1, align: 'right' },
            { header: 'مانده', width: 1.3, align: 'amount' },
          ],
      rows,
    });
  };

  const openAdd = (pid?: string) => {
    setEditId(null);
    setParentId(pid || 'acc_income');
    setName('');
    setKind('postable');
    setOpeningStr('0');
    setFormOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditId(acc.id);
    setParentId(acc.parentId || '');
    setName(acc.name);
    setKind(acc.kind);
    setOpeningStr(String(acc.openingBalance || 0));
    setFormOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      await dialog.alert({ title: 'نام', message: 'نام سرفصل را وارد کنید.' });
      return;
    }
    if (editId) {
      const existing = accounts.find((a) => a.id === editId);
      if (!existing) return;
      const hasKids = accounts.some((a) => a.parentId === editId);
      if (hasKids && kind === 'postable') {
        await dialog.alert({
          title: 'تغییر نوع سرفصل',
          message: 'سرفصلی که زیرمجموعه دارد نمی‌تواند به حالت «قابل ثبت» تغییر کند.',
        });
        return;
      }
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editId
            ? {
                ...a,
                name: name.trim(),
                kind: existing.isSystem ? a.kind : kind,
                openingBalance:
                  a.module === 'bank' && kind === 'postable'
                    ? parseIntegerAmount(openingStr, true)
                    : a.openingBalance,
              }
            : a
        )
      );
    } else {
      const parent = accounts.find((a) => a.id === parentId);
      if (!parent) {
        await dialog.alert({ title: 'گروه', message: 'گروه والد را انتخاب کنید.' });
        return;
      }
      const module: AccountModule = parent.module;
      const id = `acc_${crypto.randomUUID().slice(0, 8)}`;
      setAccounts((prev) => [
        ...prev,
        {
          id,
          code: nextChildCode(prev, parentId),
          name: name.trim(),
          parentId,
          kind,
          module,
          isActive: true,
          openingBalance:
            module === 'bank' && kind === 'postable'
              ? parseIntegerAmount(openingStr, true)
              : undefined,
        },
      ]);
      setExpanded((e) => ({ ...e, [parentId]: true }));
    }
    setFormOpen(false);
  };

  const remove = async (acc: Account) => {
    if (acc.isSystem) {
      await dialog.alert({ title: 'حذف', message: 'سرفصل ریشه قابل حذف نیست.' });
      return;
    }
    if (!canDeleteAccount(accounts, acc.id)) {
      await dialog.alert({ title: 'حذف', message: 'ابتدا زیرسرفصل‌ها را حذف کنید.' });
      return;
    }
    const used = transactions.some(
      (t) => t.accountId === acc.id || t.bankAccountId === acc.id
    );
    if (used) {
      await dialog.alert({ title: 'حذف', message: 'این سرفصل در ثبت‌ها استفاده شده و قابل حذف نیست.' });
      return;
    }
    const ok = await dialog.confirm({
      title: 'حذف سرفصل',
      message: `«${acc.name}» حذف شود؟`,
      tone: 'danger',
      confirmLabel: 'حذف',
    });
    if (ok) setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
  };

  const moduleTone = (m: AccountModule) =>
    m === 'income'
      ? 'text-[color:var(--income)]'
      : m === 'expense'
        ? 'text-[color:var(--expense)]'
        : 'text-[color:var(--brand)]';

  const renderNode = (account: Account, depth: number): React.ReactNode => {
    if (!matchesTree(account)) return null;
    const children = getChildren(accounts, account.id);
    const hasChildren = children.length > 0;
    const isOpen = q ? true : expanded[account.id];
    const bal = computeHeadingBalance(account, accounts, transactions, invoices, payrollEntries);

    return (
      <div key={account.id}>
        <div
          className={cn(
            'flex items-center gap-2 border-b border-[color:var(--line)]/65 px-3 py-3 transition hover:bg-[color:var(--surface-2)]/55',
            depth === 0 && 'bg-[color:var(--surface-2)]/45'
          )}
          style={{ paddingInlineStart: `${depth * 20 + 12}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isOpen ? `بستن زیرمجموعه ${account.name}` : `باز کردن زیرمجموعه ${account.name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface-solid)] hover:text-[color:var(--ink)]"
              onClick={() => setExpanded((e) => ({ ...e, [account.id]: !e[account.id] }))}
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronLeft size={15} />}
            </button>
          ) : (
            <span className="w-7 shrink-0" />
          )}

          {account.module === 'bank' && account.kind === 'postable' ? (
            <BankLogo name={account.name} size="xs" className="shrink-0" />
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
                {toPersianDigits(account.code)}
              </span>
              <p
                className={cn(
                  'truncate text-sm',
                  depth === 0
                    ? 'font-black text-[color:var(--ink)]'
                    : account.kind === 'group'
                      ? 'font-extrabold text-[color:var(--ink)]'
                      : 'font-semibold text-[color:var(--ink)]'
                )}
              >
                {account.name}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-[color:var(--muted)]">
              {account.kind === 'group' ? 'گروه کل / معین' : 'حساب قابل ثبت'} · {moduleLabel(account.module)}
            </p>
          </div>

          <div className="hidden shrink-0 text-left sm:block">
            <p className={cn('text-xs font-black tabular-nums', moduleTone(account.module))}>
              {money(bal)}
              <span className="ms-1 text-[10px] font-semibold text-[color:var(--muted)]">تومان</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={`گزارش گردش ${account.name}`}
              title="دفتر گردش"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--brand)] transition hover:bg-[color:var(--brand-soft)]"
              onClick={() => onOpenReport(account.id)}
            >
              <FileBarChart size={15} />
            </button>
            {canManageAccounts && (account.kind === 'group' || account.isSystem) ? (
              <button
                type="button"
                aria-label={`افزودن زیرسرفصل برای ${account.name}`}
                title="افزودن زیرسرفصل"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                onClick={() => openAdd(account.id)}
              >
                <Plus size={15} />
              </button>
            ) : null}
            {canManageAccounts && !account.isSystem ? (
              <>
                <button
                  type="button"
                  aria-label={`ویرایش ${account.name}`}
                  title="ویرایش"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                  onClick={() => openEdit(account)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`حذف ${account.name}`}
                  title="حذف"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--expense)] transition hover:bg-[color:var(--expense-soft)]"
                  onClick={() => void remove(account)}
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : null}
          </div>
        </div>
        {hasChildren && isOpen ? children.map((c) => renderNode(c, depth + 1)) : null}
      </div>
    );
  };

  const parent = accounts.find((a) => a.id === parentId);
  const showOpening =
    (editId ? accounts.find((a) => a.id === editId)?.module === 'bank' : parent?.module === 'bank') &&
    kind === 'postable';

  return (
    <div className="mx-auto max-w-6xl animate-page-enter space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="کدینگ و درخت سرفصل‌ها"
        subtitle="ساختار سلسله‌مراتبی حساب‌های نقد و بانک، درآمدها و هزینه‌ها"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManageAccounts && onOpenAccountingDefaults ? (
              <Button
                size="sm"
                variant="secondary"
                icon={SlidersHorizontal}
                data-testid="coa-open-defaults-btn"
                onClick={onOpenAccountingDefaults}
              >
                قالب شغل و سرفصل‌های پیش‌فرض
              </Button>
            ) : null}
            {accounts.length > 0 ? (
              <ExportActions onExcel={handleExcel} onPdf={handlePdf} permission="reports.export" />
            ) : null}
          </div>
        }
        primaryAction={
          canManageAccounts ? (
            <Button size="sm" icon={Plus} onClick={() => openAdd()}>
              سرفصل جدید
            </Button>
          ) : undefined
        }
      />

      {/* Top 3 KPI Summary Cards */}
      <section className="grid grid-cols-3 gap-3">
        <div className="dash-card p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[color:var(--muted)]">کل سرفصل‌ها</span>
            <FolderTree size={15} className="hidden text-[color:var(--brand)] sm:block" />
          </div>
          <p className="mt-1.5 text-xl font-black tabular-nums text-[color:var(--ink)] sm:text-2xl">
            {toPersianDigits(stats.total)}
          </p>
        </div>
        <div className="dash-card p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[color:var(--muted)]">گروه‌های کل / معین</span>
            <Layers size={15} className="hidden text-violet-500 sm:block" />
          </div>
          <p className="mt-1.5 text-xl font-black tabular-nums text-[color:var(--ink)] sm:text-2xl">
            {toPersianDigits(stats.groups)}
          </p>
        </div>
        <div className="dash-card p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[color:var(--muted)]">حساب‌های قابل ثبت</span>
            <FileBarChart size={15} className="hidden text-[color:var(--income)] sm:block" />
          </div>
          <p className="mt-1.5 text-xl font-black tabular-nums text-[color:var(--ink)] sm:text-2xl">
            {toPersianDigits(stats.leaves)}
          </p>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] p-1 shadow-xs">
          {(
            [
              { id: 'all', label: 'همه' },
              { id: 'bank', label: 'بانک و نقد' },
              { id: 'income', label: 'درآمدها' },
              { id: 'expense', label: 'هزینه‌ها' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setModuleFilter(f.id)}
              className={cn(
                'whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition',
                moduleFilter === f.id
                  ? 'btn-brand-gradient text-white'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 items-center gap-2 md:max-w-md">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-4 focus-within:ring-[color:var(--brand)]/10">
            <Search size={15} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجو با نام یا کد حساب..."
              className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3 text-xs font-bold text-[color:var(--ink)] transition hover:border-[color:var(--brand)]/35"
          >
            <ChevronsUpDown size={14} />
            باز/بسته
          </button>
        </div>
      </section>

      {/* Tree Container */}
      <div className="dash-card overflow-hidden">
        {visibleRoots.map((r) => renderNode(r, 0))}
      </div>

      <FormSheet
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        accent="brand"
        size="md"
        dock
        headerChip={
          <span className="btn-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            <FolderTree size={19} />
          </span>
        }
        title={editId ? 'ویرایش سرفصل حسابداری' : 'تعریف سرفصل جدید'}
        subtitle="ساختار درختی سرفصل‌های درآمد، هزینه و خزانه را مدیریت کنید"
        footer={
          <FormActions
            onCancel={() => setFormOpen(false)}
            onSubmit={() => void save()}
            submitLabel={editId ? 'ذخیره تغییرات' : 'ثبت سرفصل'}
            submitDisabled={!name.trim()}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          <div className="form-section space-y-3.5 sm:space-y-4">
            <div>
              <label className={fieldLabel}>نام سرفصل</label>
              <input
                className={fieldInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً فروش عمده یا هزینه حمل"
                autoFocus
              />
            </div>

            {!editId || !(editId && accounts.find((a) => a.id === editId)?.isSystem) ? (
              <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
                {!editId ? (
                  <div>
                    <label className={fieldLabel}>زیرمجموعه گروه</label>
                    <select
                      className={fieldInput}
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                    >
                      {accounts
                        .filter((a) => a.kind === 'group' || a.isSystem)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {toPersianDigits(a.code)} — {a.name} ({moduleLabel(a.module)})
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
                {!(editId && accounts.find((a) => a.id === editId)?.isSystem) ? (
                  <div className={editId ? 'sm:col-span-2' : ''}>
                    <label className={fieldLabel}>سطح حساب</label>
                    <select
                      className={fieldInput}
                      value={kind}
                      onChange={(e) => setKind(e.target.value as AccountKind)}
                    >
                      <option value="postable">قابل ثبت (حساب معین / تفصیلی)</option>
                      <option value="group">گروه (دارای زیرمجموعه)</option>
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {showOpening ? (
            <AmountInput
              value={openingStr}
              onChange={setOpeningStr}
              accent="brand"
              compact
              label="مانده اول دوره (تومان)"
              chips={[1_000_000, 5_000_000, 10_000_000]}
            />
          ) : null}
        </div>
      </FormSheet>
    </div>
  );
};

export default ChartOfAccountsPage;
