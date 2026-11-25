import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Crown,
  Database,
  Eye,
  Plus,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AppSession, Permission, PermissionGroup, StaffUser } from '../types';
import {
  getPermissionGroups,
  getStaffUsers,
  hashPassword,
  resolveSession,
  savePermissionGroups,
  saveStaffUsers,
} from '../utils/auth';
import { catalogForMatrix } from '../utils/permissions';
import { PermissionMatrix } from './PermissionMatrix';
import { useDialog } from './DialogProvider';
import {
  Button,
  Field,
  FormActions,
  FormSheet,
  WorkspaceHeader,
  cn,
  fieldInput,
  formatCount,
} from './ui';
import { SettingsPanel } from './settings/SettingsShell';

type Tab = 'groups' | 'users';

const GROUP_ICONS = [Shield, Users, Database, Eye];

export default function AccessView({
  onSessionChange,
}: {
  onSessionChange?: (s: AppSession | null) => void;
}) {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>('groups');
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [groupSheet, setGroupSheet] = useState<PermissionGroup | 'new' | null>(null);
  const [gName, setGName] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gPerms, setGPerms] = useState<Permission[]>([]);
  const [gMsg, setGMsg] = useState('');

  const [userSheet, setUserSheet] = useState<StaffUser | 'new' | null>(null);
  const [uName, setUName] = useState('');
  const [uUser, setUUser] = useState('');
  const [uPass, setUPass] = useState('');
  const [uGroupId, setUGroupId] = useState('');
  const [uActive, setUActive] = useState(true);
  const [uMsg, setUMsg] = useState('');

  const reload = () => {
    const g = getPermissionGroups();
    const u = getStaffUsers();
    setGroups(g);
    setUsers(u);
    setSelectedGroupId((prev) =>
      prev && g.some((x) => x.id === prev) ? prev : g[0]?.id || null
    );
  };

  useEffect(() => {
    reload();
  }, []);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const userCountByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of users) map[u.groupId] = (map[u.groupId] || 0) + 1;
    return map;
  }, [users]);

  const openGroup = (g: PermissionGroup | 'new') => {
    setGMsg('');
    if (g === 'new') {
      setGroupSheet('new');
      setGName('');
      setGDesc('');
      setGPerms([]);
      return;
    }
    setGroupSheet(g);
    setGName(g.name);
    setGDesc(g.description || '');
    setGPerms([...g.permissions]);
  };

  const openUser = (u: StaffUser | 'new') => {
    setUMsg('');
    if (u === 'new') {
      setUserSheet('new');
      setUName('');
      setUUser('');
      setUPass('');
      setUGroupId(groups[0]?.id || '');
      setUActive(true);
      return;
    }
    setUserSheet(u);
    setUName(u.displayName);
    setUUser(u.username);
    setUPass('');
    setUGroupId(u.groupId);
    setUActive(u.active);
  };

  const saveGroup = async () => {
    if (!gName.trim()) {
      setGMsg('نام گروه الزامی است.');
      return;
    }
    const next: PermissionGroup = {
      id: groupSheet === 'new' ? `grp_${crypto.randomUUID()}` : (groupSheet as PermissionGroup).id,
      name: gName.trim(),
      description: gDesc.trim(),
      permissions: gPerms,
      isSystem: groupSheet !== 'new' ? (groupSheet as PermissionGroup).isSystem : false,
    };
    const list =
      groupSheet === 'new' ? [...groups, next] : groups.map((g) => (g.id === next.id ? next : g));
    await savePermissionGroups(list);
    setGroupSheet(null);
    reload();
    onSessionChange?.(resolveSession());
  };

  const deleteGroup = async (g: PermissionGroup) => {
    if (g.isSystem) {
      await dialog.alert({ message: 'گروه‌های سیستمی قابل حذف نیستند.', tone: 'warning' });
      return;
    }
    if ((userCountByGroup[g.id] || 0) > 0) {
      await dialog.alert({ message: 'ابتدا کاربران این گروه را جابه‌جا کنید.', tone: 'warning' });
      return;
    }
    const ok = await dialog.confirm({
      title: 'حذف گروه',
      message: `حذف گروه «${g.name}»؟`,
      tone: 'danger',
      confirmLabel: 'حذف',
    });
    if (!ok) return;
    await savePermissionGroups(groups.filter((x) => x.id !== g.id));
    reload();
  };

  const saveUser = async () => {
    if (!uName.trim() || !uUser.trim() || !uGroupId) {
      setUMsg('نام، نام کاربری و گروه الزامی است.');
      return;
    }
    if (userSheet === 'new' && !uPass) {
      setUMsg('رمز عبور برای کاربر جدید الزامی است.');
      return;
    }
    const dup = users.find(
      (u) =>
        u.username === uUser.trim() && (userSheet === 'new' || u.id !== (userSheet as StaffUser).id)
    );
    if (dup) {
      setUMsg('این نام کاربری قبلاً ثبت شده است.');
      return;
    }
    const hashed = uPass
      ? await hashPassword(uPass)
      : userSheet !== 'new'
        ? (userSheet as StaffUser).hashedPassword
        : '';
    const next: StaffUser = {
      id: userSheet === 'new' ? `usr_${crypto.randomUUID()}` : (userSheet as StaffUser).id,
      username: uUser.trim(),
      displayName: uName.trim(),
      hashedPassword: hashed,
      groupId: uGroupId,
      active: uActive,
    };
    const list =
      userSheet === 'new' ? [...users, next] : users.map((u) => (u.id === next.id ? next : u));
    await saveStaffUsers(list);
    setUserSheet(null);
    reload();
    onSessionChange?.(resolveSession());
  };

  const deleteUser = async (u: StaffUser) => {
    const ok = await dialog.confirm({
      title: 'حذف کاربر',
      message: `حذف کاربر «${u.displayName}»؟`,
      tone: 'danger',
      confirmLabel: 'حذف',
    });
    if (!ok) return;
    await saveStaffUsers(users.filter((x) => x.id !== u.id));
    reload();
  };

  return (
    <div className="animate-page-enter mx-auto max-w-6xl space-y-5 pb-28 md:space-y-6 md:pb-8">
      <WorkspaceHeader
        title="دسترسی و کاربران"
        subtitle="مدیریت نقش‌ها، گروه‌های مجوز و حساب‌های ورود پرسنل"
        primaryAction={
          tab === 'groups' ? (
            <Button size="sm" icon={Plus} onClick={() => openGroup('new')}>
              گروه جدید
            </Button>
          ) : (
            <Button size="sm" icon={UserPlus} onClick={() => openUser('new')}>
              کاربر جدید
            </Button>
          )
        }
      />

      {/* Top 3 KPI Stats */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5" data-testid="access-stats">
        <div
          className="balance-gradient relative hidden flex-col justify-center overflow-hidden rounded-[1.4rem] p-4 text-white shadow-[0_18px_40px_-14px_rgba(10,95,243,0.48)] sm:flex sm:p-5"
          data-testid="stat-groups"
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M-20 88 C 90 66, 190 100, 430 58"
              stroke="rgba(56,225,255,0.32)"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          <div className="relative flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/85">گروه‌های دسترسی</p>
              <p className="mt-1 text-3xl font-black tabular-nums">{formatCount(groups.length)}</p>
            </div>
            <span className="dash-icon-glow flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/18 text-white">
              <Shield size={21} strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div
          className="dash-card relative flex items-center justify-between gap-2 p-3 sm:hidden"
          data-testid="stat-groups-mobile"
        >
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-[color:var(--muted)]">گروه‌ها</p>
            <p className="mt-1 text-xl font-black tabular-nums text-[color:var(--ink)]">
              {formatCount(groups.length)}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
            <Shield size={17} />
          </span>
        </div>

        {[
          {
            label: 'کاربران',
            short: 'کاربران',
            value: users.length,
            icon: Users,
            tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
            testId: 'stat-users',
          },
          {
            label: 'کاربران فعال',
            short: 'فعال',
            value: users.filter((u) => u.active).length,
            icon: Sparkles,
            tone: 'tone-income',
            testId: 'stat-active',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="dash-card flex items-center justify-between gap-2 p-3 sm:p-5"
              data-testid={stat.testId}
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-[color:var(--muted)] sm:text-xs">
                  <span className="sm:hidden">{stat.short}</span>
                  <span className="hidden sm:inline">{stat.label}</span>
                </p>
                <p className="mt-1 text-xl font-black tabular-nums text-[color:var(--ink)] sm:text-3xl">
                  {formatCount(stat.value)}
                </p>
              </div>
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl',
                  stat.tone
                )}
              >
                <Icon size={17} className="sm:hidden" />
                <Icon size={21} className="hidden sm:block" />
              </span>
            </div>
          );
        })}
      </div>

      {/* Segmented Switcher */}
      <div
        className="flex w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] p-1 shadow-[var(--shadow-sm)] sm:inline-flex sm:w-auto"
        data-testid="access-tabs"
      >
        {(
          [
            { id: 'groups' as const, label: 'سطح دسترسی', icon: Shield },
            { id: 'users' as const, label: 'کاربران', icon: Users },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold transition sm:flex-none',
                active
                  ? 'btn-brand-gradient text-white shadow-[0_6px_16px_var(--brand-glow)]'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
              )}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'groups' ? (
        <div className="grid gap-4 md:grid-cols-[240px_1fr] lg:grid-cols-[270px_1fr]">
          <aside className="dash-card overflow-hidden">
            <div className="border-b border-[color:var(--line)] px-4 py-3 text-xs font-extrabold text-[color:var(--muted)]">
              گروه‌های دسترسی
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto p-2.5 md:flex-col md:overflow-visible">
              {groups.map((g, i) => {
                const GIcon = GROUP_ICONS[i % GROUP_ICONS.length];
                const selected = selectedGroupId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGroupId(g.id)}
                    className={cn(
                      'flex w-[7.75rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2.5 py-3 text-center transition md:w-full md:flex-row md:gap-2.5 md:rounded-xl md:px-3 md:text-right',
                      selected
                        ? 'btn-brand-gradient border-transparent text-white shadow-[0_8px_20px_var(--brand-glow)]'
                        : 'border-[color:var(--line)] bg-[color:var(--surface-1)] text-[color:var(--ink)] hover:border-[color:var(--brand)]/35'
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'order-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl md:hidden',
                        selected
                          ? 'bg-white/20 text-white'
                          : 'bg-[color:var(--surface-2)] text-[color:var(--muted)]'
                      )}
                    >
                      <GIcon size={16} />
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'order-3 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 md:order-1',
                        selected ? 'border-white/90' : 'border-[color:var(--muted)]/45'
                      )}
                    >
                      {selected ? <span className="block h-1.5 w-1.5 rounded-full bg-white" /> : null}
                    </span>
                    <span className="order-2 min-w-0 flex-1">
                      <span className="block w-full truncate text-xs font-extrabold md:text-sm">
                        {g.name}
                      </span>
                      {g.isSystem ? (
                        <span
                          className={cn(
                            'block w-full text-[10px] font-semibold',
                            selected ? 'text-white/80' : 'text-[color:var(--muted)]'
                          )}
                        >
                          سیستمی
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'hidden h-6 min-w-[1.5rem] items-center justify-center rounded-lg px-1.5 text-[10px] font-bold tabular-nums md:order-3 md:flex',
                        selected
                          ? 'bg-white/20 text-white'
                          : 'bg-[color:var(--surface-2)] text-[color:var(--muted)]'
                      )}
                    >
                      {formatCount(userCountByGroup[g.id] || 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <SettingsPanel
            title={selectedGroup?.name || 'انتخاب گروه'}
            description={selectedGroup?.description || 'یک گروه را از فهرست انتخاب کنید.'}
            className="min-h-[20rem]"
          >
            {selectedGroup ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedGroup.isSystem ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--brand)]">
                        <Crown size={12} />
                        گروه سیستمی
                      </span>
                    ) : null}
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full tone-income px-3 py-1.5 text-[11px] font-extrabold tabular-nums"
                      data-testid="perm-pill"
                    >
                      <CheckCircle2 size={13} aria-hidden />
                      {formatCount(selectedGroup.permissions.length)} از{' '}
                      {formatCount(catalogForMatrix().length)} مجوز فعال
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openGroup(selectedGroup)}>
                      ویرایش
                    </Button>
                    {!selectedGroup.isSystem ? (
                      <Button
                        variant="soft-danger"
                        size="sm"
                        onClick={() => void deleteGroup(selectedGroup)}
                      >
                        حذف
                      </Button>
                    ) : null}
                  </div>
                </div>
                <PermissionMatrix value={selectedGroup.permissions} readOnly />
              </div>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">یک گروه را انتخاب کنید.</p>
            )}
          </SettingsPanel>
        </div>
      ) : (
        <SettingsPanel title="کاربران سیستم" description="حساب‌های ورود پرسنل با گروه دسترسی اختصاصی">
          {users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-2)]/50 px-6 py-12 text-center">
              <UserPlus className="mx-auto text-[color:var(--brand)]" size={32} />
              <p className="mt-3 font-extrabold text-[color:var(--ink)]">هنوز کاربری تعریف نشده</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                ابتدا گروه دسترسی را بررسی کنید، سپس برای همکاران حساب کاربری بسازید.
              </p>
              <Button className="mt-4" icon={UserPlus} onClick={() => openUser('new')}>
                اولین کاربر
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => {
                const group = groups.find((g) => g.id === u.groupId);
                const initial = u.displayName.trim().charAt(0) || 'ک';
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] p-4 shadow-[var(--shadow-sm)]"
                  >
                    <div className="btn-brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black text-white">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[color:var(--ink)]">{u.displayName}</p>
                      <p className="text-xs font-semibold text-[color:var(--muted)]">
                        @{u.username} · {group?.name || 'بدون گروه'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-[11px] font-bold',
                        u.active
                          ? 'tone-income'
                          : 'bg-[color:var(--surface-2)] text-[color:var(--muted)]'
                      )}
                    >
                      {u.active ? 'فعال' : 'غیرفعال'}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openUser(u)}>
                        ویرایش
                      </Button>
                      <Button variant="soft-danger" size="sm" onClick={() => void deleteUser(u)}>
                        حذف
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SettingsPanel>
      )}

      {/* Group Modal */}
      <FormSheet
        isOpen={groupSheet != null}
        onClose={() => setGroupSheet(null)}
        dock
        accent="brand"
        title={groupSheet === 'new' ? 'گروه دسترسی جدید' : 'ویرایش گروه دسترسی'}
        subtitle="تغییر نام، توضیحات و مجوزهای گروه دسترسی"
        headerChip={
          <span className="btn-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            <Shield size={19} strokeWidth={1.8} />
          </span>
        }
        size="lg"
        footer={
          <FormActions
            onCancel={() => setGroupSheet(null)}
            onSubmit={saveGroup}
            submitLabel={groupSheet === 'new' ? 'افزودن گروه' : 'ذخیره تغییرات'}
            submitIcon={groupSheet === 'new' ? Plus : Check}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          <div className="form-section grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
            <Field label="نام گروه">
              <input className={fieldInput} value={gName} onChange={(e) => setGName(e.target.value)} />
            </Field>
            <Field label="توضیحات (اختیاری)">
              <input className={fieldInput} value={gDesc} onChange={(e) => setGDesc(e.target.value)} />
            </Field>
          </div>
          <PermissionMatrix value={gPerms} onChange={setGPerms} />
          {gMsg ? <p className="rounded-xl tone-expense px-3 py-2 text-sm font-medium">{gMsg}</p> : null}
        </div>
      </FormSheet>

      {/* Staff User Modal */}
      <FormSheet
        isOpen={userSheet != null}
        onClose={() => setUserSheet(null)}
        dock
        size="md"
        accent="brand"
        title={userSheet === 'new' ? 'کاربر جدید' : 'ویرایش کاربر'}
        subtitle={
          userSheet === 'new'
            ? 'حساب ورود جدید برای پرسنل بسازید'
            : 'اطلاعات حساب ورود را ویرایش کنید'
        }
        headerChip={
          <span className="btn-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            <Users size={19} strokeWidth={1.8} />
          </span>
        }
        footer={
          <FormActions
            onCancel={() => setUserSheet(null)}
            onSubmit={() => void saveUser()}
            submitLabel={userSheet === 'new' ? 'افزودن کاربر' : 'ذخیره تغییرات'}
            submitIcon={userSheet === 'new' ? UserPlus : Check}
          />
        }
      >
        <div className="space-y-3.5 sm:space-y-4">
          <div className="form-section grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 sm:gap-4">
            <Field label="نام نمایشی">
              <input className={fieldInput} value={uName} onChange={(e) => setUName(e.target.value)} />
            </Field>
            <Field label="نام کاربری">
              <input
                className={fieldInput}
                dir="ltr"
                value={uUser}
                onChange={(e) => setUUser(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label={userSheet === 'new' ? 'رمز عبور' : 'رمز جدید (اختیاری)'}>
              <input
                type="password"
                dir="ltr"
                className={fieldInput}
                value={uPass}
                onChange={(e) => setUPass(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="گروه دسترسی">
              <select
                className={fieldInput}
                value={uGroupId}
                onChange={(e) => setUGroupId(e.target.value)}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-2.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 px-4 py-3 text-sm font-bold text-[color:var(--ink)] transition hover:border-[color:var(--brand)]/30">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[color:var(--brand)]"
              checked={uActive}
              onChange={(e) => setUActive(e.target.checked)}
            />
            کاربر فعال باشد
          </label>
          {uMsg ? <p className="rounded-xl tone-expense px-3 py-2 text-sm font-medium">{uMsg}</p> : null}
        </div>
      </FormSheet>
    </div>
  );
}
