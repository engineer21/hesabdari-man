import type { ReactNode, FC } from 'react';
import {
  Bell,
  ChevronDown,
  CircleHelp,
  LogOut,
  Menu,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AppSession, AppSettings, View } from '../types';
import {
  branchContainingView,
  breadcrumbForView,
  navSectionsForSession,
  type NavItem,
} from '../utils/appNav';
import { canAccessView, can } from '../utils/permissions';
import { toPersianDigits } from '../utils/formatters';
import { useFormWorkspace } from '../hooks/useFormWorkspace';
import { IconButton, StoreMark, cn } from './ui';

function NavTooltip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: ReactNode;
}) {
  return (
    <div className="group/tip relative">
      {children}
      {show ? (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute top-1/2 z-50 start-full ms-3 -translate-y-1/2',
            'whitespace-nowrap rounded-xl border border-white/15 bg-[#081a3d]/95 px-3 py-1.5 text-[11px] font-bold text-white shadow-xl backdrop-blur-md',
            'opacity-0 scale-95 transition-[opacity,transform] duration-150',
            'group-hover/tip:opacity-100 group-hover/tip:scale-100',
            'group-focus-within/tip:opacity-100 group-focus-within/tip:scale-100'
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

function RailIconButton({
  label,
  onClick,
  children,
  variant = 'default',
  active,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  variant?: 'default' | 'danger' | 'brand';
  active?: boolean;
}) {
  return (
    <NavTooltip label={label} show>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b8dff]/45',
          active && 'sidebar-active-pill ring-1 ring-white/25',
          !active && variant === 'danger' && 'bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white',
          !active && variant === 'brand' && 'bg-white/10 text-sky-200 hover:bg-white/16 hover:text-white',
          !active && variant === 'default' && 'text-[#9cb4da] hover:bg-white/10 hover:text-white'
        )}
      >
        {children}
      </button>
    </NavTooltip>
  );
}

export function AppLayout({
  view,
  onViewChange,
  onOpenTransfer,
  canTransfer = false,
  store,
  session,
  onLogout,
  onOpenHelp,
  onOpenSearch,
  theme,
  setTheme,
  userPicture,
  children,
  mobileFooter,
  alerts = [],
}: {
  view: View;
  onViewChange: (v: View) => void;
  onOpenTransfer?: () => void;
  canTransfer?: boolean;
  store: AppSettings;
  session: AppSession;
  onLogout: () => void;
  onAbout?: () => void;
  onOpenHelp?: () => void;
  onOpenPageHelp?: () => void;
  pageHelpEmphasize?: boolean;
  onOpenSearch?: () => void;
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
  userPicture?: string;
  onFabClick?: () => void;
  fabOpen?: boolean;
  children: ReactNode;
  mobileFooter?: ReactNode;
  alerts?: { id: string; title: string; detail?: string; tone?: 'warning' | 'danger' | 'info'; onClick?: () => void }[];
}) {
  const { mobileNavHidden } = useFormWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isXl, setIsXl] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({
    operations: true,
    definitions: true,
    reports: true,
    system: false,
  });
  const branchRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setIsXl(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Automatically expand whichever branch owns the active view
  useEffect(() => {
    const owner = branchContainingView(view);
    if (owner) {
      setOpenBranches((prev) => (prev[owner] ? prev : { ...prev, [owner]: true }));
    }
  }, [view]);

  const sidebarRail = isXl ? desktopCollapsed : !tabletExpanded;
  const toggleSidebar = () => {
    if (isXl) setDesktopCollapsed((v) => !v);
    else setTabletExpanded((v) => !v);
  };

  const sections = navSectionsForSession(session, { canTransfer });
  const crumb = breadcrumbForView(view);
  const roleLabel = session.kind === 'owner' ? 'مدیر سیستم' : session.groupName || 'کاربر';
  const userDisplayName = session.displayName || session.username;
  const userInitial = (userDisplayName || session.username || 'ک').trim().charAt(0) || 'ک';
  const storeName = store.name || 'حسابداری من';
  const canEditBrand = can(session, 'settings.business');

  const toggleBranch = (id: string) => {
    setOpenBranches((prev) => {
      const nextOpen = !prev[id];
      if (nextOpen) {
        window.setTimeout(() => {
          branchRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 120);
      }
      return { ...prev, [id]: nextOpen };
    });
  };

  const handleNavItemClick = (item: NavItem, mobile?: boolean) => {
    if (item.action === 'transfer' && onOpenTransfer) {
      onOpenTransfer();
    } else {
      onViewChange(item.id);
    }
    if (mobile) setMobileOpen(false);
    if (!isXl && tabletExpanded) setTabletExpanded(false);
  };

  const NavLinkButton = ({
    item,
    mobile,
    nested,
  }: {
    item: NavItem;
    mobile?: boolean;
    nested?: boolean;
  }) => {
    const Icon: FC<{ size?: number; strokeWidth?: number; className?: string }> = item.icon;
    const active = !item.action && view === item.id;

    return (
      <button
        type="button"
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        onClick={() => handleNavItemClick(item, mobile)}
        className={cn(
          'group relative flex w-full items-center gap-2 rounded-xl text-right transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b8dff]/45',
          nested ? 'px-2.5 py-[6.5px] text-[12.5px] leading-snug' : 'px-3 py-2 text-[13px] leading-snug',
          active
            ? 'sidebar-active-pill font-bold text-white ring-1 ring-white/20'
            : 'font-medium text-[#c8dcfb] hover:bg-white/[0.075] hover:text-white'
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg transition-colors',
            nested ? 'h-5 w-5' : 'h-6 w-6',
            active
              ? 'text-white'
              : 'text-[#7f9fd0] group-hover:text-sky-200'
          )}
        >
          <Icon size={nested ? 15 : 17} strokeWidth={active ? 2.25 : 1.85} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 whitespace-nowrap">{item.label}</span>
      </button>
    );
  };

  const SidebarChrome = ({ rail, mobile }: { rail?: boolean; mobile?: boolean }) => (
    <div className={cn('relative z-10 flex h-full min-h-0 flex-col', rail ? 'px-2 py-3.5' : 'px-3 py-3.5')}>
      {/* Unified Brand Lockup — clean Mercury-style single header */}
      <div className={cn('shrink-0 border-b border-white/[0.09] pb-2.5', rail ? 'mb-2.5 flex flex-col items-center' : 'mb-2')}>
        <button
          type="button"
          onClick={() => {
            onViewChange(canEditBrand ? 'settingsBusiness' : 'dashboard');
            if (mobile) setMobileOpen(false);
          }}
          title={storeName}
          className={cn(
            'group flex w-full items-center gap-2.5 rounded-2xl p-1.5 text-right transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b8dff]/40',
            rail && 'justify-center'
          )}
        >
          <StoreMark name={storeName} logo={store.logo} size={rail ? 'md' : 'sm'} />
          {!rail ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-black tracking-tight text-white">
                {storeName}
              </div>
              <div className="mt-0.5 text-[10.5px] font-medium text-[#8ba8d6]">
                سامانه حسابداری یکپارچه
              </div>
            </div>
          ) : null}
        </button>
      </div>

      {/* Structured Iranian Accounting Tree Navigation — compact rhythm so all 5 branches fit above the fold */}
      <div
        className={cn(
          'min-h-0 flex-1 overscroll-contain',
          rail
            ? 'sidebar-rail-scroll overflow-y-auto overflow-x-hidden'
            : 'sidebar-thin-scroll overflow-y-auto overflow-x-hidden pe-0.5'
        )}
      >
        {rail ? (
          <nav className="sidebar-rail-nav" aria-label="منوی اصلی">
            {sections.map((section, idx) => {
              if (section.kind === 'item') {
                const { item } = section;
                const Icon = item.icon;
                const active = view === item.id;
                return (
                  <RailIconButton
                    key={item.id}
                    label={item.label}
                    active={active}
                    onClick={() => handleNavItemClick(item, mobile)}
                  >
                    <Icon size={17} strokeWidth={active ? 2.25 : 1.9} />
                  </RailIconButton>
                );
              }
              return (
                <div key={section.branch.id} className="flex flex-col items-center gap-1">
                  {idx > 0 ? <div className="my-1 h-px w-7 bg-white/10" aria-hidden /> : null}
                  {section.branch.items.map((item) => {
                    const Icon = item.icon;
                    const active = !item.action && view === item.id;
                    return (
                      <RailIconButton
                        key={`${section.branch.id}-${item.id}-${item.action || 'view'}`}
                        label={item.label}
                        active={active}
                        onClick={() => handleNavItemClick(item, mobile)}
                      >
                        <Icon size={16} strokeWidth={active ? 2.25 : 1.85} />
                      </RailIconButton>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        ) : (
          <nav className="space-y-1 pb-2" aria-label="منوی حسابداری">
            {sections.map((section) => {
              if (section.kind === 'item') {
                return <NavLinkButton key={section.item.id} item={section.item} mobile={mobile} />;
              }

              const { branch } = section;
              const BranchIcon = branch.icon;
              const isOpen = openBranches[branch.id] ?? Boolean(branch.defaultOpen);
              const hasActiveChild = branch.items.some((item) => !item.action && item.id === view);

              return (
                <div
                  key={branch.id}
                  ref={(el) => {
                    branchRefs.current[branch.id] = el;
                  }}
                  className="pt-0.5"
                >
                  <button
                    type="button"
                    onClick={() => toggleBranch(branch.id)}
                    aria-expanded={isOpen}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-right transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b8dff]/40',
                      hasActiveChild
                        ? 'bg-white/[0.06] text-white'
                        : 'text-[#8eaad6] hover:bg-white/[0.05] hover:text-white'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <BranchIcon
                        size={14}
                        className={cn('shrink-0', hasActiveChild ? 'text-sky-300' : 'opacity-80')}
                        aria-hidden
                      />
                      <span className="whitespace-nowrap text-[11.5px] font-extrabold tracking-tight">
                        {branch.label}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!isOpen ? (
                        <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#9eb8e2]">
                          {toPersianDigits(String(branch.items.length))}
                        </span>
                      ) : null}
                      <ChevronDown
                        size={13}
                        className={cn(
                          'shrink-0 opacity-75 transition-transform duration-200',
                          isOpen ? 'rotate-0' : 'rotate-90'
                        )}
                        aria-hidden
                      />
                    </span>
                  </button>

                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="mr-3 mt-0.5 space-y-0.5 border-r border-white/[0.12] pr-2">
                        {branch.items.map((item) => (
                          <NavLinkButton
                            key={`${branch.id}-${item.id}-${item.action || 'view'}`}
                            item={item}
                            mobile={mobile}
                            nested
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      {/* Compact User Strip Footer */}
      <div className={cn('mt-2 shrink-0 border-t border-white/[0.09] pt-2.5', rail ? 'flex flex-col items-center gap-1.5' : '')}>
        {rail ? (
          <>
            {onOpenHelp ? (
              <RailIconButton
                label="راهنما"
                onClick={() => {
                  onOpenHelp();
                  if (mobile) setMobileOpen(false);
                }}
              >
                <CircleHelp size={17} />
              </RailIconButton>
            ) : null}
            <RailIconButton label="خروج از سیستم" onClick={onLogout} variant="danger">
              <LogOut size={16} />
            </RailIconButton>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-2.5 py-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                if (canAccessView(session, 'profile')) {
                  onViewChange('profile');
                  if (mobile) setMobileOpen(false);
                }
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-right transition hover:opacity-90"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-sky-500/20 text-xs font-black text-white">
                {userPicture ? (
                  <img src={userPicture} alt="" className="h-full w-full object-cover" />
                ) : (
                  userInitial
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-white">{userDisplayName}</span>
                <span className="block truncate text-[10px] text-[#8ea9d4]">{roleLabel}</span>
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-0.5">
              {onOpenHelp ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenHelp();
                    if (mobile) setMobileOpen(false);
                  }}
                  aria-label="راهنما"
                  title="راهنمای جامع"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9cb4da] transition hover:bg-white/10 hover:text-white"
                >
                  <CircleHelp size={15} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onLogout}
                aria-label="خروج از سیستم"
                title="خروج از سیستم"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const NotificationPopover = ({ alignClass }: { alignClass: string }) =>
    notifOpen ? (
      <>
        <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
        <div
          className={cn(
            'absolute top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-elevated)] p-3 text-xs shadow-[var(--shadow-md)] backdrop-blur-xl animate-scale-in',
            alignClass
          )}
          role="status"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="font-extrabold text-[color:var(--ink)]">اعلان‌های مالی</span>
            <button
              type="button"
              onClick={() => setNotifOpen(false)}
              className="rounded-lg px-2 py-0.5 text-[11px] font-bold text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)]"
            >
              بستن
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="rounded-xl bg-[color:var(--surface-2)]/70 px-3 py-4 text-center text-[color:var(--muted)]">
              همه چیز مرتب است — اعلان جدیدی ندارید
            </div>
          ) : (
            <div className="space-y-1.5">
              {alerts.map((al) => (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    al.onClick?.();
                  }}
                  className="flex w-full flex-col rounded-xl bg-[color:var(--surface-2)]/75 px-3 py-2.5 text-right transition hover:bg-[color:var(--brand-soft)]/70"
                >
                  <span className="font-bold text-[color:var(--ink)]">{al.title}</span>
                  {al.detail ? (
                    <span className="mt-0.5 text-[11px] text-[color:var(--muted)]">{al.detail}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    ) : null;

  return (
    <div className="ambient-bg min-h-screen text-[color:var(--ink)]">
      <div className="mx-auto flex min-h-screen max-w-[96rem]">
        {/* Desktop & Tablet Deep Navy Sidebar */}
        <aside
          id="app-sidebar"
          className={cn(
            'sidebar-shell app-sidebar relative z-30 hidden shrink-0 overflow-hidden md:flex md:flex-col',
            'border-l border-white/10 shadow-[-14px_0_44px_-24px_rgba(6,20,52,0.6)]',
            'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            sidebarRail ? 'w-[4.75rem]' : 'w-[17.75rem]'
          )}
        >
          {/* Ambient Luminous Cyan Ribbon */}
          <svg
            aria-hidden
            viewBox="0 0 260 220"
            className="pointer-events-none absolute inset-x-0 bottom-10 h-52 w-full opacity-40"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="sbRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0" />
                <stop offset="50%" stopColor="#00d4e8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#2680ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M-20 155 C 55 110, 145 190, 280 95"
              stroke="url(#sbRibbon)"
              strokeWidth="2.2"
              fill="none"
            />
            <path
              d="M-20 180 C 70 135, 165 205, 280 125"
              stroke="url(#sbRibbon)"
              strokeWidth="1.3"
              fill="none"
              opacity="0.65"
            />
          </svg>
          <SidebarChrome rail={sidebarRail} />
        </aside>

        {/* Main Workspace Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop & Tablet Frosted Top Header Bar */}
          <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-4 border-b border-[color:var(--glass-border)] bg-[color:var(--surface-1)]/78 px-6 backdrop-blur-xl md:flex">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={sidebarRail ? 'باز کردن منو' : 'جمع کردن منو'}
                title={sidebarRail ? 'باز کردن منو' : 'جمع کردن منو'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 text-[color:var(--muted)] transition hover:border-[color:var(--brand)]/35 hover:text-[color:var(--brand)]"
              >
                {sidebarRail ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
              </button>
              <nav aria-label="مسیر صفحه" className="flex items-center gap-2 whitespace-nowrap text-xs">
                <span className="font-medium text-[color:var(--muted)]">{crumb.parent}</span>
                <span className="text-[color:var(--muted)]/50" aria-hidden>
                  /
                </span>
                <span className="font-extrabold text-[color:var(--ink)]">{crumb.current}</span>
              </nav>
            </div>

            <div className="flex items-center gap-2.5">
              {onOpenSearch ? (
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="flex h-10 w-56 items-center justify-between gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 px-3.5 text-xs text-[color:var(--muted)] shadow-xs transition hover:border-[color:var(--brand)]/35 hover:text-[color:var(--ink)] lg:w-72"
                >
                  <span className="truncate">{crumb.searchPlaceholder}</span>
                  <Search size={15} className="shrink-0 opacity-75" />
                </button>
              ) : null}

              {theme && setTheme ? (
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت شب'}
                  title={theme === 'dark' ? 'حالت روشن' : 'حالت شب'}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 text-[color:var(--muted)] shadow-xs transition hover:border-[color:var(--brand)]/35 hover:text-[color:var(--brand)]"
                >
                  {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </button>
              ) : null}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label={alerts.length ? `اعلان‌ها (${alerts.length})` : 'اعلان‌ها'}
                  aria-expanded={notifOpen}
                  className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/80 text-[color:var(--muted)] shadow-xs transition hover:border-[color:var(--brand)]/35 hover:text-[color:var(--ink)]"
                >
                  <Bell size={17} />
                  {alerts.length > 0 ? (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[color:var(--expense)] ring-2 ring-[color:var(--surface-solid)]" />
                  ) : null}
                </button>
                <NotificationPopover alignClass="left-0" />
              </div>

              <span className="h-6 w-px bg-[color:var(--line)]" aria-hidden />

              <button
                type="button"
                onClick={() => canAccessView(session, 'profile') && onViewChange('profile')}
                aria-label="پروفایل کاربری"
                title={userDisplayName}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[color:var(--brand-soft)] text-xs font-black text-[color:var(--brand)] shadow-sm transition hover:scale-[1.03] dark:border-slate-700"
              >
                {userPicture ? (
                  <img src={userPicture} alt="" className="h-full w-full object-cover" />
                ) : (
                  userInitial
                )}
              </button>
            </div>
          </header>

          {/* Mobile Compact Frosted Top Header */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-[color:var(--glass-border)] bg-[color:var(--surface-1)]/85 px-3.5 backdrop-blur-xl md:hidden">
            <button
              type="button"
              onClick={() => onViewChange('dashboard')}
              className="flex min-w-0 flex-1 items-center gap-2 text-right"
            >
              <StoreMark name={storeName} logo={store.logo} size="sm" />
              <span className="truncate text-[13.5px] font-black tracking-tight text-[color:var(--ink)] sm:text-[15px]">
                {storeName}
              </span>
            </button>

            <div className="relative flex shrink-0 items-center gap-1">
              {onOpenSearch ? (
                <IconButton icon={Search} label="جستجو" size="sm" onClick={onOpenSearch} />
              ) : null}

              {theme && setTheme ? (
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت شب'}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:var(--surface-solid)]/80 text-[color:var(--muted)] shadow-xs"
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="اعلان‌ها"
                className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[color:var(--surface-solid)]/80 text-[color:var(--muted)] shadow-xs"
              >
                <Bell size={15} />
                {alerts.length > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[color:var(--expense)] ring-2 ring-[color:var(--surface-solid)]" />
                ) : null}
              </button>

              <IconButton icon={Menu} label="منو" size="sm" onClick={() => setMobileOpen(true)} />
              <NotificationPopover alignClass="left-0" />
            </div>
          </header>

          {/* Mobile Drawer with Full Accounting Tree */}
          {mobileOpen ? (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px]"
                onClick={() => setMobileOpen(false)}
              />
              <div className="app-sidebar absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col overflow-hidden border-s border-white/10 shadow-2xl animate-[slide-in-side_0.26s_cubic-bezier(0.22,1,0.36,1)]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="text-sm font-extrabold text-white">منوی حسابداری</div>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="بستن منو"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SidebarChrome mobile />
                </div>
              </div>
            </div>
          ) : null}

          {/* Main Content */}
          <main
            className={cn(
              'relative flex-1 px-3.5 py-3.5 md:px-6 md:py-6 md:pb-8',
              mobileNavHidden ? 'pb-32' : 'pb-24'
            )}
          >
            <div className="mx-auto w-full max-w-[78rem]">{children}</div>
          </main>

          {!mobileNavHidden ? mobileFooter : null}
        </div>
      </div>
    </div>
  );
}
