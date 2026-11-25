import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  FileText,
  ImagePlus,
  Link2,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AppSettings } from '../../types';
import { fetchImageAsUploadPath, uploadImagePath } from '../../utils/attachments';
import { Button, StoreMark, cn, fieldInput, fieldLabel } from '../ui';
import { SettingsPageShell, SettingsPanel } from './SettingsShell';

interface BusinessSettingsFormProps {
  appSettings: AppSettings;
  setAppSettings: (value: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
}

export default function BusinessSettingsForm({
  appSettings,
  setAppSettings,
}: BusinessSettingsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draftName, setDraftName] = useState(appSettings.name || '');
  const [draftLogo, setDraftLogo] = useState(appSettings.logo || '');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraftName(appSettings.name || '');
    setDraftLogo(appSettings.logo || '');
  }, [appSettings.name, appSettings.logo]);

  const isDirty =
    draftName.trim() !== (appSettings.name || '').trim() ||
    draftLogo !== (appSettings.logo || '');

  const previewName = draftName.trim() || 'حسابداری من';

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage('');
    setError('');
    setUploading(true);
    try {
      const path = await uploadImagePath(file, 'logos');
      setDraftLogo(path);
      setMessage('تصویر لوگو بارگذاری شد. برای اعمال نهایی روی «ذخیره تغییرات» کلیک کنید.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری تصویر لوگو.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrlImport = async () => {
    if (!imageUrl.trim()) return;
    setMessage('');
    setError('');
    setUploading(true);
    try {
      const path = await fetchImageAsUploadPath(imageUrl.trim(), 'logos');
      setDraftLogo(path);
      setImageUrl('');
      setMessage('تصویر از آدرس اینترنتی دریافت شد. برای اعمال نهایی روی «ذخیره تغییرات» کلیک کنید.');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'دریافت تصویر از اینترنت ناموفق بود. فایل را روی دستگاه ذخیره و مستقیم بارگذاری کنید.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setDraftLogo('');
    setMessage('');
    setError('');
  };

  const handleReset = () => {
    setDraftName(appSettings.name || '');
    setDraftLogo(appSettings.logo || '');
    setImageUrl('');
    setMessage('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = draftName.trim();
    if (!cleanedName) {
      setError('لطفاً نام کسب‌وکار یا مجموعه را وارد کنید.');
      setMessage('');
      return;
    }
    setAppSettings((prev) => ({
      ...prev,
      name: cleanedName,
      logo: draftLogo,
    }));
    setError('');
    setMessage('تغییرات مشخصات کسب‌وکار با موفقیت ذخیره شد.');
  };

  return (
    <form onSubmit={handleSubmit}>
      <SettingsPageShell
        title="مشخصات کسب‌وکار"
        subtitle="تنظیم نام رسمی و لوگوی مجموعه برای نمایش در منو، داشبورد و سربرگ گزارش‌های PDF"
        icon={Building2}
        actions={
          isDirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--warning-soft)] px-3 py-1.5 text-xs font-extrabold text-[color:var(--warning)]">
              تغییرات ذخیره‌نشده
            </span>
          ) : null
        }
        footer={
          <div className="flex flex-col-reverse items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
            <div className="text-xs font-medium text-[color:var(--muted)]">
              {isDirty
                ? 'پس از بررسی پیش‌نمایش، دکمه ذخیره تغییرات را بزنید.'
                : 'تمام مشخصات کسب‌وکار به‌روز و ذخیره شده است.'}
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
                disabled={uploading || !draftName.trim()}
                data-testid="business-save"
              >
                ذخیره تغییرات
              </Button>
            </div>
          </div>
        }
      >
        {message ? (
          <div
            role="status"
            data-testid="business-saved-banner"
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
          {/* Main Form Column */}
          <div className="space-y-5 lg:col-span-7">
            <SettingsPanel
              title="هویت و نام مجموعه"
              description="این نام در سایدبار، عنوان صفحات و خروجی‌های رسمی چاپ می‌شود"
              icon={Building2}
            >
              <div className="space-y-2">
                <label htmlFor="business-name-input" className={fieldLabel}>
                  نام کسب‌وکار / شرکت
                </label>
                <input
                  id="business-name-input"
                  data-testid="business-name-input"
                  className={fieldInput}
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    setMessage('');
                    setError('');
                  }}
                  placeholder="مثلاً شرکت بازرگانی سپهر یا فروشگاه نمونه"
                />
                <p className="text-[11px] font-medium text-[color:var(--muted)]">
                  بهتر است نام کوتاه و رسمی مجموعه را وارد کنید تا در سربرگ فاکتورها و گزارش‌ها خوانا باشد.
                </p>
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="لوگو و نشان تجاری"
              description="تصویر مربعی با پس‌زمینه شفاف یا روشن بهترین کیفیت را دارد"
              icon={ImagePlus}
            >
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-2)]/50 p-4 sm:flex-row">
                  <div className="relative shrink-0">
                    <StoreMark name={previewName} logo={draftLogo} size="lg" />
                    {uploading ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950/40 backdrop-blur-[1px]">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-1 flex-col gap-2 text-center sm:text-right">
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Upload}
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        انتخاب تصویر از دستگاه
                      </Button>
                      {draftLogo ? (
                        <Button
                          type="button"
                          variant="soft-danger"
                          size="sm"
                          icon={Trash2}
                          disabled={uploading}
                          onClick={handleRemoveLogo}
                        >
                          حذف لوگو
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-[11px] font-medium text-[color:var(--muted)]">
                      فرمت‌های مجاز: JPG، PNG یا WebP — حداکثر ۲ مگابایت
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => void handleLogoFileChange(e)}
                  />
                </div>

                {/* Direct URL Import */}
                <div className="space-y-1.5 border-t border-[color:var(--line)] pt-4">
                  <label htmlFor="business-logo-url" className={fieldLabel}>
                    دریافت لوگو از آدرس اینترنتی (اختیاری)
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="business-logo-url"
                      className={cn(fieldInput, 'flex-1')}
                      dir="ltr"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      icon={Link2}
                      disabled={uploading || !imageUrl.trim()}
                      onClick={() => void handleUrlImport()}
                      className="shrink-0"
                    >
                      دریافت تصویر
                    </Button>
                  </div>
                </div>
              </div>
            </SettingsPanel>
          </div>

          {/* Live Brand Preview Column */}
          <div className="lg:col-span-5">
            <SettingsPanel
              title="پیش‌نمایش زنده"
              description="نحوه نمایش نام و لوگوی شما در بخش‌های مختلف سامانه"
              className="lg:sticky lg:top-20"
            >
              <div className="space-y-4">
                {/* Dark Sidebar Lockup Preview */}
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-[color:var(--muted)]">
                    نمایش در منوی کناری (سایدبار)
                  </p>
                  <div className="app-sidebar rounded-2xl border border-white/10 p-3.5 text-white shadow-md">
                    <div className="flex items-center gap-3">
                      <StoreMark name={previewName} logo={draftLogo} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black tracking-tight text-white">
                          {previewName}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-[#8ba8d6]">
                          سامانه حسابداری یکپارچه
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official Report Header Preview */}
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-[color:var(--muted)]">
                    نمایش در سربرگ گزارش‌های PDF و چاپ
                  </p>
                  <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-solid)] p-4 shadow-xs">
                    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <StoreMark name={previewName} logo={draftLogo} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[color:var(--ink)]">
                            {previewName}
                          </p>
                          <p className="text-[10.5px] font-medium text-[color:var(--muted)]">
                            گزارش رسمی گردش و تراز مالی
                          </p>
                        </div>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                        <FileText size={15} />
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--muted)]">
                      <span>سرفصل‌های فعال</span>
                      <span className="font-bold text-[color:var(--ink)]">چاپ استاندارد A4 / A5</span>
                    </div>
                  </div>
                </div>
              </div>
            </SettingsPanel>
          </div>
        </div>
      </SettingsPageShell>
    </form>
  );
}
