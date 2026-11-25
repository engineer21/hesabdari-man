import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  BellRing,
  BookOpenText,
  Boxes,
  Briefcase,
  Building2,
  CalendarRange,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  HardDriveDownload,
  Home,
  KeyRound,
  Landmark,
  Network,
  PieChart,
  ReceiptText,
  Scale,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import type { AppSession, View } from '../types';
import { can, canAccessView } from './permissions';

export type NavItem = {
  id: View;
  label: string;
  icon: LucideIcon;
  action?: 'transfer';
};

export type NavBranch = {
  id: string;
  label: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  items: NavItem[];
};

export type NavSection =
  | { kind: 'item'; item: NavItem }
  | { kind: 'branch'; branch: NavBranch };

const SIDEBAR_TREE: NavSection[] = [
  {
    kind: 'item',
    item: { id: 'dashboard', label: 'پیشخوان مالی', icon: Home },
  },
  {
    kind: 'branch',
    branch: {
      id: 'operations',
      label: 'عملیات روزانه',
      icon: ReceiptText,
      defaultOpen: true,
      items: [
        { id: 'invoices', label: 'فاکتورهای خرید و فروش', icon: FileText },
        { id: 'income', label: 'درآمدها و دریافت‌ها', icon: TrendingUp },
        { id: 'expense', label: 'هزینه‌ها و پرداخت‌ها', icon: TrendingDown },
        { id: 'payroll', label: 'حقوق و کارکرد پرسنل', icon: Briefcase },
        { id: 'checks', label: 'مدیریت چک‌ها', icon: FileSpreadsheet },
        { id: 'loans', label: 'مدیریت وام‌ها', icon: Banknote },
        { id: 'transfers', label: 'انتقال بین حساب‌ها', icon: ArrowLeftRight },
      ],
    },
  },
  {
    kind: 'branch',
    branch: {
      id: 'definitions',
      label: 'تعاریف پایه',
      icon: FolderKanban,
      defaultOpen: true,
      items: [
        { id: 'banks', label: 'بانک‌ها و صندوق‌ها', icon: Landmark },
        { id: 'persons', label: 'اشخاص و طرف‌حساب‌ها', icon: Users },
        { id: 'inventory', label: 'کالاها و انبارها', icon: Boxes },
        { id: 'chartOfAccounts', label: 'کدینگ و سرفصل‌ها', icon: Network },
      ],
    },
  },
  {
    kind: 'branch',
    branch: {
      id: 'reports',
      label: 'گزارش‌های مالی',
      icon: BarChart3,
      defaultOpen: true,
      items: [
        { id: 'monthly-report', label: 'گزارش ماهانه تفکیکی', icon: CalendarRange },
        { id: 'reports', label: 'داشبورد گزارشات', icon: PieChart },
        { id: 'account-ledger-report', label: 'دفتر کل و گردش حساب', icon: BookOpenText },
        { id: 'trial-balance-report', label: 'تراز آزمایشی و سودوزیان', icon: Scale },
        { id: 'persons-report', label: 'گزارش عملکرد اشخاص', icon: UserCheck },
        { id: 'treasury-report', label: 'گزارش خزانه و بانک‌ها', icon: WalletCards },
      ],
    },
  },
  {
    kind: 'branch',
    branch: {
      id: 'system',
      label: 'مدیریت و تنظیمات',
      icon: SlidersHorizontal,
      defaultOpen: false,
      items: [
        { id: 'settingsReminders', label: 'یادآورها و پیامک', icon: BellRing },
        { id: 'access', label: 'دسترسی و کاربران', icon: ShieldCheck },
        { id: 'settingsBusiness', label: 'مشخصات کسب‌وکار', icon: Building2 },
        { id: 'settingsPassword', label: 'امنیت و رمز عبور', icon: KeyRound },
        { id: 'settingsBackup', label: 'پشتیبان‌گیری و بازیابی', icon: HardDriveDownload },
        { id: 'profile', label: 'پروفایل کاربری', icon: UserRound },
        { id: 'settings', label: 'تنظیمات کلی', icon: Settings },
      ],
    },
  },
];

export const APP_NAV: NavItem[] = SIDEBAR_TREE.flatMap((section) =>
  section.kind === 'item'
    ? [section.item]
    : section.branch.items.filter((i) => !i.action)
);

export function navSectionsForSession(
  session: AppSession | null,
  options?: { canTransfer?: boolean }
): NavSection[] {
  if (!session) return [];
  const result: NavSection[] = [];

  for (const section of SIDEBAR_TREE) {
    if (section.kind === 'item') {
      if (canAccessView(session, section.item.id)) {
        result.push(section);
      }
      continue;
    }

    const allowedItems = section.branch.items.filter((item) => {
      if (item.action === 'transfer') {
        return Boolean(options?.canTransfer) && can(session, 'journals.create');
      }
      return canAccessView(session, item.id);
    });

    if (allowedItems.length > 0) {
      result.push({
        kind: 'branch',
        branch: { ...section.branch, items: allowedItems },
      });
    }
  }

  return result;
}

export function branchContainingView(view: View): string | null {
  for (const section of SIDEBAR_TREE) {
    if (section.kind === 'branch') {
      if (section.branch.items.some((item) => !item.action && item.id === view)) {
        return section.branch.id;
      }
    }
  }
  return null;
}

export function isReportView(view: View): boolean {
  return (
    view === 'reports' ||
    view === 'monthly-report' ||
    view === 'account-ledger-report' ||
    view === 'trial-balance-report' ||
    view === 'persons-report' ||
    view === 'treasury-report'
  );
}

export function breadcrumbForView(view: View): {
  parent: string;
  current: string;
  searchPlaceholder: string;
} {
  switch (view) {
    case 'dashboard':
      return { parent: 'پیشخوان', current: 'داشبورد مالی', searchPlaceholder: 'جست‌وجو در تراکنش‌ها و حساب‌ها...' };
    case 'invoices':
      return { parent: 'عملیات روزانه', current: 'فاکتورهای خرید و فروش', searchPlaceholder: 'جست‌وجو در فاکتورها...' };
    case 'income':
      return { parent: 'عملیات روزانه', current: 'درآمدها و دریافت‌ها', searchPlaceholder: 'جست‌وجو در درآمدها...' };
    case 'expense':
      return { parent: 'عملیات روزانه', current: 'هزینه‌ها و پرداخت‌ها', searchPlaceholder: 'جست‌وجو در هزینه‌ها...' };
    case 'payroll':
      return { parent: 'عملیات روزانه', current: 'حقوق و کارکرد پرسنل', searchPlaceholder: 'جست‌وجو در پرسنل و کارکردها...' };
    case 'checks':
      return { parent: 'عملیات روزانه', current: 'مدیریت چک‌ها', searchPlaceholder: 'جست‌وجو در چک‌ها...' };
    case 'loans':
      return { parent: 'عملیات روزانه', current: 'مدیریت وام‌ها', searchPlaceholder: 'جست‌وجو در وام‌ها و اقساط...' };
    case 'transfers':
      return { parent: 'عملیات روزانه', current: 'انتقال بین حساب‌ها', searchPlaceholder: 'جست‌وجو در انتقال‌ها...' };
    case 'banks':
      return { parent: 'تعاریف پایه', current: 'بانک‌ها و صندوق‌ها', searchPlaceholder: 'جست‌وجو در بانک‌ها...' };
    case 'persons':
      return { parent: 'تعاریف پایه', current: 'اشخاص و طرف‌حساب‌ها', searchPlaceholder: 'جست‌وجو در اشخاص...' };
    case 'inventory':
      return { parent: 'تعاریف پایه', current: 'کالاها و انبارها', searchPlaceholder: 'جست‌وجو در کالاها و انبارها...' };
    case 'chartOfAccounts':
      return { parent: 'تعاریف پایه', current: 'کدینگ و درخت سرفصل‌ها', searchPlaceholder: 'جست‌وجو در سرفصل‌ها...' };
    case 'monthly-report':
      return { parent: 'گزارش‌های مالی', current: 'گزارش ماهانه و ریز هزینه‌ها', searchPlaceholder: 'جست‌وجو در گزارش ماهانه...' };
    case 'reports':
      return { parent: 'گزارش‌های مالی', current: 'داشبورد گزارشات', searchPlaceholder: 'جست‌وجو در گزارش‌ها...' };
    case 'account-ledger-report':
      return { parent: 'گزارش‌های مالی', current: 'دفتر کل و گردش سرفصل', searchPlaceholder: 'جست‌وجو در گردش حساب...' };
    case 'trial-balance-report':
      return { parent: 'گزارش‌های مالی', current: 'تراز آزمایشی و سود و زیان', searchPlaceholder: 'جست‌وجو در تراز آزمایشی...' };
    case 'persons-report':
      return { parent: 'گزارش‌های مالی', current: 'عملکرد و تراز اشخاص', searchPlaceholder: 'جست‌وجو در گزارش اشخاص...' };
    case 'treasury-report':
      return { parent: 'گزارش‌های مالی', current: 'گردش خزانه و بانک‌ها', searchPlaceholder: 'جست‌وجو در گردش خزانه...' };
    case 'settingsReminders':
      return { parent: 'مدیریت و تنظیمات', current: 'یادآورها و درگاه پیامک', searchPlaceholder: 'جست‌وجو...' };
    case 'access':
      return { parent: 'مدیریت و تنظیمات', current: 'دسترسی و کاربران', searchPlaceholder: 'جست‌وجو در دسترسی‌ها...' };
    case 'settings':
      return { parent: 'مدیریت و تنظیمات', current: 'تنظیمات کلی', searchPlaceholder: 'جست‌وجو در تنظیمات...' };
    case 'settingsBusiness':
      return { parent: 'مدیریت و تنظیمات', current: 'مشخصات کسب‌وکار', searchPlaceholder: 'جست‌وجو...' };
    case 'settingsPassword':
      return { parent: 'مدیریت و تنظیمات', current: 'امنیت و رمز عبور', searchPlaceholder: 'جست‌وجو...' };
    case 'settingsBackup':
      return { parent: 'مدیریت و تنظیمات', current: 'پشتیبان‌گیری و بازیابی', searchPlaceholder: 'جست‌وجو...' };
    case 'profile':
      return { parent: 'مدیریت و تنظیمات', current: 'پروفایل کاربری', searchPlaceholder: 'جست‌وجو...' };
    default:
      return { parent: 'پیشخوان', current: 'داشبورد مالی', searchPlaceholder: 'جست‌وجو...' };
  }
}
