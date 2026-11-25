import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { changePassword, getOwnerAccount } from '../../utils/auth';
import { Button, fieldLabel } from '../ui';
import { SettingsPageShell, SettingsPanel } from './SettingsShell';

export default function PasswordSettingsForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({
    text: '',
    type: '' as '' | 'success' | 'error',
  });
  const owner = getOwnerAccount();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    if (!currentPassword) {
      setMessage({ text: 'لطفاً رمز عبور فعلی را وارد کنید.', type: 'error' });
      return;
    }
    if (newPassword.length < 4) {
      setMessage({ text: 'رمز عبور جدید باید حداقل ۴ کاراکتر باشد.', type: 'error' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setMessage({ text: 'تکرار رمز عبور جدید با رمز واردشده یکسان نیست.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const ok = await changePassword(currentPassword, newPassword);
      if (ok.success) {
        setMessage({ text: ok.message || 'رمز عبور با موفقیت تغییر یافت.', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setMessage({ text: ok.message, type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPageShell
      title="امنیت و رمز عبور"
      subtitle="تغییر رمز ورود مالک سیستم و ارتقای ایمنی دسترسی به داده‌های مالی"
      icon={KeyRound}
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SettingsPanel
            title="تغییر رمز عبور مالک"
            description="برای ثبت رمز جدید ابتدا رمز فعلی خود را تأیید کنید"
            icon={KeyRound}
          >
            <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
              <div>
                <label htmlFor="pwd-current" className={fieldLabel}>
                  رمز عبور فعلی
                </label>
                <div className="flex h-[46px] items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-4 focus-within:ring-[color:var(--brand)]/10">
                  <input
                    id="pwd-current"
                    type={showCurrent ? 'text' : 'password'}
                    dir="ltr"
                    className="h-full min-w-0 flex-1 bg-transparent text-left text-sm font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    aria-label={showCurrent ? 'پنهان کردن رمز فعلی' : 'نمایش رمز فعلی'}
                    onClick={() => setShowCurrent((v) => !v)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="pwd-new" className={fieldLabel}>
                  رمز عبور جدید
                </label>
                <div className="flex h-[46px] items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-4 focus-within:ring-[color:var(--brand)]/10">
                  <input
                    id="pwd-new"
                    type={showNew ? 'text' : 'password'}
                    dir="ltr"
                    className="h-full min-w-0 flex-1 bg-transparent text-left text-sm font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="حداقل ۴ کاراکتر"
                  />
                  <button
                    type="button"
                    aria-label={showNew ? 'پنهان کردن رمز جدید' : 'نمایش رمز جدید'}
                    onClick={() => setShowNew((v) => !v)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="pwd-confirm" className={fieldLabel}>
                  تکرار رمز عبور جدید
                </label>
                <div className="flex h-[46px] items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] px-3 transition focus-within:border-[color:var(--brand)] focus-within:ring-4 focus-within:ring-[color:var(--brand)]/10">
                  <input
                    id="pwd-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    dir="ltr"
                    className="h-full min-w-0 flex-1 bg-transparent text-left text-sm font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="تکرار رمز جدید"
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? 'پنهان کردن تکرار رمز' : 'نمایش تکرار رمز'}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--ink)]"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {message.text ? (
                <div
                  role={message.type === 'error' ? 'alert' : 'status'}
                  className={
                    message.type === 'success'
                      ? 'flex items-center gap-2 rounded-2xl border border-[color:var(--income)]/25 bg-[color:var(--income-soft)] px-4 py-3 text-sm font-bold text-[color:var(--income)]'
                      : 'rounded-2xl border border-[color:var(--expense)]/25 bg-[color:var(--expense-soft)] px-4 py-3 text-sm font-bold text-[color:var(--expense)]'
                  }
                >
                  {message.type === 'success' ? <CheckCircle2 size={17} className="shrink-0" /> : null}
                  <span>{message.text}</span>
                </div>
              ) : null}

              <div className="pt-1">
                <Button
                  type="submit"
                  icon={Check}
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  ذخیره رمز عبور جدید
                </Button>
              </div>
            </form>
          </SettingsPanel>
        </div>

        <div className="lg:col-span-5">
          <SettingsPanel
            title="وضعیت امنیتی حساب"
            description="توصیه‌های حفظ ایمنی سامانه حسابداری"
            icon={ShieldCheck}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/65 p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl tone-brand">
                  <UserCheck size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[color:var(--muted)]">نام کاربری مالک</p>
                  <p className="truncate text-sm font-black text-[color:var(--ink)]" dir="ltr">
                    {owner?.username || 'admin'}
                  </p>
                </div>
              </div>

              <ul className="space-y-2 text-xs font-medium leading-6 text-[color:var(--muted)]">
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand)]" />
                  <span>از رمز عبور ترکیبی شامل حروف و اعداد با طول حداقل ۶ کاراکتر استفاده کنید.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand)]" />
                  <span>برای کارمندان و حسابداران به‌جای اشتراک رمز مالک، از بخش «دسترسی و کاربران» حساب جداگانه بسازید.</span>
                </li>
              </ul>
            </div>
          </SettingsPanel>
        </div>
      </div>
    </SettingsPageShell>
  );
}
