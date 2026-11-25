import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from './ui';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme, className }) => {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      aria-label={isDark ? 'حالت روشن' : 'حالت تیره'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'touch-target inline-flex items-center justify-center rounded-2xl border border-[color:var(--line)]',
        'bg-[color:var(--surface-1)] text-[color:var(--ink)] shadow-[var(--shadow-sm)]',
        'transition hover:border-[color:var(--brand)]/35 hover:bg-[color:var(--brand-soft)]/50',
        className
      )}
    >
      {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
    </button>
  );
};

export default ThemeToggle;
