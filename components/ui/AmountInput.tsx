import type { InputHTMLAttributes } from 'react';
import { formatNumberWithCommas, persianToArabic, toPersianDigits } from '../../utils/formatters';
import { cn } from './cn';
import { fieldAmount, fieldLabel } from './tokens';

const DEFAULT_CHIPS = [100_000, 500_000, 1_000_000, 5_000_000];

export type AmountTone = 'income' | 'expense' | 'brand' | 'info';

export function AmountInput({
  value,
  onChange,
  tone,
  accent,
  label = 'مبلغ (تومان)',
  autoFocus,
  chips = DEFAULT_CHIPS,
  compact = false,
  className,
  ...rest
}: {
  value: string;
  onChange: (latinDigits: string) => void;
  tone?: AmountTone;
  accent?: AmountTone;
  label?: string;
  autoFocus?: boolean;
  chips?: number[];
  compact?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const resolved: AmountTone = accent ?? tone ?? 'brand';

  const toneSurface =
    resolved === 'income'
      ? 'border-emerald-500/20 bg-emerald-500/[0.06] dark:bg-emerald-500/[0.09]'
      : resolved === 'expense'
        ? 'border-rose-500/20 bg-rose-500/[0.06] dark:bg-rose-500/[0.09]'
        : resolved === 'info'
          ? 'border-cyan-500/20 bg-cyan-500/[0.06] dark:bg-cyan-500/[0.09]'
          : 'border-[color:var(--brand)]/20 bg-[color:var(--brand)]/[0.055] dark:bg-[color:var(--brand)]/[0.1]';

  const toneText =
    resolved === 'income'
      ? 'text-[color:var(--income)]'
      : resolved === 'expense'
        ? 'text-[color:var(--expense)]'
        : resolved === 'info'
          ? 'text-[color:var(--info)]'
          : 'text-[color:var(--brand)]';

  const display = value
    ? toPersianDigits(formatNumberWithCommas(persianToArabic(value)))
    : '';

  return (
    <div
      className={cn(
        'rounded-2xl border transition-colors',
        compact ? 'p-3' : 'p-3.5 sm:p-4',
        toneSurface,
        className
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={rest.id} className={cn(fieldLabel, 'mb-0', toneText)}>
          {label}
        </label>
        <span className="text-[11px] font-bold text-[color:var(--muted)]">تومان</span>
      </div>
      <input
        {...rest}
        className={cn(
          fieldAmount,
          'border-[color:var(--glass-border)] bg-[color:var(--surface-solid)] shadow-xs',
          compact && 'min-h-[2.85rem] py-2 text-xl',
          toneText
        )}
        inputMode="numeric"
        autoFocus={autoFocus}
        value={display}
        onChange={(e) => onChange(persianToArabic(e.target.value).replace(/[^\d]/g, ''))}
        placeholder={rest.placeholder ?? '۰'}
        aria-label={label}
      />
      {chips.length > 0 ? (
        <div
          className={cn(
            'no-scrollbar mt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5',
            !compact && 'lg:flex-wrap lg:overflow-visible lg:pb-0',
            toneText
          )}
          role="group"
          aria-label="مبالغ پیشنهادی"
        >
          {chips.map((amount) => (
            <button
              key={amount}
              type="button"
              className="amount-chip"
              onClick={() => onChange(String(amount))}
            >
              {toPersianDigits(formatNumberWithCommas(amount))}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
