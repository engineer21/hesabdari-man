import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { Button, IconButton, cn } from './ui';

export type DialogTone = 'danger' | 'warning' | 'info' | 'success' | 'error';

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Extract<DialogTone, 'danger' | 'warning'>;
};

type AlertOpts = {
  title?: string;
  message: string;
  tone?: Exclude<DialogTone, 'danger'>;
  okLabel?: string;
};

type ActiveDialog =
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      tone: 'danger' | 'warning';
      resolve: (ok: boolean) => void;
    }
  | {
      kind: 'alert';
      title: string;
      message: string;
      tone: Exclude<DialogTone, 'danger'>;
      okLabel: string;
      resolve: () => void;
    };

type DialogApi = {
  confirm: (opts: ConfirmOpts | string) => Promise<boolean>;
  alert: (opts: AlertOpts | string) => Promise<void>;
  success: (message: string, title?: string) => Promise<void>;
  error: (message: string, title?: string) => Promise<void>;
  warn: (message: string, title?: string) => Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

const TONE_UI: Record<
  DialogTone,
  { iconBg: string; iconColor: string; Icon: typeof Trash2 }
> = {
  danger: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    Icon: Trash2,
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
  },
  info: {
    iconBg: 'bg-[color:var(--brand-soft)]',
    iconColor: 'text-[color:var(--brand)]',
    Icon: Info,
  },
  success: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    Icon: CheckCircle2,
  },
  error: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    Icon: ShieldAlert,
  },
};

function AppDialogHost({ dialog, onDismiss }: { dialog: ActiveDialog; onDismiss: () => void }) {
  const tone = dialog.kind === 'confirm' ? dialog.tone : dialog.tone;
  const ui = TONE_UI[tone];
  const Icon = ui.Icon;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialog.kind === 'confirm') dialog.resolve(false);
        else dialog.resolve();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, onDismiss]);

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center p-4 sm:items-center animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-dialog-title"
      aria-describedby="app-dialog-desc"
    >
      <button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={() => {
          if (dialog.kind === 'confirm') dialog.resolve(false);
          else dialog.resolve();
          onDismiss();
        }}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--surface-1)] shadow-[0_24px_64px_rgba(15,23,42,0.28)] animate-scale-in">
        <div className="flex items-start gap-3 p-5 pb-4">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', ui.iconBg, ui.iconColor)}>
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 id="app-dialog-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              {dialog.title}
            </h3>
            <p id="app-dialog-desc" className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {dialog.message}
            </p>
          </div>
          <IconButton
            icon={X}
            label="بستن"
            onClick={() => {
              if (dialog.kind === 'confirm') dialog.resolve(false);
              else dialog.resolve();
              onDismiss();
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--line)] bg-[color:var(--surface-2)] px-5 py-4">
          {dialog.kind === 'confirm' ? (
            <>
              <Button
                variant="secondary"
                icon={X}
                onClick={() => {
                  dialog.resolve(false);
                  onDismiss();
                }}
              >
                {dialog.cancelLabel}
              </Button>
              <Button
                variant={dialog.tone === 'danger' ? 'danger' : 'primary'}
                icon={dialog.tone === 'danger' ? Trash2 : AlertTriangle}
                autoFocus
                className={
                  dialog.tone === 'warning'
                    ? 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500/30'
                    : undefined
                }
                onClick={() => {
                  dialog.resolve(true);
                  onDismiss();
                }}
              >
                {dialog.confirmLabel}
              </Button>
            </>
          ) : (
            <Button
              variant={dialog.tone === 'error' ? 'danger' : 'primary'}
              icon={dialog.tone === 'success' ? CheckCircle2 : dialog.tone === 'error' ? ShieldAlert : Info}
              autoFocus
              className="col-span-2"
              onClick={() => {
                dialog.resolve();
                onDismiss();
              }}
            >
              {dialog.okLabel}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const dismiss = useCallback(() => setDialog(null), []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (opts) =>
        new Promise<boolean>((resolve) => {
          const o = typeof opts === 'string' ? { message: opts } : opts;
          setDialog({
            kind: 'confirm',
            title: o.title || (o.tone === 'warning' ? 'توجه' : 'حذف شود؟'),
            message: o.message,
            confirmLabel: o.confirmLabel || (o.tone === 'warning' ? 'ادامه' : 'حذف'),
            cancelLabel: o.cancelLabel || 'انصراف',
            tone: o.tone || 'danger',
            resolve,
          });
        }),
      alert: (opts) =>
        new Promise<void>((resolve) => {
          const o = typeof opts === 'string' ? { message: opts } : opts;
          setDialog({
            kind: 'alert',
            title: o.title || (o.tone === 'success' ? 'انجام شد' : o.tone === 'error' ? 'خطا' : 'پیام'),
            message: o.message,
            tone: o.tone || 'info',
            okLabel: o.okLabel || 'باشه',
            resolve,
          });
        }),
      success: (message, title = 'انجام شد') =>
        new Promise<void>((resolve) => {
          setDialog({ kind: 'alert', title, message, tone: 'success', okLabel: 'باشه', resolve });
        }),
      error: (message, title = 'خطا') =>
        new Promise<void>((resolve) => {
          setDialog({ kind: 'alert', title, message, tone: 'error', okLabel: 'باشه', resolve });
        }),
      warn: (message, title = 'توجه') =>
        new Promise<void>((resolve) => {
          setDialog({ kind: 'alert', title, message, tone: 'warning', okLabel: 'متوجه شدم', resolve });
        }),
    }),
    []
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog ? <AppDialogHost dialog={dialog} onDismiss={dismiss} /> : null}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog باید داخل DialogProvider باشد.');
  return ctx;
}
