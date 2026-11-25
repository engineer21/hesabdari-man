import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Check,
  CheckCircle2,
  MessageSquare,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { ReminderSettings, SmsDispatchLog, SmsProviderKind } from '../../types';
import { apiJson } from '../../utils/api';
import { toPersianDigits } from '../../utils/formatters';
import { Button, cn, fieldInput, fieldLabel } from '../ui';
import { useDialog } from '../DialogProvider';

interface ReminderSettingsFormProps {
  reminderSettings: ReminderSettings;
  setReminderSettings: (v: ReminderSettings | ((p: ReminderSettings) => ReminderSettings)) => void;
}

interface GatewayStatus {
  configured: boolean;
  selectedProvider?: string;
  provider: string;
  providerLabel: string;
  hasSender: boolean;
  sender?: string;
  template?: string;
}

const LEAD_OPTIONS = [
  { value: 0, label: 'فقط روز سررسید' },
  { value: 1, label: '۱ روز قبل از سررسید' },
  { value: 2, label: '۲ روز قبل از سررسید (پیشنهادی)' },
  { value: 3, label: '۳ روز قبل از سررسید' },
  { value: 7, label: '۷ روز قبل از سررسید' },
];

const PROVIDER_OPTIONS: { value: SmsProviderKind; label: string }[] = [
  { value: 'mock', label: 'حالت آزمایشی درون‌برنامه (ثبت در تاریخچه سامانه)' },
  { value: 'kavenegar', label: 'کاوه‌نگار (Kavenegar)' },
  { value: 'melipayamak', label: 'ملی‌پیامک (Melipayamak)' },
  { value: 'farazsms', label: 'فراز اس‌ام‌اس (FarazSMS)' },
];

const ReminderSettingsForm: React.FC<ReminderSettingsFormProps> = ({
  reminderSettings,
  setReminderSettings,
}) => {
  const dialog = useDialog();
  const [enabled, setEnabled] = useState(reminderSettings.enabled);
  const [leadDays, setLeadDays] = useState(reminderSettings.leadDays);
  const [recipientMobile, setRecipientMobile] = useState(reminderSettings.recipientMobile);
  const [smsEnabled, setSmsEnabled] = useState(reminderSettings.smsEnabled);
  const [smsProvider, setSmsProvider] = useState<SmsProviderKind>(
    reminderSettings.smsProvider || 'mock'
  );
  const [smsSender, setSmsSender] = useState(reminderSettings.smsSender || '');
  const [smsTemplate, setSmsTemplate] = useState(reminderSettings.smsTemplate || '');
  const [savedNotice, setSavedNotice] = useState(false);

  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [logs, setLogs] = useState<SmsDispatchLog[]>([]);
  const [sending, setSending] = useState(false);

  const refreshStatus = async () => {
    try {
      const resp = await apiJson<{
        gateway: GatewayStatus;
        settings: ReminderSettings;
        logs: SmsDispatchLog[];
      }>('/api/reminders/status', 'GET');
      setGateway(resp.gateway);
      setLogs(resp.logs || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    setEnabled(reminderSettings.enabled);
    setLeadDays(reminderSettings.leadDays);
    setRecipientMobile(reminderSettings.recipientMobile);
    setSmsEnabled(reminderSettings.smsEnabled);
    setSmsProvider(reminderSettings.smsProvider || 'mock');
    setSmsSender(reminderSettings.smsSender || '');
    setSmsTemplate(reminderSettings.smsTemplate || '');
  }, [reminderSettings]);

  const handleSave = () => {
    setReminderSettings({
      enabled,
      leadDays,
      recipientMobile: recipientMobile.trim(),
      smsEnabled,
      smsProvider,
      smsSender: smsSender.trim(),
      smsTemplate: smsTemplate.trim(),
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleTestSms = async () => {
    if (!recipientMobile.trim()) {
      await dialog.alert({
        title: 'شماره موبایل',
        message: 'ابتدا شماره موبایل گیرنده یادآوری را وارد کنید (مثلاً 09123456789).',
      });
      return;
    }
    handleSave();
    setSending(true);
    try {
      const resp = await apiJson<{ ok: boolean; log: SmsDispatchLog; gateway: GatewayStatus }>(
        '/api/reminders/test-sms',
        'POST',
        { recipient: recipientMobile.trim() }
      );
      setGateway(resp.gateway);
      setLogs((prev) => [resp.log, ...prev]);
      await dialog.alert({
        title: resp.log.status === 'sent' ? 'پیامک آزمایشی ارسال شد' : 'ثبت آزمایشی موفق',
        message: resp.log.detail || 'پیامک یادآوری با موفقیت در تاریخچه ثبت شد.',
      });
    } catch (e: any) {
      await dialog.alert({
        title: 'خطا در ارسال پیامک',
        message: e?.message || 'ارسال پیامک آزمایشی ناموفق بود.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-page-enter mx-auto max-w-5xl space-y-5 pb-28 md:pb-8" data-testid="reminders-settings-page">
      {/* Header Banner */}
      <div className="dash-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3.5">
          <div className="btn-brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md">
            <BellRing size={22} />
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-[color:var(--brand)]">مدیریت و تنظیمات</p>
            <h1 className="text-xl font-black text-[color:var(--ink)] md:text-2xl">
              یادآور سررسید چک‌ها، اقساط و پیامک
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[color:var(--muted)]">
              پیکربندی هشدارهای درون‌برنامه و تنظیمات درگاه پیامک ایرانی در داخل نرم‌افزار
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Settings Form Card */}
        <div className="dash-card space-y-5 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-[color:var(--ink)]">
            <Smartphone size={18} className="text-[color:var(--brand)]" />
            تنظیمات زمان‌بندی و درگاه پیامک
          </h2>

          <div className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3.5">
              <div>
                <p className="text-sm font-extrabold text-[color:var(--ink)]">
                  فعال‌سازی یادآور درون‌برنامه
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  نمایش چک‌ها و اقساط وام نزدیک سررسید در زنگوله اعلان و داشبورد
                </p>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
            </label>

            <div>
              <label className={fieldLabel}>زمان اعلام یادآوری قبل از سررسید</label>
              <select
                className={fieldInput}
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
              >
                {LEAD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={fieldLabel}>شماره موبایل دریافت‌کننده پیامک یادآوری</label>
              <input
                className={cn(fieldInput, 'tabular-nums')}
                dir="ltr"
                inputMode="tel"
                value={recipientMobile}
                onChange={(e) => setRecipientMobile(e.target.value)}
                placeholder="09123456789"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3.5">
              <div>
                <p className="text-sm font-extrabold text-[color:var(--ink)]">
                  ارسال پیامک از طریق درگاه ایرانی
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  اتصال به کاوه‌نگار، ملی‌پیامک یا فراز اس‌ام‌اس
                </p>
              </div>
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
            </label>

            <div className="grid grid-cols-1 gap-3.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/40 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={fieldLabel}>سرویس‌دهنده درگاه پیامک (SMS Provider)</label>
                <select
                  className={fieldInput}
                  value={smsProvider}
                  onChange={(e) => setSmsProvider(e.target.value as SmsProviderKind)}
                >
                  {PROVIDER_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabel}>شماره خط فرستنده (SMS Sender)</label>
                <input
                  className={cn(fieldInput, 'tabular-nums')}
                  dir="ltr"
                  value={smsSender}
                  onChange={(e) => setSmsSender(e.target.value)}
                  placeholder="10008663"
                />
              </div>
              <div>
                <label className={fieldLabel}>شناسه الگو / قالب پیامک (اختیاری)</label>
                <input
                  className={fieldInput}
                  dir="ltr"
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  placeholder="check-due-reminder"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={Check} onClick={handleSave} data-testid="save-reminder-settings">
                ذخیره تنظیمات
              </Button>
              <Button
                variant="secondary"
                icon={Send}
                disabled={sending}
                onClick={() => void handleTestSms()}
                data-testid="send-test-sms"
              >
                {sending ? 'در حال ارسال...' : 'ارسال پیامک آزمایشی'}
              </Button>
            </div>
            {savedNotice ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 size={14} />
                تنظیمات ذخیره شد
              </span>
            ) : null}
          </div>
        </div>

        {/* Server Gateway Status Card */}
        <div className="dash-card space-y-4 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-[color:var(--ink)]">
            <ShieldCheck size={18} className="text-[color:var(--brand)]" />
            وضعیت درگاه پیامک سرور
          </h2>

          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60 p-4">
            <p className="text-xs font-bold text-[color:var(--muted)]">درگاه انتخابی در تنظیمات</p>
            <p className="mt-1 text-sm font-black text-[color:var(--ink)]">
              {PROVIDER_OPTIONS.find((p) => p.value === smsProvider)?.label ||
                gateway?.providerLabel ||
                'حالت آزمایشی درون‌برنامه'}
            </p>
            <p className="mt-2 text-xs leading-6 text-[color:var(--muted)]">
              {gateway?.configured
                ? 'درگاه پیامک روی سرور فعال است و پیامک‌های یادآوری به شماره موبایل ثبت‌شده ارسال می‌شوند.'
                : 'سرویس‌دهنده، خط فرستنده و الگوی پیامک مستقیماً در همین بخش ذخیره می‌شوند و کلیه پیامک‌های یادآوری و آزمایشی در تاریخچه سامانه ثبت و قابل پیگیری هستند.'}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-[color:var(--ink)]">
              <MessageSquare size={14} className="text-[color:var(--brand)]" />
              تاریخچه پیامک‌های ارسالی / آزمایشی
            </h3>
            {logs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[color:var(--line)] p-4 text-center text-xs text-[color:var(--muted)]">
                هنوز پیامکی ارسال نشده است. با دکمه «ارسال پیامک آزمایشی» عملکرد را تست کنید.
              </p>
            ) : (
              <div className="max-h-64 divide-y divide-[color:var(--line)]/60 overflow-y-auto rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-1)] px-3.5">
                {logs.map((l) => (
                  <div key={l.id} className="space-y-1 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold tabular-nums text-[color:var(--ink)]" dir="ltr">
                        {toPersianDigits(l.recipient)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold',
                          l.status === 'sent'
                            ? 'tone-income'
                            : l.status === 'dry_run'
                              ? 'tone-brand'
                              : 'tone-expense'
                        )}
                      >
                        {l.status === 'sent'
                          ? 'ارسال‌شده'
                          : l.status === 'dry_run'
                            ? 'آزمایشی'
                            : 'ناموفق'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-5 text-[color:var(--muted)]">{l.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderSettingsForm;
