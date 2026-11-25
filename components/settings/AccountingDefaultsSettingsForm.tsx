import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Factory,
  FileText,
  FolderTree,
  Landmark,
  Layers,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Sprout,
  Store,
  TrendingUp,
  Warehouse as WarehouseIcon,
  Wrench,
} from 'lucide-react';
import type {
  Account,
  AccountingDefaults,
  AppSettings,
  BusinessTemplateId,
  ContactGroup,
  View,
  Warehouse,
} from '../../types';
import {
  BUSINESS_TEMPLATES,
  BUSINESS_TEMPLATE_LIST,
  DEFAULT_ACCOUNTING_DEFAULTS,
  isDomainRawForTemplateSwitch,
  mergeTemplateAccountsIntoExisting,
  resolveDefaultAccountId,
  resolveDefaultWarehouseId,
  type DomainActivityCounts,
} from '../../utils/accountingTemplates';
import { getBankAccounts } from '../../utils/accountTree';
import { toPersianDigits } from '../../utils/formatters';
import AccountTreePicker from '../AccountTreePicker';
import { useDialog } from '../DialogProvider';
import { Button, WorkspaceHeader, cn, fieldInput, fieldLabel } from '../ui';

interface AccountingDefaultsSettingsFormProps {
  accounts: Account[];
  setAccounts: (v: Account[] | ((p: Account[]) => Account[])) => void;
  contactGroups: ContactGroup[];
  setContactGroups: (v: ContactGroup[] | ((p: ContactGroup[]) => ContactGroup[])) => void;
  warehouses: Warehouse[];
  appSettings: AppSettings;
  setAppSettings: (v: AppSettings | ((p: AppSettings) => AppSettings)) => void;
  activityCounts: DomainActivityCounts;
  onNavigate?: (view: View) => void;
}

const TEMPLATE_ICONS: Record<BusinessTemplateId, React.ComponentType<{ size?: number; className?: string }>> = {
  commercial: Store,
  agriculture: Sprout,
  service: Wrench,
  manufacturing: Factory,
};

const AccountingDefaultsSettingsForm: React.FC<AccountingDefaultsSettingsFormProps> = ({
  accounts,
  setAccounts,
  contactGroups,
  setContactGroups,
  warehouses,
  appSettings,
  setAppSettings,
  activityCounts,
  onNavigate,
}) => {
  const dialog = useDialog();
  const isRaw = useMemo(() => isDomainRawForTemplateSwitch(activityCounts), [activityCounts]);
  const totalDocs =
    activityCounts.transactionsCount +
    activityCounts.invoicesCount +
    activityCounts.payrollEntriesCount +
    activityCounts.checksCount +
    activityCounts.loansCount;

  const activeTemplateId: BusinessTemplateId = appSettings.businessTemplate || 'commercial';
  const [selectedTemplateId, setSelectedTemplateId] = useState<BusinessTemplateId>(activeTemplateId);
  const [statusBanner, setStatusBanner] = useState<string>('');

  const banks = useMemo(() => getBankAccounts(accounts), [accounts]);
  const currentDefaults = appSettings.accountingDefaults;

  // Resolved effective values for every module role
  const saleInvoiceAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'saleInvoice'),
    [accounts, currentDefaults]
  );
  const purchaseInvoiceAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'purchaseInvoice'),
    [accounts, currentDefaults]
  );
  const incomeTxnAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'incomeTxn'),
    [accounts, currentDefaults]
  );
  const expenseTxnAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'expenseTxn'),
    [accounts, currentDefaults]
  );
  const defaultBankAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'defaultBank'),
    [accounts, currentDefaults]
  );
  const defaultWarehouseId = useMemo(
    () => resolveDefaultWarehouseId(warehouses, currentDefaults),
    [warehouses, currentDefaults]
  );
  const payrollFixedAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'payrollFixed'),
    [accounts, currentDefaults]
  );
  const payrollDailyAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'payrollDaily'),
    [accounts, currentDefaults]
  );
  const payrollIrrigationAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'payrollIrrigation'),
    [accounts, currentDefaults]
  );
  const payrollGroupAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'payrollGroup'),
    [accounts, currentDefaults]
  );
  const loanInterestAccountId = useMemo(
    () => resolveDefaultAccountId(accounts, currentDefaults, 'loanInterest'),
    [accounts, currentDefaults]
  );

  const updateDefaultField = (key: keyof AccountingDefaults, value: string) => {
    setAppSettings((prev) => ({
      ...prev,
      accountingDefaults: {
        ...DEFAULT_ACCOUNTING_DEFAULTS,
        ...(prev.accountingDefaults || {}),
        [key]: value,
      },
    }));
    setStatusBanner('تغییرات سرفصل پیش‌فرض به‌طور خودکار ذخیره شد.');
  };

  const handleFullApplyTemplate = async (tplId: BusinessTemplateId) => {
    const tpl = BUSINESS_TEMPLATES[tplId];
    if (!tpl) return;

    if (!isRaw) {
      await dialog.alert({
        title: 'امکان جایگزینی کامل نیست',
        message:
          'به دلیل وجود اسناد ثبت‌شده در برنامه، جایگزینی کامل درخت سرفصل‌ها مجاز نیست. از دکمه «افزودن سرفصل‌های مکمل این شغل» استفاده کنید.',
      });
      return;
    }

    const ok = await dialog.confirm({
      title: `اعمال قالب کدینگ «${tpl.title}»`,
      message: `درخت سرفصل‌ها و نگاشت پیش‌فرض فرم‌ها بر اساس الگوی استاندارد «${tpl.title}» تنظیم شود؟`,
      confirmLabel: 'بله، اعمال قالب شغل',
    });
    if (!ok) return;

    setAccounts(tpl.accounts.map((a) => ({ ...a })));

    // Also ensure all 4 standard contact groups exist
    setContactGroups((prev) => {
      const next = [...prev];
      for (const g of tpl.contactGroups) {
        if (!next.some((eg) => eg.id === g.id || eg.name === g.name)) {
          next.push({ ...g });
        }
      }
      return next;
    });

    setAppSettings((prev) => ({
      ...prev,
      businessTemplate: tplId,
      accountingDefaults: {
        ...tpl.defaults,
      },
    }));
    setSelectedTemplateId(tplId);
    setStatusBanner(`قالب کدینگ «${tpl.title}» و سرفصل‌های پیش‌فرض آن با موفقیت اعمال شد.`);
  };

  const handleMergeTemplate = async (tplId: BusinessTemplateId) => {
    const tpl = BUSINESS_TEMPLATES[tplId];
    if (!tpl) return;

    const { accounts: merged, addedCount } = mergeTemplateAccountsIntoExisting(accounts, tplId);
    if (addedCount === 0) {
      setAppSettings((prev) => ({
        ...prev,
        businessTemplate: tplId,
      }));
      setStatusBanner(`تمامی سرفصل‌های قالب «${tpl.title}» از قبل در کدینگ شما وجود دارند.`);
      return;
    }

    setAccounts(merged);
    setAppSettings((prev) => ({
      ...prev,
      businessTemplate: tplId,
      accountingDefaults: {
        ...tpl.defaults,
        ...(prev.accountingDefaults || {}),
      },
    }));
    setSelectedTemplateId(tplId);
    setStatusBanner(
      `${toPersianDigits(String(addedCount))} سرفصل جدید از قالب «${tpl.title}» بدون حذف سرفصل‌های قبلی اضافه شد.`
    );
  };

  const handleResetMappingsToTemplate = () => {
    const tpl = BUSINESS_TEMPLATES[activeTemplateId] || BUSINESS_TEMPLATES.commercial;
    setAppSettings((prev) => ({
      ...prev,
      accountingDefaults: {
        ...tpl.defaults,
      },
    }));
    setStatusBanner(`سرفصل‌های پیش‌فرض فرم‌ها به استاندارد «${tpl.title}» بازنشانی شد.`);
  };

  const selectedTemplate =
    BUSINESS_TEMPLATES[selectedTemplateId] || BUSINESS_TEMPLATES.commercial;

  return (
    <div
      className="mx-auto max-w-5xl animate-page-enter space-y-5 pb-28 md:space-y-6 md:pb-10"
      data-testid="accounting-defaults-page"
    >
      <WorkspaceHeader
        title="قالب کدینگ مشاغل و سرفصل‌های پیش‌فرض"
        subtitle="انتخاب ساختار سرفصل‌های متناسب با نوع کسب‌وکار و تعیین حساب پیش‌فرض هر بخش (فاکتور فروش، خرید، درآمد، هزینه و حقوق)"
        actions={
          onNavigate ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={FolderTree}
                onClick={() => onNavigate('chartOfAccounts')}
              >
                درخت کدینگ سرفصل‌ها
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={ArrowRight}
                onClick={() => onNavigate('settings')}
              >
                بازگشت به تنظیمات
              </Button>
            </div>
          ) : undefined
        }
      />

      {statusBanner ? (
        <div
          role="status"
          data-testid="accounting-defaults-status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-extrabold text-emerald-700 dark:text-emerald-300"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner('')}
            className="text-[11px] font-bold underline opacity-80 hover:opacity-100"
          >
            بستن
          </button>
        </div>
      ) : null}

      {/* SECTION 1: Industry-Specific Chart of Accounts Templates */}
      <section className="dash-card space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-[color:var(--ink)]">
                ۱. قالب استاندارد کدینگ بر اساس نوع شغل
              </h2>
              <span className="text-xs font-bold text-[color:var(--brand)]">
                · قالب فعال: {BUSINESS_TEMPLATES[activeTemplateId]?.title}
              </span>
            </div>
            <p className="text-xs font-medium text-[color:var(--muted)]">
              سرفصل‌های درآمد، هزینه، خرید، فروش و کارکرد را متناسب با رشته فعالیت خود تنظیم کنید.
            </p>
          </div>

          {/* Raw State Status Indicator */}
          <div
            data-testid="template-raw-state-badge"
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold',
              isRaw
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            )}
          >
            {isRaw ? (
              <>
                <Sparkles size={15} className="shrink-0" />
                <span>اطلاعات خام است — امکان تغییر کامل قالب کدینگ</span>
              </>
            ) : (
              <>
                <ShieldAlert size={15} className="shrink-0" />
                <span>
                  {toPersianDigits(String(totalDocs))} سند ثبت‌شده — حالت افزودن امن سرفصل‌های مکمل
                </span>
              </>
            )}
          </div>
        </div>

        {/* 4 Industry Template Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BUSINESS_TEMPLATE_LIST.map((tpl) => {
            const Icon = TEMPLATE_ICONS[tpl.id];
            const isSelected = selectedTemplateId === tpl.id;
            const isCurrentActive = activeTemplateId === tpl.id;

            return (
              <button
                key={tpl.id}
                type="button"
                data-testid={`business-template-card-${tpl.id}`}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={cn(
                  'flex flex-col justify-between rounded-2xl border p-4 text-right transition',
                  isSelected
                    ? 'border-[color:var(--brand)] bg-[color:var(--brand-soft)]/35 ring-2 ring-[color:var(--brand)]/20'
                    : 'border-[color:var(--line)] bg-[color:var(--surface-solid)] hover:border-[color:var(--brand)]/40'
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        isSelected ? 'btn-brand-gradient text-white' : 'tone-brand'
                      )}
                    >
                      <Icon size={19} />
                    </span>
                    {isCurrentActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-[color:var(--income)]">
                        <Check size={13} />
                        قالب فعلی
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-[color:var(--ink)]">{tpl.title}</h3>
                    <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-[color:var(--muted)]">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 border-t border-[color:var(--line)]/70 pt-2.5">
                  <p className="text-[10.5px] font-bold text-[color:var(--muted)]">
                    نمونه سرفصل‌های اختصاصی:
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-bold text-[color:var(--ink)]">
                    {tpl.sampleHeadings.join(' · ')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Template Details & Apply Action Bar */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/50 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-black text-[color:var(--ink)]">
                قالب انتخابی: {selectedTemplate.title}
              </span>
              <span className="text-[color:var(--muted)]">·</span>
              <span className="font-semibold tabular-nums text-[color:var(--muted)]">
                {toPersianDigits(String(selectedTemplate.accounts.length))} سرفصل استاندارد و{' '}
                {toPersianDigits(String( contactGroups.length || 4))} گروه اشخاص پایه
              </span>
            </div>
            <p className="text-xs text-[color:var(--muted)]">
              {isRaw
                ? 'چون هنوز فاکتور یا تراکنشی ثبت نکرده‌اید، می‌توانید کل کدینگ برنامه را با این شغل جایگزین کنید.'
                : 'به دلیل وجود اسناد مالی، سرفصل‌های فعلی شما حفظ شده و فقط سرفصل‌های جدید این شغل اضافه می‌شوند.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isRaw ? (
              <Button
                size="sm"
                icon={Check}
                data-testid="apply-template-full-btn"
                onClick={() => void handleFullApplyTemplate(selectedTemplateId)}
              >
                اعمال کامل قالب «{selectedTemplate.title}»
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={isRaw ? 'secondary' : 'primary'}
              icon={Layers}
              data-testid="apply-template-merge-btn"
              onClick={() => void handleMergeTemplate(selectedTemplateId)}
            >
              افزودن سرفصل‌های مکمل این شغل
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 2: Per-Module Default Account Mappings */}
      <section className="dash-card space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-[color:var(--ink)]">
              ۲. تنظیم سرفصل‌های پیش‌فرض بخش‌های مختلف برنامه
            </h2>
            <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
              مشخص کنید هنگام باز کردن فرم‌های فاکتور فروش، فاکتور خرید، درآمد، هزینه، حقوق و وام، کدام سرفصل به‌طور پیش‌فرض انتخاب شود. (در داخل هر فرم نیز امکان تغییر سرفصل را دارید)
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            icon={RotateCcw}
            data-testid="reset-accounting-defaults-btn"
            onClick={handleResetMappingsToTemplate}
          >
            بازنشانی به پیش‌فرض قالب شغل
          </Button>
        </div>

        {/* Category A: Invoices & Inventory */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-sm font-black text-[color:var(--ink)]">
            <FileText size={16} className="text-[color:var(--brand)]" />
            <h3>فاکتورهای خرید، فروش و انبار</h3>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
            <div data-testid="default-picker-sale-invoice">
              <AccountTreePicker
                accounts={accounts}
                module="income"
                value={saleInvoiceAccountId}
                onChange={(id) => updateDefaultField('saleInvoiceAccountId', id)}
                label="سرفصل پیش‌فرض فاکتور فروش (درآمد)"
              />
            </div>

            <div data-testid="default-picker-purchase-invoice">
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={purchaseInvoiceAccountId}
                onChange={(id) => updateDefaultField('purchaseInvoiceAccountId', id)}
                label="سرفصل پیش‌فرض فاکتور خرید (هزینه)"
              />
            </div>

            <div>
              <label className={fieldLabel} htmlFor="default-warehouse-select">
                <span className="inline-flex items-center gap-1">
                  <WarehouseIcon size={13} />
                  انبار پیش‌فرض صدور فاکتور و کالا
                </span>
              </label>
              <select
                id="default-warehouse-select"
                data-testid="default-warehouse-select"
                className={fieldInput}
                value={defaultWarehouseId}
                onChange={(e) => updateDefaultField('defaultWarehouseId', e.target.value)}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({toPersianDigits(w.code)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Category B: Daily Income, Expense & Treasury */}
        <div className="space-y-3.5 border-t border-[color:var(--line)] pt-5">
          <div className="flex items-center gap-2 text-sm font-black text-[color:var(--ink)]">
            <TrendingUp size={16} className="text-[color:var(--income)]" />
            <h3>ثبت سریع درآمدها، هزینه‌ها و خزانه پیش‌فرض</h3>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
            <div data-testid="default-picker-income-txn">
              <AccountTreePicker
                accounts={accounts}
                module="income"
                value={incomeTxnAccountId}
                onChange={(id) => updateDefaultField('incomeTxnAccountId', id)}
                label="سرفصل پیش‌فرض ثبت درآمد روزانه"
              />
            </div>

            <div data-testid="default-picker-expense-txn">
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={expenseTxnAccountId}
                onChange={(id) => updateDefaultField('expenseTxnAccountId', id)}
                label="سرفصل پیش‌فرض ثبت هزینه روزانه"
              />
            </div>

            <div>
              <label className={fieldLabel} htmlFor="default-bank-select">
                <span className="inline-flex items-center gap-1">
                  <Landmark size={13} />
                  بانک / صندوق پیش‌فرض دریافت و پرداخت
                </span>
              </label>
              <select
                id="default-bank-select"
                data-testid="default-bank-select"
                className={fieldInput}
                value={defaultBankAccountId}
                onChange={(e) => updateDefaultField('defaultBankAccountId', e.target.value)}
              >
                {banks.length === 0 ? (
                  <option value="">هنوز حساب بانکی یا صندوق تعریف نشده</option>
                ) : (
                  banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.accountTitle ? `— ${b.accountTitle}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Category C: Payroll, Work-Logs & Loan Interest */}
        <div className="space-y-3.5 border-t border-[color:var(--line)] pt-5">
          <div className="flex items-center gap-2 text-sm font-black text-[color:var(--ink)]">
            <Briefcase size={16} className="text-[color:var(--brand)]" />
            <h3>حقوق و کارکرد پرسنل و تسهیلات بانکی</h3>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div data-testid="default-picker-payroll-fixed">
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={payrollFixedAccountId}
                onChange={(id) => updateDefaultField('payrollFixedAccountId', id)}
                label="سرفصل پیش‌فرض قرارداد حقوق ثابت"
              />
            </div>

            <div data-testid="default-picker-payroll-daily">
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={payrollDailyAccountId}
                onChange={(id) => updateDefaultField('payrollDailyAccountId', id)}
                label="سرفصل پیش‌فرض کارگری روزمزد"
              />
            </div>

            <div data-testid="default-picker-payroll-irrigation">
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={payrollIrrigationAccountId}
                onChange={(id) => updateDefaultField('payrollIrrigationAccountId', id)}
                label="سرفصل پیش‌فرض کارکرد آبگیری"
              />
            </div>

            <div data-testid="default-picker-payroll-group">
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={payrollGroupAccountId}
                onChange={(id) => updateDefaultField('payrollGroupAccountId', id)}
                label="سرفصل پیش‌فرض کارگری دسته‌جمعی"
              />
            </div>

            <div data-testid="default-picker-loan-interest">
              <AccountTreePicker
                accounts={accounts}
                module="expense"
                value={loanInterestAccountId}
                onChange={(id) => updateDefaultField('loanInterestAccountId', id)}
                label="سرفصل پیش‌فرض هزینه سود وام"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AccountingDefaultsSettingsForm;
