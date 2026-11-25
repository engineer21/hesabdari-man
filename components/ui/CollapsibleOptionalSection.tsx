import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';
import { formatOptionalCountLabel } from '../../utils/formLayout';
import { cn } from './cn';

interface CollapsibleOptionalSectionProps {
  title?: string;
  subtitle?: string;
  filledCount?: number;
  defaultOpenMobile?: boolean;
  /** When true (default), section is always open on tablet/desktop (md+) and collapsible only on mobile (<768px) */
  mobileOnly?: boolean;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Collapsible Optional Fields Section:
 * - On mobile (<768px): keeps forms focused on essential inputs by collapsing secondary fields
 * - Shows a clear count of filled optional fields so users never lose track of entered data
 * - On tablet & desktop (md+): stays expanded automatically when mobileOnly=true
 */
export const CollapsibleOptionalSection: React.FC<CollapsibleOptionalSectionProps> = ({
  title = 'اطلاعات تکمیلی و اختیاری',
  subtitle,
  filledCount = 0,
  defaultOpenMobile = false,
  mobileOnly = true,
  children,
  className,
  testId,
}) => {
  const [open, setOpen] = useState(defaultOpenMobile);
  const badgeText = formatOptionalCountLabel(filledCount, toPersianDigits);

  return (
    <div
      data-testid={testId}
      className={cn(
        mobileOnly
          ? 'rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/55 md:rounded-none md:border-0 md:bg-transparent'
          : 'rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)]/55',
        className
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-[2.75rem] w-full items-center justify-between gap-2.5 px-3.5 py-2.5 text-right transition hover:bg-[color:var(--surface-2)]/50',
          mobileOnly && 'md:hidden'
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-[color:var(--ink)]">{title}</span>
            {badgeText ? (
              <span className="rounded-md bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--brand)] tabular-nums">
                {badgeText}
              </span>
            ) : null}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[11px] font-medium text-[color:var(--muted)]">
              {subtitle}
            </span>
          ) : null}
        </span>

        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-[color:var(--muted)] transition-transform duration-200',
            open ? 'rotate-180' : 'rotate-0'
          )}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          mobileOnly && 'md:grid-rows-[1fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className={cn(mobileOnly ? 'px-3.5 pb-3.5 pt-1 md:p-0' : 'px-3.5 pb-3.5 pt-1')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollapsibleOptionalSection;
