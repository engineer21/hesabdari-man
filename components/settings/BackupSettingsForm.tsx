import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Database,
  Download,
  HardDriveDownload,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  createBackupFile,
  createServerAutoBackupNow,
  createServerManualBackup,
  deleteServerBackup,
  downloadServerBackup,
  downloadServerBackupById,
  formatBackupSize,
  kindLabel,
  listServerBackups,
  onChangeModeLabel,
  restoreFromBackup,
  restoreServerBackupById,
  updateBackupSettings,
  type BackupSettings,
  type OnChangeBackupMode,
  type ServerBackupMeta,
} from '../../utils/backup';
import { useCan } from '../../hooks/useSessionAuth';
import { toPersianDigits } from '../../utils/formatters';
import { Button, cn, fieldInput, fieldLabel } from '../ui';
import { SettingsPageShell, SettingsPanel } from './SettingsShell';
import { useDialog } from '../DialogProvider';

type DraftSettings = {
  enabled: boolean;
  onChangeMode: OnChangeBackupMode;
  debounceSeconds: number;
  minIntervalMinutes: number;
  intervalHours: number;
  intervalOnlyIfDirty: boolean;
  keepAuto: number;
  keepSafety: number;
};

function settingsToDraft(s: BackupSettings): DraftSettings {
  return {
    enabled: s.enabled,
    onChangeMode: s.onChangeMode || 'debounced',
    debounceSeconds: Math.round((s.debounceMs || 45000) / 1000),
    minIntervalMinutes: Math.round((s.minIntervalMs || 60000) / 60000),
    intervalHours: s.intervalHours ?? 6,
    intervalOnlyIfDirty: s.intervalOnlyIfDirty !== false,
    keepAuto: s.keepAuto || 20,
    keepSafety: s.keepSafety || 10,
  };
}

function formatFaDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return toPersianDigits(
      new Date(iso).toLocaleString('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  } catch {
    return iso;
  }
}

export default function BackupSettingsForm({
  allData,
  onRestore,
  onFactoryReset,
  onLoadDemo,
  onClearAllData,
}: {
  allData: Record<string, unknown>;
  onRestore: (data: any) => void | Promise<void>;
  onFactoryReset: () => void;
  onLoadDemo: () => void;
  onClearAllData: () => void;
}) {
  const can = useCan();
  const canBackup = can('settings.backup');
  const canDemo = can('settings.demo');
  const dialog = useDialog();
  const [message, setMessage] = useState({
    text: '',
    type: '' as '' | 'success' | 'error',
  });
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ServerBackupMeta[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [draft, setDraft] = useState<DraftSettings | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    if (!canBackup) return;
    setLoadingList(true);
    try {
      const data = await listServerBackups();
      setItems(data.items || []);
      if (data.settings) {
        setSettings(data.settings);
        setDraft(settingsToDraft(data.settings));
      }
    } catch {
      setMessage({ text: 'خواندن فهرست پشتیبان‌ها ناموفق بود.', type: 'error' });
    } finally {
      setLoadingList(false);
    }
  }, [canBackup]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const patchDraft = (partial: Partial<DraftSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const handleCreateBackup = async () => {
    setBusy(true);
    try {
      if (canBackup) {
        await downloadServerBackup();
        await createServerManualBackup('دانلود دستی');
        await refreshList();
      } else {
        createBackupFile(allData);
      }
      setMessage({ text: 'فایل پشتیبان دانلود شد و یک نسخه روی سرور نیز ذخیره شد.', type: 'success' });
    } catch {
      setMessage({ text: 'خطا در ساخت پشتیبان.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleServerSnapshot = async () => {
    setBusy(true);
    try {
      await createServerManualBackup('اسنپ‌شات دستی');
      await refreshList();
      setMessage({ text: 'اسنپ‌شات روی سرور ذخیره شد.', type: 'success' });
    } catch {
      setMessage({ text: 'ذخیره اسنپ‌شات روی سرور ناموفق بود.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleAutoNow = async () => {
    setBusy(true);
    try {
      await createServerAutoBackupNow();
      await refreshList();
      setMessage({ text: 'بکاپ خودکار همین الان گرفته شد.', type: 'success' });
    } catch {
      setMessage({ text: 'بکاپ خودکار ناموفق بود.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAuto = async () => {
    if (!settings || !draft) return;
    setBusy(true);
    try {
      const next = await updateBackupSettings({ enabled: !draft.enabled });
      setSettings(next);
      setDraft(settingsToDraft(next));
      setMessage({
        text: next.enabled ? 'بکاپ خودکار فعال شد.' : 'بکاپ خودکار غیرفعال شد.',
        type: 'success',
      });
    } catch {
      setMessage({ text: 'تغییر وضعیت بکاپ خودکار ناموفق بود.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAutoSettings = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const next = await updateBackupSettings({
        enabled: draft.enabled,
        onChangeMode: draft.onChangeMode,
        debounceSeconds: draft.debounceSeconds,
        minIntervalMinutes: draft.minIntervalMinutes,
        intervalHours: draft.intervalHours,
        intervalOnlyIfDirty: draft.intervalOnlyIfDirty,
        keepAuto: draft.keepAuto,
        keepSafety: draft.keepSafety,
      });
      setSettings(next);
      setDraft(settingsToDraft(next));
      setMessage({ text: 'تنظیمات بکاپ خودکار با موفقیت ذخیره شد.', type: 'success' });
    } catch {
      setMessage({ text: 'ذخیره تنظیمات ناموفق بود.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const ok = await dialog.confirm({
        title: 'بازیابی پشتیبان',
        message:
          'داده‌های فعلی با محتوای فایل جایگزین می‌شوند. قبل از بازیابی یک نسخهٔ ایمنی روی سرور ساخته می‌شود.',
        tone: 'warning',
        confirmLabel: 'بازیابی',
      });
      if (!ok) return;
      setBusy(true);
      const data = await restoreFromBackup(file);
      await onRestore(data);
      await refreshList();
      setMessage({ text: 'بازیابی از فایل با موفقیت انجام شد.', type: 'success' });
    } catch (e: any) {
      setMessage({ text: e?.message || 'فایل پشتیبان نامعتبر است.', type: 'error' });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRestoreId = async (item: ServerBackupMeta) => {
    const ok = await dialog.confirm({
      title: 'بازیابی از سرور',
      message: `نسخه «${kindLabel(item.kind)}» مورخ ${formatFaDate(item.createdAt)} جایگزین داده‌های فعلی شود؟`,
      tone: 'warning',
      confirmLabel: 'بازیابی',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const state = await restoreServerBackupById(item.id);
      await onRestore({ ...state, __serverApplied: true });
      await refreshList();
      setMessage({ text: 'بازیابی از سرور با موفقیت انجام شد.', type: 'success' });
    } catch {
      setMessage({ text: 'بازیابی از سرور ناموفق بود.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteId = async (item: ServerBackupMeta) => {
    const ok = await dialog.confirm({
      title: 'حذف پشتیبان',
      message: 'این نسخه از سرور برای همیشه حذف می‌شود.',
      tone: 'danger',
      confirmLabel: 'حذف',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteServerBackup(item.id);
      await refreshList();
      setMessage({ text: 'نسخه پشتیبان حذف شد.', type: 'success' });
    } catch {
      setMessage({ text: 'حذف پشتیبان ناموفق بود.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    const ok = await dialog.confirm({
      title: 'بازنشانی به داده نمونه',
      message: 'داده‌ها با مجموعه داده آزمایشی جایگزین می‌شوند؛ قبل از آن نسخهٔ ایمنی ساخته می‌شود.',
      tone: 'danger',
      confirmLabel: 'بازنشانی',
    });
    if (ok) {
      onFactoryReset();
      setTimeout(() => void refreshList(), 800);
      setMessage({ text: 'داده نمونه بارگذاری شد.', type: 'success' });
    }
  };

  const handleLoadDemo = async () => {
    const ok = await dialog.confirm({
      title: 'بارگذاری داده نمونه',
      message: 'داده‌های فعلی جایگزین می‌شوند؛ قبل از آن یک نسخهٔ ایمنی روی سرور ذخیره می‌شود.',
      tone: 'warning',
      confirmLabel: 'بارگذاری',
    });
    if (!ok) return;
    onLoadDemo();
    setTimeout(() => void refreshList(), 800);
    setMessage({ text: 'داده نمونه بارگذاری شد.', type: 'success' });
  };

  const handleClearAll = async () => {
    const ok = await dialog.confirm({
      title: 'پاک کردن همه اطلاعات',
      message:
        'تمام تراکنش‌ها، اشخاص، بانک‌ها و سرفصل‌ها حذف می‌شوند. قبل از پاک‌سازی نسخهٔ ایمنی ساخته می‌شود.',
      tone: 'danger',
      confirmLabel: 'پاک کردن همه',
    });
    if (!ok) return;
    onClearAllData();
    setTimeout(() => void refreshList(), 800);
    setMessage({ text: 'همه اطلاعات پاک شد.', type: 'success' });
  };

  if (!canBackup && !canDemo) {
    return (
      <SettingsPageShell
        title="پشتیبان‌گیری و بازیابی"
        subtitle="دسترسی به این بخش برای شما فعال نیست"
        icon={HardDriveDownload}
      >
        <SettingsPanel title="عدم دسترسی" description="با مدیر سیستم تماس بگیرید">
          <p className="text-sm text-[color:var(--muted)]">
            مجوز «پشتیبان» یا «داده نمونه» برای حساب شما تعریف نشده است.
          </p>
        </SettingsPanel>
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      title="پشتیبان‌گیری و بازیابی"
      subtitle="دانلود فایل JSON، زمان‌بندی بکاپ خودکار و مدیریت نسخه‌های ذخیره‌شده روی سرور"
      icon={HardDriveDownload}
    >
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

      {canBackup ? (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Quick File & Snapshot Actions */}
          <div className="space-y-5 lg:col-span-5">
            <SettingsPanel
              title="پشتیبان دستی و بازیابی فایل"
              description="خروجی JSON قابل نگهداری روی سیستم یا انتقال به سرور دیگر"
              icon={HardDriveDownload}
            >
              <div className="flex flex-col gap-2.5">
                <Button disabled={busy} icon={HardDriveDownload} onClick={() => void handleCreateBackup()}>
                  دانلود پشتیبان JSON
                </Button>
                <Button
                  variant="secondary"
                  icon={Server}
                  disabled={busy}
                  onClick={() => void handleServerSnapshot()}
                >
                  ذخیره اسنپ‌شات روی سرور
                </Button>
                <Button
                  variant="secondary"
                  icon={RotateCcw}
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  بازیابی از فایل JSON
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => void handleFileChange(e)}
                />
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="نسخه‌های ذخیره‌شده روی سرور"
              description={`${toPersianDigits(String(items.length))} نسخه — خودکار، دستی و ایمنی`}
              icon={Server}
              badge={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RefreshCw}
                  disabled={busy || loadingList}
                  onClick={() => void refreshList()}
                >
                  بروزرسانی
                </Button>
              }
            >
              {loadingList && !items.length ? (
                <p className="py-6 text-center text-sm text-[color:var(--muted)]">در حال بارگذاری…</p>
              ) : null}
              {!loadingList && !items.length ? (
                <p className="py-6 text-center text-sm text-[color:var(--muted)]">
                  هنوز پشتیبانی روی سرور ذخیره نشده است.
                </p>
              ) : null}
              <ul className="nice-scroll max-h-80 space-y-2 overflow-y-auto pe-1">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 text-right">
                        <p className="text-xs font-extrabold text-[color:var(--ink)]">
                          {kindLabel(item.kind)}
                          {item.reason ? ` · ${item.reason}` : ''}
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-[color:var(--muted)]">
                          {formatFaDate(item.createdAt)} · {formatBackupSize(item.size)}
                        </p>
                        <p className="mt-0.5 text-[10.5px] tabular-nums text-[color:var(--muted)]">
                          {toPersianDigits(String(item.accounts ?? 0))} سرفصل ·{' '}
                          {toPersianDigits(String(item.transactions ?? 0))} تراکنش ·{' '}
                          {toPersianDigits(String(item.contacts ?? 0))} شخص
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void handleRestoreId(item)}
                          title="بازیابی"
                          aria-label="بازیابی نسخه"
                        >
                          <RotateCcw size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void downloadServerBackupById(item.id, item.fileName).catch(() =>
                              setMessage({ text: 'دانلود ناموفق بود.', type: 'error' })
                            )
                          }
                          title="دانلود"
                          aria-label="دانلود نسخه"
                        >
                          <Download size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="soft-danger"
                          disabled={busy}
                          onClick={() => void handleDeleteId(item)}
                          title="حذف"
                          aria-label="حذف نسخه"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </SettingsPanel>
          </div>

          {/* Automatic Backup Configuration */}
          <div className="lg:col-span-7">
            <SettingsPanel
              title="تنظیمات بکاپ خودکار"
              description="زمان‌بندی پشتیبان‌گیری پس از تغییرات و دوره‌های منظم روی سرور"
              icon={Clock}
              badge={
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold',
                    draft?.enabled ? 'tone-income' : 'bg-[color:var(--surface-2)] text-[color:var(--muted)]'
                  )}
                >
                  {draft?.enabled ? 'فعال' : 'غیرفعال'}
                </span>
              }
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/55 px-4 py-3">
                  <div className="text-xs">
                    <p className="font-extrabold text-[color:var(--ink)]">
                      آخرین بکاپ خودکار: {formatFaDate(settings?.lastAutoAt)}
                    </p>
                    <p className="mt-0.5 font-medium text-[color:var(--muted)]">
                      {settings?.dirtySinceBackup
                        ? 'تغییرات جدیدی از آخرین بکاپ ثبت شده است'
                        : 'داده‌ها با آخرین بکاپ همگام هستند'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy || !draft}
                      onClick={() => void handleToggleAuto()}
                    >
                      {draft?.enabled ? 'غیرفعال کردن' : 'فعال کردن'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Clock}
                      disabled={busy}
                      onClick={() => void handleAutoNow()}
                    >
                      اجرا الآن
                    </Button>
                  </div>
                </div>

                {draft ? (
                  <div className="space-y-4">
                    <div>
                      <label className={fieldLabel}>رفتار هنگام تغییر داده‌ها</label>
                      <select
                        className={fieldInput}
                        value={draft.onChangeMode}
                        disabled={busy || !draft.enabled}
                        onChange={(e) =>
                          patchDraft({ onChangeMode: e.target.value as OnChangeBackupMode })
                        }
                      >
                        <option value="debounced">با تأخیر بعد از آخرین تغییر (پیشنهادی)</option>
                        <option value="immediate">سریع بعد از هر تغییر</option>
                        <option value="off">خاموش — فقط زمان‌بندی دوره‌ای</option>
                      </select>
                      <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                        {onChangeModeLabel(draft.onChangeMode)}
                      </p>
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-2">
                      {draft.onChangeMode === 'debounced' ? (
                        <div>
                          <label className={fieldLabel}>تأخیر پس از آخرین تغییر (ثانیه)</label>
                          <input
                            type="number"
                            min={10}
                            max={1800}
                            step={5}
                            className={fieldInput}
                            dir="ltr"
                            disabled={busy || !draft.enabled}
                            value={draft.debounceSeconds}
                            onChange={(e) =>
                              patchDraft({
                                debounceSeconds: Math.max(
                                  10,
                                  Math.min(1800, Number(e.target.value) || 45)
                                ),
                              })
                            }
                          />
                        </div>
                      ) : null}

                      {draft.onChangeMode !== 'off' ? (
                        <div>
                          <label className={fieldLabel}>حداقل فاصله دو بکاپ (دقیقه)</label>
                          <input
                            type="number"
                            min={1}
                            max={360}
                            className={fieldInput}
                            dir="ltr"
                            disabled={busy || !draft.enabled}
                            value={draft.minIntervalMinutes}
                            onChange={(e) =>
                              patchDraft({
                                minIntervalMinutes: Math.max(
                                  1,
                                  Math.min(360, Number(e.target.value) || 1)
                                ),
                              })
                            }
                          />
                        </div>
                      ) : null}

                      <div>
                        <label className={fieldLabel}>بکاپ دوره‌ای هر چند ساعت (۰ = خاموش)</label>
                        <input
                          type="number"
                          min={0}
                          max={168}
                          className={fieldInput}
                          dir="ltr"
                          disabled={busy || !draft.enabled}
                          value={draft.intervalHours}
                          onChange={(e) =>
                            patchDraft({
                              intervalHours: Math.max(0, Math.min(168, Number(e.target.value) || 0)),
                            })
                          }
                        />
                      </div>

                      <div className="flex items-end pb-2">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[color:var(--ink)]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[color:var(--brand)]"
                            checked={draft.intervalOnlyIfDirty}
                            disabled={busy || !draft.enabled || draft.intervalHours <= 0}
                            onChange={(e) => patchDraft({ intervalOnlyIfDirty: e.target.checked })}
                          />
                          دوره‌ای فقط در صورت وجود تغییر جدید
                        </label>
                      </div>

                      <div>
                        <label className={fieldLabel}>تعداد نگهداری نسخه خودکار</label>
                        <input
                          type="number"
                          min={3}
                          max={100}
                          className={fieldInput}
                          dir="ltr"
                          disabled={busy || !draft.enabled}
                          value={draft.keepAuto}
                          onChange={(e) =>
                            patchDraft({
                              keepAuto: Math.max(3, Math.min(100, Number(e.target.value) || 20)),
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className={fieldLabel}>تعداد نگهداری نسخه ایمنی</label>
                        <input
                          type="number"
                          min={2}
                          max={50}
                          className={fieldInput}
                          dir="ltr"
                          disabled={busy || !draft.enabled}
                          value={draft.keepSafety}
                          onChange={(e) =>
                            patchDraft({
                              keepSafety: Math.max(2, Math.min(50, Number(e.target.value) || 10)),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="border-t border-[color:var(--line)] pt-4">
                      <Button
                        icon={Check}
                        disabled={busy}
                        onClick={() => void handleSaveAutoSettings()}
                      >
                        ذخیره تنظیمات بکاپ خودکار
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--muted)]">در حال بارگذاری تنظیمات…</p>
                )}
              </div>
            </SettingsPanel>
          </div>
        </div>
      ) : null}

      {/* Demo Data & Reset Section */}
      <div className="grid gap-5 md:grid-cols-2">
        {canDemo ? (
          <SettingsPanel
            title="داده آزمایشی (دمو)"
            description="بارگذاری مجموعه داده نمونه شامل حساب‌های بانکی، سرفصل‌ها، اشخاص و تراکنش‌ها برای آزمایش سریع سامانه"
            icon={Database}
          >
            <div className="flex flex-wrap gap-2.5">
              <Button variant="secondary" icon={Database} disabled={busy} onClick={() => void handleLoadDemo()}>
                بارگذاری داده نمونه
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void handleReset()}>
                بازنشانی به نمونه
              </Button>
            </div>
          </SettingsPanel>
        ) : null}

        {canBackup ? (
          <SettingsPanel
            title="پاک‌سازی کامل داده‌ها"
            description="حذف تمام تراکنش‌ها، اشخاص، بانک‌ها و سرفصل‌های ثبت‌شده (همراه با ذخیره نسخه ایمنی)"
            icon={ShieldAlert}
          >
            <Button variant="danger" icon={ShieldAlert} disabled={busy} onClick={() => void handleClearAll()}>
              پاک کردن همه اطلاعات
            </Button>
          </SettingsPanel>
        ) : null}
      </div>
    </SettingsPageShell>
  );
}
