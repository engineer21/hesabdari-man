import {
  Check,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Share,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { Permission } from '../../types';
import {
  pageSizeLabel,
  readStoredPdfPageSize,
  type PdfPageSize,
} from '../../utils/export';
import { useCanOptional } from '../../hooks/useSessionAuth';
import { cn } from '../ui';

type ExportActionsProps = {
  onExcel?: () => void | Promise<void>;
  onPdf?: (pageSize: PdfPageSize) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  permission?: Permission;
  defaultPageSize?: PdfPageSize;
  /** Compact trigger for tight headers */
  label?: string;
};

/**
 * Modern compact export menu — Excel + PDF A4/A5 in one control.
 * Remembers last PDF size; shows progress and inline errors.
 */
export function ExportActions({
  onExcel,
  onPdf,
  disabled,
  className,
  permission,
  defaultPageSize = 'a4',
  label = 'خروجی',
}: ExportActionsProps) {
  const can = useCanOptional();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState<PdfPageSize>(() =>
    readStoredPdfPageSize(defaultPageSize)
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (permission && can && !can(permission)) return null;
  if (!onExcel && !onPdf) return null;

  const run = async (kind: 'excel' | 'pdf', size?: PdfPageSize) => {
    if (disabled || busy) return;
    setError('');
    setBusy(kind);
    try {
      if (kind === 'excel') {
        await onExcel?.();
      } else if (size) {
        setPageSize(size);
        await onPdf?.(size);
      }
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خروجی ناموفق بود.');
    } finally {
      setBusy(null);
    }
  };

  const locked = Boolean(disabled || busy);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={locked}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-xl border border-[color:var(--line)]',
          'bg-[color:var(--surface-1)] px-3 text-xs font-bold text-[color:var(--ink)]',
          'shadow-[var(--shadow-sm)] transition',
          'hover:border-[color:var(--brand)]/25 hover:bg-[color:var(--brand-soft)]/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]/30',
          'disabled:pointer-events-none disabled:opacity-50',
          open && 'border-[color:var(--brand)]/30 bg-[color:var(--brand-soft)]/50'
        )}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin text-[color:var(--brand)]" />
        ) : (
          <Share size={14} className="text-[color:var(--brand)]" strokeWidth={2} />
        )}
        <span>{busy === 'pdf' ? 'ساخت PDF…' : busy === 'excel' ? 'اکسل…' : label}</span>
        <ChevronDown
          size={14}
          className={cn('text-[color:var(--muted)] transition', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute end-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden',
            'rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)]',
            'shadow-[0_18px_40px_-12px_rgba(15,23,42,0.22)]',
            'animate-in fade-in-0 zoom-in-95 origin-top-left'
          )}
        >
          <div className="border-b border-[color:var(--line)] px-3.5 py-2.5">
            <p className="text-[11px] font-bold text-[color:var(--muted)]">دانلود گزارش</p>
          </div>

          <div className="p-1.5">
            {onExcel ? (
              <button
                type="button"
                role="menuitem"
                disabled={locked}
                onClick={() => void run('excel')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition hover:bg-[color:var(--surface-2)] disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <FileSpreadsheet size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[color:var(--ink)]">اکسل</span>
                  <span className="block text-[10px] text-[color:var(--muted)]">جدول قابل‌ویرایش (.xlsx)</span>
                </span>
              </button>
            ) : null}

            {onPdf ? (
              <div className="mt-1 space-y-1 border-t border-[color:var(--line)] pt-1">
                <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold text-[color:var(--muted)]">
                  PDF — اندازه کاغذ
                </p>
                {(['a4', 'a5'] as const).map((size) => {
                  const active = pageSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      role="menuitem"
                      disabled={locked}
                      onClick={() => void run('pdf', size)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition disabled:opacity-50',
                        active
                          ? 'bg-[color:var(--brand-soft)]/70 ring-1 ring-[color:var(--brand)]/20'
                          : 'hover:bg-[color:var(--surface-2)]'
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                        <FileText size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-[color:var(--ink)]">
                          PDF {pageSizeLabel(size)}
                          {active ? (
                            <Check size={13} className="text-[color:var(--brand)]" strokeWidth={2.5} />
                          ) : null}
                        </span>
                        <span className="block text-[10px] text-[color:var(--muted)]">
                          {size === 'a4' ? '۲۱۰×۲۹۷ میلی‌متر — استاندارد' : '۱۴۸×۲۱۰ — فشرده و کم‌حجم'}
                        </span>
                      </span>
                      <PaperThumb size={size} />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="border-t border-rose-200/60 bg-rose-50/80 px-3.5 py-2 text-[11px] font-medium text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PaperThumb({ size }: { size: PdfPageSize }) {
  const isA5 = size === 'a5';
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 rounded-[3px] border border-slate-300/80 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800',
        isA5 ? 'h-7 w-5' : 'h-8 w-[1.35rem]'
      )}
    />
  );
}
