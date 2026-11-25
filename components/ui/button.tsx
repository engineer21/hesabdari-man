import type { LucideIcon } from 'lucide-react';
import { Check, type LucideIcon as LucideIconType } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'soft-danger'
  | 'income'
  | 'expense'
  | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIconType;
  iconRight?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'btn-brand-gradient focus-visible:ring-[color:var(--brand)]/40',
  secondary:
    'border border-[color:var(--line)] bg-[color:var(--surface-solid)]/90 text-[color:var(--ink)] hover:bg-[color:var(--surface-2)] focus-visible:ring-slate-400/25',
  ghost:
    'bg-transparent text-[color:var(--muted)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)] focus-visible:ring-slate-400/20',
  danger:
    'bg-[color:var(--expense)] text-white shadow-sm hover:opacity-92 focus-visible:ring-rose-500/35',
  'soft-danger':
    'bg-[color:var(--expense-soft)] text-[color:var(--expense)] hover:opacity-90 focus-visible:ring-rose-500/25',
  income:
    'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_8px_20px_-8px_rgba(8,181,98,0.55)] hover:opacity-95 focus-visible:ring-emerald-500/35',
  expense:
    'bg-gradient-to-r from-[#f25842] to-[#e14536] text-white shadow-[0_8px_20px_-8px_rgba(242,88,66,0.55)] hover:opacity-95 focus-visible:ring-rose-500/35',
  soft:
    'bg-[color:var(--brand-soft)] text-[color:var(--brand)] hover:opacity-90 focus-visible:ring-[color:var(--brand)]/25',
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap',
  md: 'h-10 gap-2 rounded-2xl px-4 text-sm font-bold whitespace-nowrap',
  lg: 'h-11 gap-2 rounded-2xl px-5 text-sm font-extrabold whitespace-nowrap',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 17 };

export function Button({
  children,
  onClick,
  type = 'button',
  disabled,
  className,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight,
  form,
  autoFocus,
  ...rest
}: ButtonProps) {
  const iconEl = Icon ? (
    <Icon size={ICON_SIZE[size]} strokeWidth={2.2} className="shrink-0 opacity-95" />
  ) : null;
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      autoFocus={autoFocus}
      {...rest}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className
      )}
    >
      {!iconRight ? iconEl : null}
      {children}
      {iconRight ? iconEl : null}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
  variant = 'ghost',
  size = 'md',
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
        BTN_VARIANT[variant],
        box,
        className
      )}
    >
      <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} />
    </button>
  );
}

export function FormActions({
  onCancel,
  onSubmit,
  submitLabel,
  cancelLabel = 'انصراف',
  submitType = 'button',
  formId,
  submitDisabled,
  submitIcon: SubmitIcon,
  submitVariant = 'primary',
}: {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel: ReactNode;
  cancelLabel?: ReactNode;
  submitType?: 'button' | 'submit';
  formId?: string;
  submitDisabled?: boolean;
  submitIcon?: LucideIconType;
  submitVariant?: ButtonVariant;
}) {
  const SubmitIconResolved = SubmitIcon ?? Check;
  return (
    <div className="grid grid-cols-[2fr_1fr] gap-3">
      <Button
        variant={submitVariant}
        size="lg"
        icon={SubmitIconResolved}
        type={submitType}
        form={formId}
        disabled={submitDisabled}
        onClick={onSubmit}
        className="w-full"
      >
        {submitLabel}
      </Button>
      <Button variant="secondary" size="lg" onClick={onCancel} className="w-full">
        {cancelLabel}
      </Button>
    </div>
  );
}
