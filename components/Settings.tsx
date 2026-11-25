import React from 'react';
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BellRing,
  BookOpen,
  Briefcase,
  CalendarRange,
  ChevronLeft,
  FileSpreadsheet,
  FileText,
  HardDriveDownload,
  KeyRound,
  LogOut,
  Moon,
  Network,
  Pencil,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import type { AppSettings, View } from '../types';
import { useCan } from '../hooks/useSessionAuth';
import { cn, StoreMark, WorkspaceHeader } from './ui';

interface SettingsProps {
  onNavigate: (view: View) => void;
  onLogout: () => void;
  onOpenHelp: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  appSettings?: AppSettings;
  showHelpOnLogin?: boolean;
  onShowHelpOnLoginChange?: (value: boolean) => void;
}

const SettingsRow: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  mobileOnly?: boolean;
}> = ({ title, description, icon, onClick, mobileOnly }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'dash-card flex w-full items-center justify-between gap-3 p-4 text-right transition hover:border-[color:var(--brand)]/35',
      mobileOnly && 'md:hidden'
    )}
  >
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl tone-brand">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold text-[color:var(--ink)]">{title}</p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--muted)]">{description}</p>
      </div>
    </div>
    <ChevronLeft size={17} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
  </button>
);

const Settings: React.FC<SettingsProps> = ({
  onNavigate,
  onLogout,
  onOpenHelp,
  theme,
  setTheme,
  appSettings,
  showHelpOnLogin = false,
  onShowHelpOnLoginChange,
}) => {
  const can = useCan();
  const storeName = appSettings?.name || 'حسابداری من';

  return (
    <div className="mx-auto max-w-4xl animate-page-enter space-y-5 pb-28 md:pb-8">
      <WorkspaceHeader
        title="تنظیمات کلی"
        subtitle="پیکربندی ظاهر نرم‌افزار، مشخصات مجموعه، راهنما و امنیت"
      />

      {/* Single Business Identity Card (removed duplicate کسب‌وکار row below) */}
      {can('settings.business') ? (
        <button
          type="button"
          onClick={() => onNavigate('settingsBusiness')}
          className="dash-card group flex w-full items-center gap-3.5 p-4 text-right transition hover:border-[color:var(--brand)]/40"
        >
          <StoreMark name={storeName} logo={appSettings?.logo} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[color:var(--ink)]">{storeName}</p>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">ویرایش نام و لوگوی کسب‌وکار</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-[color:var(--brand)]">
            <Pencil size={14} />
            ویرایش
          </span>
        </button>
      ) : null}

      {/* Single Theme Segmented Switch (removed duplicate ThemeToggle button) */}
      <div className="dash-card p-4">
        <p className="mb-3 text-sm font-extrabold text-[color:var(--ink)]">حالت نمایش</p>
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[color:var(--surface-2)] p-1">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition',
              theme === 'light'
                ? 'btn-brand-gradient text-white'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            <Sun size={15} />
            تم روشن
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition',
              theme === 'dark'
                ? 'btn-brand-gradient text-white'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            )}
          >
            <Moon size={15} />
            حالت شب
          </button>
        </div>
      </div>

      {/* Mobile-only quick access to sections not in the 5-slot BottomNav */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {can('journals.view') ? (
          <>
            <SettingsRow
              mobileOnly
              title="فاکتورهای خرید و فروش"
              description="ثبت فاکتور با تصویر، پرداخت جزئی و مانده حساب"
              icon={<FileText size={18} />}
              onClick={() => onNavigate('invoices')}
            />
            <SettingsRow
              mobileOnly
              title="حقوق و کارکرد پرسنل"
              description="قرارداد ثابت سالانه، کارگری روزمزد و آبگیری"
              icon={<Briefcase size={18} />}
              onClick={() => onNavigate('payroll')}
            />
            <SettingsRow
              mobileOnly
              title="مدیریت چک‌ها"
              description="چک‌های پرداختی و دریافتی با یادآور سررسید"
              icon={<FileSpreadsheet size={18} />}
              onClick={() => onNavigate('checks')}
            />
            <SettingsRow
              mobileOnly
              title="مدیریت وام‌ها"
              description="اصل وام، سود تسهیلات و جدول اقساط"
              icon={<Banknote size={18} />}
              onClick={() => onNavigate('loans')}
            />
            <SettingsRow
              mobileOnly
              title="انتقال بین حساب‌ها"
              description="فهرست و ثبت جابه‌جایی وجه بین بانک‌ها و صندوق‌ها"
              icon={<ArrowLeftRight size={18} />}
              onClick={() => onNavigate('transfers')}
            />
          </>
        ) : null}
        {can('reports.view') ? (
          <>
            <SettingsRow
              mobileOnly
              title="گزارش ماهانه و ریز هزینه‌ها"
              description="تفکیک سرفصل، اشخاص و فاکتورها با نمایش تصویر"
              icon={<CalendarRange size={18} />}
              onClick={() => onNavigate('monthly-report')}
            />
            <SettingsRow
              mobileOnly
              title="گزارش‌های مالی"
              description="دفتر کل، تراز آزمایشی، اشخاص و خزانه"
              icon={<BarChart3 size={18} />}
              onClick={() => onNavigate('reports')}
            />
          </>
        ) : null}
        {can('settings.accounts') ? (
          <SettingsRow
            mobileOnly
            title="کدینگ و سرفصل‌ها"
            description="درخت حساب‌های درآمد، هزینه و بانک"
            icon={<Network size={18} />}
            onClick={() => onNavigate('chartOfAccounts')}
          />
        ) : null}
        {can('settings.accounts') ? (
          <SettingsRow
            title="سرفصل‌های پیش‌فرض و قالب مشاغل"
            description="انتخاب قالب کدینگ شغل و تعیین سرفصل پیش‌فرض فروش، خرید و هزینه‌ها"
            icon={<Network size={18} />}
            onClick={() => onNavigate('settingsAccountingDefaults')}
          />
        ) : null}
        {can('access.view') ? (
          <SettingsRow
            mobileOnly
            title="دسترسی و کاربران"
            description="نقش‌ها، مجوزها و حساب پرسنل"
            icon={<ShieldCheck size={18} />}
            onClick={() => onNavigate('access')}
          />
        ) : null}

        {can('settings.business') ? (
          <SettingsRow
            title="یادآورها و درگاه پیامک"
            description="تنظیم هشدار چک‌ها، اقساط وام و پیامک ایرانی"
            icon={<BellRing size={18} />}
            onClick={() => onNavigate('settingsReminders')}
          />
        ) : null}
        {can('settings.view') ? (
          <SettingsRow
            title="پروفایل کاربری"
            description="نام، شماره تماس و تصویر مدیر"
            icon={<UserRound size={18} />}
            onClick={() => onNavigate('profile')}
          />
        ) : null}
        {can('settings.password') ? (
          <SettingsRow
            title="امنیت و رمز عبور"
            description="تغییر رمز ورود مالک سیستم"
            icon={<KeyRound size={18} />}
            onClick={() => onNavigate('settingsPassword')}
          />
        ) : null}
        {can('settings.backup') || can('settings.demo') ? (
          <SettingsRow
            title="پشتیبان‌گیری و بازیابی"
            description="بکاپ خودکار، بازیابی و داده نمونه"
            icon={<HardDriveDownload size={18} />}
            onClick={() => onNavigate('settingsBackup')}
          />
        ) : null}
        <SettingsRow
          title="راهنمای جامع نرم‌افزار"
          description="آموزش گام‌به‌گام بخش‌های حسابداری"
          icon={<BookOpen size={18} />}
          onClick={onOpenHelp}
        />
      </div>

      {onShowHelpOnLoginChange ? (
        <div className="dash-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-[color:var(--ink)]">نمایش راهنما هنگام ورود</p>
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                باز شدن خودکار راهنما پس از ورود به سیستم
              </p>
            </div>
            <button
              type="button"
              role="switch"
              dir="ltr"
              aria-checked={showHelpOnLogin}
              aria-label="نمایش راهنما هنگام ورود"
              onClick={() => onShowHelpOnLoginChange(!showHelpOnLogin)}
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]/40',
                showHelpOnLogin ? 'bg-[color:var(--brand)]' : 'bg-slate-300 dark:bg-slate-600'
              )}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                  showHelpOnLogin ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--expense)]/25 bg-[color:var(--expense-soft)] py-3 text-sm font-extrabold text-[color:var(--expense)] transition hover:opacity-90"
      >
        <LogOut size={16} />
        خروج از حساب کاربری
      </button>
    </div>
  );
};

export default Settings;
