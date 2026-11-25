import React from 'react';
import { CircleHelp } from 'lucide-react';
import { cn } from '../ui';

type Props = {
  onClick: () => void;
  /** Subtle highlight on first visit without pulsing or decorative sparkles */
  emphasize?: boolean;
  className?: string;
  size?: 'sm' | 'md';
};

/**
 * Calm, discoverable contextual help button aligned with the app's glass utility controls.
 */
export const PageHelpButton: React.FC<Props> = ({
  onClick,
  emphasize = false,
  className,
  size = 'md',
}) => {
  const dim = size === 'sm' ? 'h-9 px-3' : 'h-10 px-3.5';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="راهنمای این صفحه"
      title="راهنمای این صفحه"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl text-xs font-extrabold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]/40',
        dim,
        emphasize
          ? 'border border-[color:var(--brand)]/30 bg-[color:var(--brand-soft)] text-[color:var(--brand)] hover:bg-[color:var(--brand)] hover:text-white'
          : 'border border-[color:var(--line)] bg-[color:var(--surface-1)] text-[color:var(--ink)] shadow-[var(--shadow-sm)] hover:border-[color:var(--brand)]/35 hover:text-[color:var(--brand)]',
        className
      )}
    >
      <CircleHelp size={size === 'sm' ? 16 : 17} strokeWidth={2.2} aria-hidden />
      <span className="hidden sm:inline">راهنما</span>
    </button>
  );
};

export default PageHelpButton;
