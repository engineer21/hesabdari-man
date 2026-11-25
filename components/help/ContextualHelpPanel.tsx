import React, { useEffect, useRef } from 'react';
import { BookOpen, Check, CircleHelp, Lightbulb, X } from 'lucide-react';
import type { PageHelpContent } from '../../utils/pageHelp';
import { toPersianDigits } from '../../utils/formatters';
import { cn } from '../ui';

type Props = {
  open: boolean;
  onClose: () => void;
  content: PageHelpContent;
  isFirstVisit?: boolean;
  onOpenFullGuide?: () => void;
};

/**
 * Contextual help drawer aligned with the Frosted Ice-Blue & Midnight Navy system:
 * concise per-screen guidance + direct entry to the full interactive guide.
 */
export const ContextualHelpPanel: React.FC<Props> = ({
  open,
  onClose,
  content,
  isFirstVisit,
  onOpenFullGuide,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={`راهنمای ${content.title}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px] transition-opacity"
        aria-label="بستن راهنمای صفحه"
        onClick={onClose}
      />
      <aside
        className={cn(
          'relative flex h-full w-full max-w-md flex-col',
          'border-s border-[color:var(--glass-border)] bg-[color:var(--surface-solid)] shadow-[-16px_0_48px_rgba(7,25,58,0.22)]',
          'animate-[slide-in-side_0.26s_cubic-bezier(0.22,1,0.36,1)]'
        )}
      >
        {/* Deep Midnight Navy Compact Header */}
        <header className="app-sidebar shrink-0 px-5 pb-5 pt-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2a86ff] to-[#00b4d8] shadow-[0_8px_20px_rgba(13,99,245,0.4)]">
                <CircleHelp size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-sky-200/80">
                  {isFirstVisit ? 'راهنمای سریع صفحه' : 'نکات کاربردی'}
                </p>
                <h2 className="mt-0.5 truncate text-lg font-black tracking-tight text-white">
                  {content.title}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-300/90">{content.subtitle}</p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200 transition hover:bg-white/20 hover:text-white"
              aria-label="بستن راهنما"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        {/* Scrollable Tips & Steps */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <p className="mb-3 text-xs font-extrabold text-[color:var(--muted)]">نکات کلیدی</p>
          <ul className="divide-y divide-[color:var(--line)] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/35">
            {content.tips.map((tip) => (
              <li key={tip.title} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                    <Lightbulb size={15} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[color:var(--ink)]">{tip.title}</p>
                    <p className="mt-1 text-xs leading-6 text-[color:var(--muted)]">{tip.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {content.steps?.length ? (
            <div className="mt-6">
              <p className="mb-3 text-xs font-extrabold text-[color:var(--muted)]">
                مسیر پیشنهادی شروع
              </p>
              <ol className="space-y-2">
                {content.steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3.5 py-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-soft)] text-xs font-black tabular-nums text-[color:var(--brand)]">
                      {toPersianDigits(i + 1)}
                    </span>
                    <span className="min-w-0 flex-1 text-xs font-bold leading-5 text-[color:var(--ink)]">
                      {step}
                    </span>
                    <Check size={14} className="shrink-0 text-[color:var(--income)]" aria-hidden />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <footer className="shrink-0 space-y-2 border-t border-[color:var(--line)] bg-[color:var(--surface-2)]/35 p-4">
          {onOpenFullGuide ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullGuide();
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-4 text-xs font-extrabold text-[color:var(--ink)] transition hover:border-[color:var(--brand)]/35 hover:text-[color:var(--brand)]"
            >
              <BookOpen size={16} aria-hidden />
              <span>مشاهده راهنمای کامل نرم‌افزار</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="btn-brand-gradient flex h-11 w-full items-center justify-center rounded-2xl px-4 text-xs font-extrabold text-white"
          >
            متوجه شدم
          </button>
        </footer>
      </aside>
    </div>
  );
};

export default ContextualHelpPanel;
