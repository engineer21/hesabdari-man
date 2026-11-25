import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Building2,
  ChevronDown,
  CloudUpload,
  Database,
  Eye,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Pencil,
  Plus,
  Receipt,
  Settings2,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type { Permission } from '../types';
import { formatCount, cn } from './ui';
import {
  MODULE_LABELS,
  type PermissionModule,
  catalogForMatrix,
  permissionsForModule,
} from '../utils/permissions';

const MODULES = Object.keys(MODULE_LABELS) as PermissionModule[];

const MODULE_ICONS: Record<PermissionModule, LucideIcon> = {
  dashboard: LayoutDashboard,
  journals: Receipt,
  contacts: Users,
  reports: BarChart3,
  settings: Settings2,
};

const MODULE_TONES: Record<PermissionModule, string> = {
  dashboard: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  journals: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  contacts: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  reports: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  settings: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

type MatrixAction =
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

const ACTION_ICONS: Partial<Record<MatrixAction, LucideIcon>> = {
  view: Eye,
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  export: Upload,
  business: Building2,
  demo: Database,
  accounts: Landmark,
  backup: CloudUpload,
  password: KeyRound,
};

const PERMISSION_HINTS: Partial<Record<Permission, string>> = {
  'settings.business': 'لوگو و نام مجموعه',
  'settings.demo': 'بارگذاری نمونه کارخانه',
  'settings.accounts': 'بانک‌ها و سرفصل‌ها',
  'settings.view': 'پروفایل و تنظیمات عمومی',
};

export function PermissionMatrix({
  value,
  onChange,
  readOnly = false,
}: {
  value: Permission[];
  onChange?: (next: Permission[]) => void;
  readOnly?: boolean;
}) {
  const selected = new Set(value);
  const total = catalogForMatrix().length;
  const [openModules, setOpenModules] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      return new Set(['journals']);
    }
    return new Set(MODULES);
  });

  const toggleModuleOpen = (module: PermissionModule) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const toggle = (id: Permission) => {
    if (readOnly || !onChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const toggleModule = (module: PermissionModule, enable: boolean) => {
    if (readOnly || !onChange) return;
    const ids = permissionsForModule(module).map((p) => p.id);
    const next = new Set(selected);
    for (const id of ids) {
      if (enable) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  };

  return (
    <div className="space-y-3">
      {MODULES.map((module) => {
        const rows = permissionsForModule(module);
        if (!rows.length) return null;
        const onCount = rows.filter((r) => selected.has(r.id)).length;
        const allOn = onCount === rows.length;
        const ModuleIcon = MODULE_ICONS[module];
        const isOpen = openModules.has(module);
        return (
          <div
            key={module}
            data-testid={`perm-section-${module}`}
            className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)]/85 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[color:var(--line)]/70 bg-[color:var(--surface-2)]/65 px-4 py-3">
              <button
                type="button"
                data-testid={`perm-toggle-${module}`}
                aria-expanded={isOpen}
                onClick={() => toggleModuleOpen(module)}
                className="flex min-w-0 flex-1 items-center gap-3 text-right"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    MODULE_TONES[module]
                  )}
                >
                  <ModuleIcon size={17} strokeWidth={1.85} />
                </div>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-[color:var(--ink)]">
                    {MODULE_LABELS[module]}
                  </span>
                  <span className="block text-[10px] font-semibold text-[color:var(--muted)]">
                    {formatCount(onCount)} از {formatCount(rows.length)} فعال
                  </span>
                </span>
                <ChevronDown
                  size={15}
                  aria-hidden
                  className={cn(
                    'ms-auto shrink-0 text-[color:var(--muted)] transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => toggleModule(module, !allOn)}
                  className={cn(
                    'shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold transition',
                    allOn
                      ? 'btn-brand-gradient text-white shadow-[0_6px_14px_var(--brand-glow)]'
                      : 'bg-[color:var(--surface-1)] text-[color:var(--muted)] ring-1 ring-[color:var(--line)] hover:text-[color:var(--ink)]'
                  )}
                >
                  {allOn ? 'همه ✓' : 'انتخاب همه'}
                </button>
              ) : null}
            </div>
            {isOpen ? (
              <div
                className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2"
                data-testid={`perm-rows-${module}`}
              >
                {rows.map((row) => {
                  const on = selected.has(row.id);
                  const hint = PERMISSION_HINTS[row.id];
                  const RowIcon = ACTION_ICONS[row.action as MatrixAction];
                  return (
                    <button
                      key={row.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggle(row.id)}
                      className={cn(
                        'flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-right transition',
                        on
                          ? 'bg-[color:var(--brand-soft)] text-[color:var(--ink)] ring-1 ring-[color:var(--brand)]/25'
                          : 'bg-[color:var(--surface-2)]/75 text-[color:var(--muted)] hover:bg-[color:var(--surface-2)]',
                        readOnly && 'cursor-default opacity-95'
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {RowIcon ? (
                          <RowIcon size={14} className="shrink-0 opacity-75" aria-hidden />
                        ) : null}
                        <span className="min-w-0">
                          <span className="block text-xs font-bold">{row.label}</span>
                          {hint ? (
                            <span className="mt-0.5 block text-[10px] font-medium opacity-75">
                              {hint}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                          on
                            ? 'justify-end bg-[color:var(--brand)]'
                            : 'justify-start bg-slate-300 dark:bg-slate-600'
                        )}
                      >
                        <span className="block h-4 w-4 rounded-full bg-white shadow-sm" />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 px-4 py-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold leading-relaxed text-[color:var(--muted)]">
          <Building2 size={14} className="shrink-0 text-[color:var(--brand)]" />
          {formatCount(value.length)} از {formatCount(total)} مجوز · پشتیبان، پاک‌سازی و رمز فقط برای مالک
        </p>
      </div>
    </div>
  );
}
