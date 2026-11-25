import React from 'react';
import { createPortal } from 'react-dom';
import { Check, type LucideIcon } from 'lucide-react';
import { Button, type ButtonVariant } from './button';
import { cn } from './cn';

interface MobileStickyBarProps {
  submitLabel: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  submitIcon?: LucideIcon;
  submitVariant?: ButtonVariant;
  cancelLabel?: string;
  onCancel: () => void;
  summaryLabel?: string;
  summaryValue?: string;
  summaryTone?: 'brand' | 'income' | 'expense';
  submitTestId?: string;
}

/**
 * Mobile Sticky Action Bar (md:hidden):
 * - Replaces BottomNav while an MDI document form is active on mobile
 * - Portaled to document.body so CSS transforms on page wrappers never break position:fixed
 * - Respects the <= 15% aggregate sticky height budget & safe-area-inset-bottom
 */
export const MobileStickyBar: React.FC<MobileStickyBarProps> = ({
  submitLabel,
  onSubmit,
  submitDisabled,
  submitIcon,
  submitVariant = 'primary',
  cancelLabel = 'بستن',
  onCancel,
  summaryLabel,
  summaryValue,
  summaryTone = 'brand',
  submitTestId,
}) => {
  const Icon = submitIcon ?? Check;
  const toneCls =
    summaryTone === 'income'
      ? 'text-[color:var(--income)]'
      : summaryTone === 'expense'
        ? 'text-[color:var(--expense)]'
        : 'text-[color:var(--brand)]';

  const bar = (
    <div
      data-testid="mobile-sticky-bar"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 md:hidden',
        'border-t border-[color:var(--glass-border)] bg-[color:var(--surface-elevated)]/96',
        'px-3.5 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]',
        'shadow-[0_-10px_28px_-10px_rgba(8,28,74,0.22)] backdrop-blur-xl'
      )}
    >
      {summaryLabel && summaryValue ? (
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5 text-xs">
          <span className="font-bold text-[color:var(--muted)]">{summaryLabel}</span>
          <span className={cn('font-black tabular-nums', toneCls)}>{summaryValue}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-[2fr_1fr] gap-2.5">
        <Button
          size="lg"
          variant={submitVariant}
          icon={Icon}
          disabled={submitDisabled}
          onClick={onSubmit}
          data-testid={submitTestId}
          className="min-h-[2.75rem] w-full"
        >
          {submitLabel}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={onCancel}
          className="min-h-[2.75rem] w-full"
        >
          {cancelLabel}
        </Button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return bar;
  return createPortal(bar, document.body);
};

export default MobileStickyBar;
