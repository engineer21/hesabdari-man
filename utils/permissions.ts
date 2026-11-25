import type { AppSession, Permission, PermissionGroup, View } from '../types';

export type PermissionModule =
  | 'dashboard'
  | 'journals'
  | 'contacts'
  | 'reports'
  | 'settings';

type Action =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'business'
  | 'demo'
  | 'accounts'
  | 'backup'
  | 'password';

export const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: 'داشبورد',
  journals: 'درآمد و هزینه',
  contacts: 'اشخاص',
  reports: 'گزارشات',
  settings: 'تنظیمات',
};

const ACTION_LABELS: Record<Action, string> = {
  view: 'مشاهده',
  create: 'ثبت',
  edit: 'ویرایش',
  delete: 'حذف',
  export: 'خروجی',
  business: 'لوگو و نام',
  demo: 'داده نمونه',
  accounts: 'بانک و سرفصل',
  backup: 'پشتیبان',
  password: 'رمز مالک',
};

export const MODULE_ACTIONS: Record<PermissionModule, readonly Action[]> = {
  dashboard: ['view'],
  journals: ['view', 'create', 'edit', 'delete', 'export'],
  contacts: ['view', 'create', 'edit', 'delete'],
  reports: ['view', 'export'],
  settings: ['view', 'business', 'demo', 'accounts', 'backup', 'password'],
};

export type PermissionMeta = {
  id: Permission;
  module: PermissionModule;
  action: Action;
  label: string;
};

export const PERMISSION_CATALOG: PermissionMeta[] = (
  Object.entries(MODULE_ACTIONS) as [PermissionModule, readonly Action[]][]
).flatMap(([module, actions]) =>
  actions.map((action) => ({
    id: `${module}.${action}` as Permission,
    module,
    action,
    label: ACTION_LABELS[action],
  }))
);

export const ALL_PERMISSIONS: Permission[] = [
  ...PERMISSION_CATALOG.map((p) => p.id),
  'access.view',
];

const ALL_SET = new Set<string>(ALL_PERMISSIONS);

export const OWNER_ONLY_PERMISSIONS: Permission[] = [
  'access.view',
  'settings.backup',
  'settings.password',
];
const OWNER_ONLY = new Set<string>(OWNER_ONLY_PERMISSIONS);

export const VIEW_PERMISSION: Partial<Record<View, Permission>> = {
  dashboard: 'dashboard.view',
  income: 'journals.view',
  expense: 'journals.view',
  invoices: 'journals.view',
  transfers: 'journals.view',
  payroll: 'journals.view',
  checks: 'journals.view',
  loans: 'journals.view',
  banks: 'settings.accounts',
  persons: 'contacts.view',
  inventory: 'journals.view',
  chartOfAccounts: 'settings.accounts',
  reports: 'reports.view',
  'monthly-report': 'reports.view',
  'account-ledger-report': 'reports.view',
  'trial-balance-report': 'reports.view',
  'persons-report': 'reports.view',
  'treasury-report': 'reports.view',
  access: 'access.view',
  settings: 'settings.view',
  settingsPassword: 'settings.password',
  settingsBusiness: 'settings.business',
  settingsAccountingDefaults: 'settings.accounts',
  settingsBackup: 'settings.backup',
  settingsReminders: 'settings.business',
  profile: 'settings.view',
};

export function sanitizeGroupPermissions(perms: readonly string[]): Permission[] {
  return [...new Set(perms)].filter(
    (p): p is Permission => ALL_SET.has(p) && !OWNER_ONLY.has(p)
  );
}

export function catalogForMatrix(): PermissionMeta[] {
  return PERMISSION_CATALOG.filter((p) => !OWNER_ONLY.has(p.id));
}

export function permissionsForModule(module: PermissionModule): PermissionMeta[] {
  return catalogForMatrix().filter((p) => p.module === module);
}

export function can(session: AppSession | null | undefined, permission: Permission): boolean {
  if (!session) return false;
  if (session.kind === 'owner') return true;
  if (OWNER_ONLY.has(permission)) return false;
  return session.permissions.includes(permission);
}

export function canAccessView(session: AppSession | null | undefined, view: View | string): boolean {
  if (view === 'settingsBackup') {
    return can(session, 'settings.backup') || can(session, 'settings.demo');
  }
  const perm = VIEW_PERMISSION[view as View];
  return Boolean(perm && can(session, perm));
}

export function firstAllowedView(session: AppSession): View {
  const order: View[] = [
    'dashboard',
    'income',
    'expense',
    'banks',
    'persons',
    'chartOfAccounts',
    'reports',
    'settings',
  ];
  return order.find((v) => canAccessView(session, v)) || 'dashboard';
}

export const PRESET_GROUP_IDS = {
  manager: 'grp_manager',
  accountant: 'grp_accountant',
  cashier: 'grp_cashier',
  viewer: 'grp_viewer',
} as const;

export function buildPresetGroups(): PermissionGroup[] {
  const views = (withSettings: boolean) =>
    ALL_PERMISSIONS.filter(
      (p) =>
        p.endsWith('.view') &&
        p !== 'access.view' &&
        (withSettings || p !== 'settings.view')
    );

  return [
    {
      id: PRESET_GROUP_IDS.manager,
      name: 'مدیر',
      description: 'دسترسی کامل — مدیریت کاربران فقط با مالک',
      permissions: sanitizeGroupPermissions(ALL_PERMISSIONS),
      isSystem: true,
    },
    {
      id: PRESET_GROUP_IDS.accountant,
      name: 'حسابدار',
      description: 'ثبت، ویرایش، گزارش و مدیریت بانک/سرفصل',
      permissions: sanitizeGroupPermissions([
        'dashboard.view',
        'journals.view',
        'journals.create',
        'journals.edit',
        'journals.export',
        'contacts.view',
        'contacts.create',
        'contacts.edit',
        'reports.view',
        'reports.export',
        'settings.view',
        'settings.business',
        'settings.accounts',
      ]),
      isSystem: true,
    },
    {
      id: PRESET_GROUP_IDS.cashier,
      name: 'صندوقدار',
      description: 'ثبت روزانه درآمد و هزینه',
      permissions: [
        'dashboard.view',
        'journals.view',
        'journals.create',
        'journals.edit',
        'contacts.view',
        'settings.view',
      ],
      isSystem: true,
    },
    {
      id: PRESET_GROUP_IDS.viewer,
      name: 'مشاهده‌گر',
      description: 'فقط مشاهده بدون تغییر',
      permissions: views(false),
      isSystem: true,
    },
  ];
}
