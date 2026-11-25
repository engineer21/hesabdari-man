/** Permission presets — mirrors client utils/permissions.ts */

export const ALL_PERMISSIONS = [
  'dashboard.view',
  'journals.view',
  'journals.create',
  'journals.edit',
  'journals.delete',
  'journals.export',
  'contacts.view',
  'contacts.create',
  'contacts.edit',
  'contacts.delete',
  'reports.view',
  'reports.export',
  'settings.view',
  'settings.business',
  'settings.demo',
  'settings.accounts',
  'settings.backup',
  'settings.password',
  'access.view',
];

export const OWNER_ONLY_PERMISSIONS = new Set([
  'access.view',
  'settings.backup',
  'settings.password',
]);

const ALL_SET = new Set(ALL_PERMISSIONS);

export function sanitizeGroupPermissions(perms = []) {
  return [...new Set(perms)].filter((p) => ALL_SET.has(p) && !OWNER_ONLY_PERMISSIONS.has(p));
}

export function buildPresetGroups() {
  const views = (withSettings) =>
    ALL_PERMISSIONS.filter(
      (p) =>
        p.endsWith('.view') &&
        p !== 'access.view' &&
        (withSettings || p !== 'settings.view')
    );

  return [
    {
      id: 'grp_manager',
      name: 'مدیر',
      description: 'دسترسی کامل — مدیریت کاربران فقط با مالک',
      permissions: sanitizeGroupPermissions(ALL_PERMISSIONS),
      isSystem: true,
    },
    {
      id: 'grp_accountant',
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
      id: 'grp_cashier',
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
      id: 'grp_viewer',
      name: 'مشاهده‌گر',
      description: 'فقط مشاهده بدون تغییر',
      permissions: views(false),
      isSystem: true,
    },
  ];
}

export function sessionCan(session, permission) {
  if (!session) return false;
  if (session.kind === 'owner') return true;
  if (OWNER_ONLY_PERMISSIONS.has(permission)) return false;
  return Array.isArray(session.permissions) && session.permissions.includes(permission);
}
