import * as Dialog from '@radix-ui/react-dialog';
import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

export type FormSheetSize = 'sm' | 'md' | 'lg' | 'xl';
export type FormSheetLayer = 'base' | 'nested';

const SIZE_CLASS: Record<FormSheetSize, string> = {
  sm: 'md:max-w-[26rem]',
  md: 'md:max-w-[32rem]',
  lg: 'md:max-w-[40rem] lg:max-w-[42rem]',
  xl: 'md:max-w-[50rem] lg:max-w-[54rem]',
};

const LAYER_Z: Record<FormSheetLayer, string> = {
  base: 'z-50',
  nested: 'z-[85]',
};

/**
 * Unified Modern FormSheet (Modal / Mobile Sheet):
 * - Frosted ocean-glass framing matching the app's dashboard & sidebar palette
 * - Smooth spring entrance animation (`animate-modal-pop` on desktop, `animate-sheet-up` on mobile)
 * - Crisp top accent hairline, uniform header/body/footer padding, and strict visual hierarchy
 */
export function FormSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  headerChip,
  children,
  footer,
  size = 'md',
  bodyClassName,
  layer = 'base',
  accent = 'brand',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: FormSheetSize;
  bodyClassName?: string;
  layer?: FormSheetLayer;
  accent?: 'income' | 'expense' | 'brand';
  dock?: boolean;
  subtitle?: ReactNode;
  headerChip?: ReactNode;
}) {
  const titleId = useId();

  const topStripe =
    accent === 'income'
      ? 'from-emerald-400 via-emerald-500 to-teal-500'
      : accent === 'expense'
        ? 'from-rose-400 via-rose-500 to-orange-500'
        : 'from-sky-400 via-[#0d63f5] to-cyan-500';

  const chipBg =
    accent === 'income'
      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25'
      : accent === 'expense'
        ? 'bg-gradient-to-br from-rose-500 to-orange-500 shadow-rose-500/25'
        : 'hero-gradient shadow-[#0d63f5]/25';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 bg-[#061226]/52 backdrop-blur-[7px] animate-modal-backdrop',
            LAYER_Z[layer]
          )}
        />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={undefined}
          className={cn(
            'form-sheet-dialog fixed inset-x-0 bottom-0 flex w-full flex-col overflow-hidden outline-none',
            'max-h-[90dvh] rounded-t-[1.75rem] border border-[color:var(--glass-border)] border-b-0',
            'bg-[color:var(--surface-elevated)] shadow-[0_-16px_52px_-12px_rgba(6,22,56,0.36)] backdrop-blur-2xl',
            'pb-[max(0.45rem,env(safe-area-inset-bottom))]',
            'md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-h-[min(86dvh,780px)] md:w-[calc(100vw-2.5rem)]',
            'md:rounded-[1.6rem] md:border md:pb-0 md:shadow-[0_32px_90px_-20px_rgba(6,24,66,0.46)]',
            SIZE_CLASS[size],
            LAYER_Z[layer]
          )}
          onPointerDownOutside={() => onClose()}
        >
          {/* Crisp top semantic hairline */}
          <div className={cn('h-[3px] w-full shrink-0 bg-gradient-to-l', topStripe)} aria-hidden />

          {/* Mobile grab handle */}
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[color:var(--muted)]/30 md:hidden" aria-hidden />

          <header className="flex shrink-0 items-center justify-between gap-2.5 border-b border-[color:var(--line)] bg-[color:var(--surface-solid)]/65 px-4 py-2.5 md:gap-3 md:px-6 md:py-4">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 md:gap-3">
              {headerChip != null ? (
                <div className="shrink-0">{headerChip}</div>
              ) : (
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-md md:h-10 md:w-10 md:rounded-2xl',
                    chipBg
                  )}
                  aria-hidden
                >
                  ح
                </span>
              )}
              <div className="min-w-0 flex-1">
                <Dialog.Title
                  id={titleId}
                  className="truncate text-[15px] font-black tracking-tight text-[color:var(--ink)] md:text-[17px]"
                >
                  {title}
                </Dialog.Title>
                {subtitle != null ? (
                  <p className="mt-0.5 hidden truncate text-xs font-medium text-[color:var(--muted)] sm:block">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-transparent text-[color:var(--muted)] transition hover:border-[color:var(--line)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)] active:scale-95"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </header>

          <div
            className={cn(
              'nice-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5 md:px-6 md:py-5',
              bodyClassName
            )}
          >
            {children}
          </div>

          {footer != null ? (
            <footer className="shrink-0 border-t border-[color:var(--line)] bg-[color:var(--surface-solid)]/88 px-4 py-3 backdrop-blur-md md:px-6 md:py-4">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
