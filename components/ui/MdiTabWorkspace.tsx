import React, { type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface MdiTabDescriptor {
  id: string;
  title: string;
  icon?: LucideIcon;
  accent?: 'brand' | 'income' | 'expense' | 'neutral';
  pinned?: boolean;
  dirty?: boolean;
  badge?: string | number;
}

interface MdiTabWorkspaceProps {
  tabs: MdiTabDescriptor[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab?: (id: string) => void;
  /** Quick action buttons aligned on the opposite end of the MDI tab strip */
  stripActions?: ReactNode;
  /** Render function called for each tab so open tabs preserve their state when switching */
  renderTab: (tab: MdiTabDescriptor, isActive: boolean) => ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Contextual In-Module MDI (Multi-Document Interface) Tabbed Workspace.
 * - Keeps the module's primary List tab pinned & non-closable
 * - Opens dense document forms (Invoices, Income/Expense vouchers, Details) as parallel tabs right inside the module
 * - Preserves full form state across tab switches (mounted panels toggled cleanly with compositor animation)
 */
export function MdiTabWorkspace({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  stripActions,
  renderTab,
  className,
  testId,
}: MdiTabWorkspaceProps) {
  const accentDot = (accent?: MdiTabDescriptor['accent']) => {
    if (accent === 'income') return 'bg-[color:var(--income)]';
    if (accent === 'expense') return 'bg-[color:var(--expense)]';
    if (accent === 'brand') return 'bg-[color:var(--brand)]';
    return 'bg-[color:var(--muted)]';
  };

  return (
    <div className={cn('space-y-3 sm:space-y-4', className)} data-testid={testId}>
      {/* Sleek Frosted MDI Tab Strip — single-row swipeable on mobile, clean inline actions */}
      <div
        className="flex flex-nowrap items-center justify-between gap-1.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)]/84 p-1 sm:gap-2 sm:p-1.5 shadow-[var(--shadow-sm)] backdrop-blur-xl"
        role="tablist"
        aria-label="تب‌های باز در این بخش"
      >
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-1.5">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const Icon = tab.icon;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                data-testid={`mdi-tab-${tab.id}`}
                className={cn(
                  'group relative flex h-9 sm:h-10 shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3.5 text-[11.5px] sm:text-xs font-extrabold transition-all duration-150 animate-tab-chip',
                  isActive
                    ? 'bg-[color:var(--surface-elevated)] text-[color:var(--ink)] shadow-[0_6px_18px_-8px_rgba(12,48,128,0.28)] ring-1 ring-[color:var(--brand)]/35 dark:bg-slate-800/95'
                    : 'text-[color:var(--muted)] hover:bg-[color:var(--surface-2)]/70 hover:text-[color:var(--ink)]'
                )}
              >
                {/* Subtle bottom active bar */}
                {isActive ? (
                  <span
                    className={cn(
                      'pointer-events-none absolute inset-x-2.5 sm:inset-x-3 bottom-0 h-[2.5px] rounded-full',
                      accentDot(tab.accent || 'brand')
                    )}
                    aria-hidden
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className="flex min-w-0 items-center gap-1.5 sm:gap-2 outline-none"
                >
                  {Icon ? (
                    <Icon
                      size={13}
                      className={cn(
                        'shrink-0 sm:w-[14px] sm:h-[14px]',
                        isActive
                          ? tab.accent === 'income'
                            ? 'text-[color:var(--income)]'
                            : tab.accent === 'expense'
                              ? 'text-[color:var(--expense)]'
                              : 'text-[color:var(--brand)]'
                          : 'text-[color:var(--muted)]'
                      )}
                      aria-hidden
                    />
                  ) : (
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', accentDot(tab.accent))} aria-hidden />
                  )}

                  <span className="max-w-[8.75rem] truncate sm:max-w-[12.5rem]">{tab.title}</span>

                  {tab.dirty ? (
                    <span
                      title="تغییرات ذخیره‌نشده"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                      aria-label="تغییرات ذخیره‌نشده"
                    />
                  ) : null}

                  {tab.badge != null ? (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums',
                        isActive
                          ? 'bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
                          : 'bg-[color:var(--surface-2)] text-[color:var(--muted)]'
                      )}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>

                {!tab.pinned && onCloseTab ? (
                  <button
                    type="button"
                    aria-label={`بستن تب ${tab.title}`}
                    data-testid={`mdi-close-${tab.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className="ms-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition hover:bg-rose-500/15 hover:text-[color:var(--expense)]"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {stripActions ? (
          <div className="flex shrink-0 items-center gap-1 border-s border-[color:var(--line)] ps-1.5 sm:gap-1.5 sm:ps-2">
            {stripActions}
          </div>
        ) : null}
      </div>

      {/* Mounted MDI Tab Panels — preserves form state across switches */}
      <div>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              role="tabpanel"
              hidden={!isActive}
              aria-hidden={!isActive}
              className={cn(isActive ? 'block animate-mdi-panel' : 'hidden')}
            >
              {renderTab(tab, isActive)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
