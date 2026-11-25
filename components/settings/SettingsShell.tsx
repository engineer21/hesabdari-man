import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../ui';

export function SettingsPageShell({
  title,
  subtitle,
  eyebrow = 'مدیریت و تنظیمات',
  icon: Icon,
  actions,
  children,
  footer,
  wide = true,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto animate-page-enter space-y-5 pb-24 md:pb-8',
        wide ? 'max-w-5xl' : 'max-w-3xl'
      )}
    >
      <div className="dash-card relative overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-[color:var(--brand)]/12 blur-2xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            {Icon ? (
              <div className="btn-brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md ring-4 ring-[color:var(--brand-soft)]">
                <Icon size={22} strokeWidth={1.85} />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold tracking-wide text-[color:var(--brand)]">
                {eyebrow}
              </p>
              <h1 className="mt-0.5 text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
                {title}
              </h1>
              <p className="mt-1 max-w-2xl text-xs font-medium leading-6 text-[color:var(--muted)] sm:text-sm">
                {subtitle}
              </p>
            </div>
          </div>
          {actions ? (
            <div className="relative flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>

      {children}

      {footer ? (
        <div className="sticky bottom-3 z-10 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-elevated)]/95 p-3.5 shadow-[var(--shadow-md)] backdrop-blur-xl">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsPanel({
  title,
  description,
  icon: Icon,
  badge,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('dash-card p-5 sm:p-6', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl tone-brand">
              <Icon size={17} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-[color:var(--ink)]">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--muted)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {children}
    </section>
  );
}
