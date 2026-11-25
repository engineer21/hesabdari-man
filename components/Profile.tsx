import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  LogOut,
  Phone,
  RotateCcw,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { uploadImagePath } from '../utils/attachments';
import { toPersianDigits } from '../utils/formatters';
import { Button, fieldInput, fieldLabel } from './ui';
import { SettingsPageShell, SettingsPanel } from './settings/SettingsShell';

interface ProfileProps {
  userProfile: UserProfile;
  setUserProfile: (value: UserProfile | ((val: UserProfile) => UserProfile)) => void;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ userProfile, setUserProfile, onLogout }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(userProfile.firstName || '');
  const [lastName, setLastName] = useState(userProfile.lastName || '');
  const [mobile, setMobile] = useState(userProfile.mobile || '');
  const [picture, setPicture] = useState(userProfile.picture || '');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setFirstName(userProfile.firstName || '');
    setLastName(userProfile.lastName || '');
    setMobile(userProfile.mobile || '');
    setPicture(userProfile.picture || '');
  }, [userProfile.firstName, userProfile.lastName, userProfile.mobile, userProfile.picture]);

  const isDirty =
    firstName.trim() !== (userProfile.firstName || '').trim() ||
    lastName.trim() !== (userProfile.lastName || '').trim() ||
    mobile.trim() !== (userProfile.mobile || '').trim() ||
    picture !== (userProfile.picture || '');

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || 'کاربر سیستم';
  const initial = fullName.trim().charAt(0) || 'ک';

  const handlePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    setError('');
    try {
      const path = await uploadImagePath(file, 'profiles');
      setPicture(path);
      setMessage('تصویر پروفایل بارگذاری شد. برای ذخیره نهایی روی «ذخیره اطلاعات پروفایل» کلیک کنید.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری تصویر پروفایل.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    setFirstName(userProfile.firstName || '');
    setLastName(userProfile.lastName || '');
    setMobile(userProfile.mobile || '');
    setPicture(userProfile.picture || '');
    setMessage('');
    setError('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setUserProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      mobile: mobile.trim(),
      picture,
    });
    setError('');
    setMessage('اطلاعات پروفایل کاربری با موفقیت ذخیره شد.');
  };

  return (
    <form onSubmit={handleSave}>
      <SettingsPageShell
        title="پروفایل کاربری"
        subtitle="ویرایش مشخصات فردی، تصویر نمایه و اطلاعات تماس حساب کاربری شما"
        icon={UserRound}
        actions={
          isDirty ? (
            <span className="inline-flex items-center rounded-full bg-[color:var(--warning-soft)] px-3 py-1.5 text-xs font-extrabold text-[color:var(--warning)]">
              تغییرات ذخیره‌نشده
            </span>
          ) : null
        }
        footer={
          <div className="flex flex-col-reverse items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
            <div className="text-xs font-medium text-[color:var(--muted)]">
              {isDirty
                ? 'تغییرات جدید آماده ذخیره‌سازی هستند.'
                : 'اطلاعات پروفایل کاربری ذخیره و به‌روز است.'}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isDirty ? (
                <Button
                  type="button"
                  variant="secondary"
                  icon={RotateCcw}
                  disabled={uploading}
                  onClick={handleReset}
                >
                  بازگردانی
                </Button>
              ) : null}
              <Button
                type="submit"
                icon={Check}
                disabled={uploading}
                data-testid="profile-save"
              >
                ذخیره اطلاعات پروفایل
              </Button>
            </div>
          </div>
        }
      >
        {message ? (
          <div
            role="status"
            data-testid="profile-saved-banner"
            className="flex items-center gap-2.5 rounded-2xl border border-[color:var(--income)]/25 bg-[color:var(--income-soft)] px-4 py-3 text-sm font-bold text-[color:var(--income)]"
          >
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-[color:var(--expense)]/25 bg-[color:var(--expense-soft)] px-4 py-3 text-sm font-bold text-[color:var(--expense)]"
          >
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-12">
          {/* Identity & Avatar Card */}
          <div className="lg:col-span-4">
            <section className="dash-card flex flex-col items-center p-6 text-center">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[color:var(--surface-solid)] bg-gradient-to-br from-[#2789ff] to-[#0b56e5] text-2xl font-black text-white shadow-lg ring-4 ring-[color:var(--brand-soft)]">
                  {picture ? (
                    <img src={picture} alt={fullName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
                {uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/45">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-brand-gradient absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[color:var(--surface-solid)] text-white shadow-sm transition hover:scale-105"
                  aria-label="تغییر تصویر پروفایل"
                >
                  <Camera size={14} />
                </button>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  ref={fileInputRef}
                  onChange={(e) => void handlePictureChange(e)}
                  className="hidden"
                />
              </div>

              <h2 className="mt-4 text-lg font-black text-[color:var(--ink)]">{fullName}</h2>
              {mobile.trim() ? (
                <p
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold tabular-nums text-[color:var(--muted)]"
                  dir="ltr"
                >
                  <Phone size={12} />
                  {toPersianDigits(mobile.trim())}
                </p>
              ) : (
                <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                  شماره موبایل ثبت نشده است
                </p>
              )}

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  تغییر عکس
                </Button>
                {picture ? (
                  <Button
                    type="button"
                    variant="soft-danger"
                    size="sm"
                    icon={Trash2}
                    disabled={uploading}
                    onClick={() => {
                      setPicture('');
                      setMessage('');
                    }}
                  >
                    حذف
                  </Button>
                ) : null}
              </div>
            </section>
          </div>

          {/* Inline Personal Details Form */}
          <div className="space-y-5 lg:col-span-8">
            <SettingsPanel
              title="اطلاعات شخصی"
              description="نام و شماره تماس شما در خوشامدگویی داشبورد و بخش کاربری نمایش داده می‌شود"
              icon={UserRound}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-first-name" className={fieldLabel}>
                    نام
                  </label>
                  <input
                    id="profile-first-name"
                    data-testid="profile-first-name"
                    type="text"
                    className={fieldInput}
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setMessage('');
                    }}
                    placeholder="مثلاً علی"
                  />
                </div>
                <div>
                  <label htmlFor="profile-last-name" className={fieldLabel}>
                    نام خانوادگی
                  </label>
                  <input
                    id="profile-last-name"
                    data-testid="profile-last-name"
                    type="text"
                    className={fieldInput}
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setMessage('');
                    }}
                    placeholder="مثلاً محمدی"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="profile-mobile" className={fieldLabel}>
                    شماره موبایل
                  </label>
                  <input
                    id="profile-mobile"
                    data-testid="profile-mobile"
                    type="tel"
                    dir="ltr"
                    className={fieldInput}
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value);
                      setMessage('');
                    }}
                    placeholder="09123456789"
                  />
                </div>
              </div>
            </SettingsPanel>

            {/* Session / Logout Panel */}
            <section className="dash-card flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-extrabold text-[color:var(--ink)]">نشست کاربری فعال</h2>
                <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
                  برای حفظ امنیت داده‌های مالی پس از پایان کار از حساب خود خارج شوید.
                </p>
              </div>
              <Button
                type="button"
                variant="soft-danger"
                icon={LogOut}
                onClick={onLogout}
                className="shrink-0"
              >
                خروج از حساب کاربری
              </Button>
            </section>
          </div>
        </div>
      </SettingsPageShell>
    </form>
  );
};

export default Profile;
