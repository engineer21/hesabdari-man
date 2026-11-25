import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  User,
} from 'lucide-react';
import {
  DEFAULT_OWNER_PASSWORD,
  DEFAULT_OWNER_USERNAME,
  initUser,
  isOwnerUsingDefaultPassword,
  login,
} from '../utils/auth';
import { APP_NAME } from '../constants';
import ThemeToggle from './ThemeToggle';
import LoginHero from './login/LoginHero';
import HelpBrochureModal from './HelpBrochureModal';
import PageHelpButton from './help/PageHelpButton';
import ContextualHelpPanel from './help/ContextualHelpPanel';
import { fetchPublicHelpConfig } from '../utils/helpPrefs';
import { resolvePageHelp } from '../utils/pageHelp';
import { cn, fieldLabel } from './ui';

interface LoginPageProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  onLoginSuccess: () => void | Promise<void>;
  bootstrapping?: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ theme, setTheme, onLoginSuccess, bootstrapping }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pageHelpOpen, setPageHelpOpen] = useState(false);
  const [pageHelpSeen, setPageHelpSeen] = useState(false);
  const [showDefaultHints, setShowDefaultHints] = useState(false);
  const [autoHelpPending, setAutoHelpPending] = useState(false);
  const loginHelp = resolvePageHelp('login');

  useEffect(() => {
    void (async () => {
      await initUser();
      const isDefault = await isOwnerUsingDefaultPassword();
      setShowDefaultHints(isDefault);
      if (isDefault) setUsername(DEFAULT_OWNER_USERNAME);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    void (async () => {
      const { showHelpOnLogin } = await fetchPublicHelpConfig();
      if (cancelled || !showHelpOnLogin) return;
      setAutoHelpPending(true);
      timer = window.setTimeout(() => {
        if (!cancelled) {
          setHelpOpen(true);
          setAutoHelpPending(false);
        }
      }, 700);
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('لطفاً نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setIsLoading(true);
    try {
      const session = await login(username, password);
      if (session) await onLoginSuccess();
      else setError('نام کاربری یا رمز عبور نادرست است.');
    } catch {
      setError('خطا در برقراری ارتباط. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFillDefault = () => {
    setUsername(DEFAULT_OWNER_USERNAME);
    setPassword(DEFAULT_OWNER_PASSWORD);
    setError('');
  };

  const busy = isLoading || Boolean(bootstrapping);

  return (
    <div className="ambient-bg fixed inset-0 overflow-y-auto" dir="rtl">
      <div className="relative mx-auto flex min-h-full w-full max-w-[66rem] flex-col justify-center px-4 py-6 sm:px-6 md:py-10">
        {/* Clean Top Utility Row */}
        <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--muted)]">
            <span className="text-[color:var(--ink)]">{APP_NAME}</span>
            <span aria-hidden>·</span>
            <span>ورود امن</span>
          </div>

          <div className="flex items-center gap-2">
            <PageHelpButton
              emphasize={!pageHelpSeen || autoHelpPending}
              onClick={() => {
                setPageHelpOpen(true);
                setPageHelpSeen(true);
              }}
            />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>

        {/* Unified Two-Column Architectural Auth Shell */}
        <main className="animate-sheet-up grid w-full overflow-hidden rounded-[2rem] border border-[color:var(--glass-border)] bg-[color:var(--surface-solid)] shadow-[var(--shadow-md)] lg:grid-cols-[1.08fr_0.92fr]">
          {/* Right Column (RTL): Deep Midnight Navy Brand & Live Preview Panel */}
          <LoginHero onOpenGuide={() => setHelpOpen(true)} />

          {/* Left Column (RTL): Clean Frosted Sign-In Form */}
          <section
            aria-labelledby="login-heading"
            className="flex flex-col justify-center bg-[color:var(--surface-solid)] px-6 py-8 sm:px-9 sm:py-10 lg:px-11 lg:py-12"
          >
            <div className="mx-auto w-full max-w-sm">
              <div className="mb-7">
                <p className="text-xs font-bold text-[color:var(--brand)]">حساب کاربری</p>
                <h1
                  id="login-heading"
                  className="mt-1.5 text-2xl font-black tracking-tight text-[color:var(--ink)]"
                >
                  ورود به سامانه
                </h1>
                <p className="mt-1.5 text-xs leading-6 text-[color:var(--muted)]">
                  نام کاربری و رمز عبور مالک یا حساب پرسنلی خود را وارد کنید.
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
                {/* Username Input (Zero-Overlap Flexbox) */}
                <div>
                  <label htmlFor="login-username" className={fieldLabel}>
                    نام کاربری
                  </label>
                  <div className="flex h-12 items-center gap-2.5 rounded-2xl border-[1.5px] border-[color:var(--line)] bg-[color:var(--surface-2)]/45 px-3.5 transition focus-within:border-[color:var(--brand)] focus-within:bg-[color:var(--surface-solid)] focus-within:ring-[3.5px] focus-within:ring-[color:var(--brand-glow)]">
                    <User size={17} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
                    <input
                      id="login-username"
                      data-testid="login-username"
                      type="text"
                      dir="ltr"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError('');
                      }}
                      autoComplete="username"
                      placeholder="admin"
                      className="min-w-0 flex-1 bg-transparent text-left text-sm font-bold text-[color:var(--ink)] outline-none placeholder:font-normal placeholder:text-[color:var(--muted)]/70"
                    />
                  </div>
                </div>

                {/* Password Input (Zero-Overlap Flexbox + Eye Toggle) */}
                <div>
                  <label htmlFor="login-password" className={fieldLabel}>
                    رمز عبور
                  </label>
                  <div className="flex h-12 items-center gap-2.5 rounded-2xl border-[1.5px] border-[color:var(--line)] bg-[color:var(--surface-2)]/45 px-3.5 transition focus-within:border-[color:var(--brand)] focus-within:bg-[color:var(--surface-solid)] focus-within:ring-[3.5px] focus-within:ring-[color:var(--brand-glow)]">
                    <Lock size={17} className="shrink-0 text-[color:var(--muted)]" aria-hidden />
                    <input
                      id="login-password"
                      data-testid="login-password"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError('');
                      }}
                      autoComplete="current-password"
                      placeholder={
                        showDefaultHints ? `پیش‌فرض: ${DEFAULT_OWNER_PASSWORD}` : '••••••••'
                      }
                      className="min-w-0 flex-1 bg-transparent text-left text-sm font-bold text-[color:var(--ink)] outline-none placeholder:font-normal placeholder:text-[color:var(--muted)]/70"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]/40"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Error Feedback (Icon + Text, Never Hue-Only) */}
                {error ? (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-2xl border border-[color:var(--expense)]/20 bg-[color:var(--expense-soft)] px-3.5 py-2.5 text-xs font-bold text-[color:var(--expense)]"
                  >
                    <AlertCircle size={16} className="shrink-0" aria-hidden />
                    <span>{error}</span>
                  </div>
                ) : null}

                {/* Dominant Primary Action */}
                <button
                  type="submit"
                  data-testid="login-submit"
                  disabled={busy}
                  className={cn(
                    'btn-brand-gradient mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-extrabold text-white transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60'
                  )}
                >
                  <LogIn size={17} aria-hidden />
                  <span>{busy ? 'در حال ورود…' : 'ورود به سامانه'}</span>
                </button>

                {/* Secondary Guide Action */}
                <button
                  type="button"
                  data-testid="login-open-guide"
                  onClick={() => setHelpOpen(true)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 px-4 text-xs font-extrabold text-[color:var(--ink)] transition hover:border-[color:var(--brand)]/35 hover:bg-[color:var(--brand-soft)]/60 hover:text-[color:var(--brand)]"
                >
                  <BookOpen size={16} aria-hidden />
                  <span>راهنمای کامل نرم‌افزار</span>
                </button>
              </form>

              {/* Default Credentials Strip (Only When Default Password Active) */}
              {showDefaultHints ? (
                <div className="mt-6 flex items-center justify-between gap-2 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/50 px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <KeyRound size={15} className="shrink-0 text-[color:var(--brand)]" aria-hidden />
                    <p className="truncate text-[11px] font-semibold text-[color:var(--muted)]">
                      مالک:{' '}
                      <span className="font-extrabold text-[color:var(--ink)]" dir="ltr">
                        {DEFAULT_OWNER_USERNAME}
                      </span>{' '}
                      · رمز:{' '}
                      <span className="font-extrabold text-[color:var(--ink)]" dir="ltr">
                        {DEFAULT_OWNER_PASSWORD}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickFillDefault}
                    className="shrink-0 whitespace-nowrap rounded-xl bg-[color:var(--brand-soft)] px-2.5 py-1.5 text-[11px] font-extrabold text-[color:var(--brand)] transition hover:bg-[color:var(--brand)] hover:text-white"
                  >
                    تکمیل خودکار
                  </button>
                </div>
              ) : (
                <p className="mt-6 text-center text-[11px] leading-5 text-[color:var(--muted)]">
                  کاربران پرسنلی با نام کاربری و رمز تعریف‌شده توسط مالک وارد شوند.
                </p>
              )}
            </div>
          </section>
        </main>
      </div>

      <ContextualHelpPanel
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        content={loginHelp}
        isFirstVisit
        onOpenFullGuide={() => setHelpOpen(true)}
      />

      <HelpBrochureModal
        isOpen={helpOpen}
        onClose={() => {
          setHelpOpen(false);
          setAutoHelpPending(false);
        }}
        isLoggedIn={false}
        initialSectionId="dashboard"
      />
    </div>
  );
};

export default LoginPage;
