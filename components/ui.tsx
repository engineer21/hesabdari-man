import type { ReactNode, HTMLAttributes } from 'react';
import { toPersianDigits } from '../utils/formatters';

export { FormSheet } from './ui/form-sheet';
export { Field } from './ui/field';
export { Button, IconButton, FormActions } from './ui/button';
export { fieldLabel, fieldInput, fieldPicker } from './ui/tokens';
export { AmountInput } from './ui/AmountInput';
export { MdiTabWorkspace, type MdiTabDescriptor } from './ui/MdiTabWorkspace';
export { MobileStickyBar } from './ui/MobileStickyBar';
export { CollapsibleOptionalSection } from './ui/CollapsibleOptionalSection';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function formatCount(n: number): string {
  return toPersianDigits(n.toLocaleString('en-US'));
}

export function Surface({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('surface-card rounded-2xl', className)} {...rest}>
      {children}
    </div>
  );
}

export function WorkspaceHeader({
  title,
  subtitle,
  count,
  icon,
  actions,
  primaryAction,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  /** Optional title chip — rendered next to the h1 on mobile only (طرح موبایل) */
  icon?: ReactNode;
  actions?: ReactNode;
  primaryAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0 sm:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {icon ? <span className="shrink-0 md:hidden">{icon}</span> : null}
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
          {typeof count === 'number' ? (
            <span className="rounded-full bg-[color:var(--brand-soft)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[color:var(--brand)]">
              {formatCount(count)}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {(actions || primaryAction) ? (
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          {actions}
          {primaryAction}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="dash-card rounded-[1.5rem] border border-dashed border-[color:var(--line-strong)] px-6 py-12 text-center">
      <div className="text-base font-extrabold text-[color:var(--ink)]">{title}</div>
      {description ? (
        <div className="mt-2 text-sm text-[color:var(--muted)]">{description}</div>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function StoreMark({
  name,
  logo,
  size = 'md',
}: {
  name: string;
  logo?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box =
    size === 'sm' ? 'h-9 w-9 text-sm' : size === 'lg' ? 'h-20 w-20 text-xl' : 'h-11 w-11 text-base';
  const initial = (name || 'ح').trim().charAt(0) || 'ح';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-bold text-white',
        'hero-gradient',
        box
      )}
    >
      {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : initial}
    </div>
  );
}
