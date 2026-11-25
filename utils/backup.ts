import { apiJson, apiRequest, getAuthToken } from './api';

export type ServerBackupMeta = {
  id: string;
  kind: 'auto' | 'manual' | 'safety' | string;
  fileName: string;
  createdAt: string;
  size: number;
  accounts?: number;
  transactions?: number;
  contacts?: number;
  label?: string;
  reason?: string;
};

export type OnChangeBackupMode = 'off' | 'immediate' | 'debounced';

export type BackupSettings = {
  enabled: boolean;
  /** How to backup after data changes */
  onChangeMode: OnChangeBackupMode;
  /** Delay after last change (debounced mode), ms */
  debounceMs: number;
  /** Min gap between change-triggered backups, ms */
  minIntervalMs: number;
  /** Periodic backup every N hours (0 = off) */
  intervalHours: number;
  /** Periodic only if something changed since last auto */
  intervalOnlyIfDirty: boolean;
  keepAuto: number;
  keepSafety: number;
  keepManual: number;
  lastAutoAt: string | null;
  dirtySinceBackup?: boolean;
};

export type BackupSettingsPatch = Partial<BackupSettings> & {
  debounceSeconds?: number;
  minIntervalMinutes?: number;
};

/** Trigger browser download of a JSON object */
export function createBackupFile(allData: any, filename?: string) {
  const payload = {
    ...allData,
    version: allData.version ?? 6,
    format: allData.format || 'farzad-accounting-backup',
    exportedAt: allData.exportedAt ?? new Date().toISOString(),
    app: allData.app || 'حسابداری من',
  };
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = filename || `accounting-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadServerBackup() {
  const data = await apiRequest('/api/backup', { method: 'GET' });
  createBackupFile(data);
}

export async function restoreToServer(payload: unknown): Promise<any> {
  return apiJson('/api/restore', 'POST', payload);
}

export function restoreFromBackup(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(String(event.target?.result || ''));
        if (!data || typeof data !== 'object') {
          reject(new Error('فایل پشتیبان نامعتبر است.'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('فایل پشتیبان نامعتبر است.'));
      }
    };
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود.'));
    reader.readAsText(file);
  });
}

export async function listServerBackups(): Promise<{
  items: ServerBackupMeta[];
  settings: BackupSettings;
}> {
  return apiJson('/api/backups', 'GET');
}

export async function createServerManualBackup(label?: string) {
  return apiJson<{ ok: boolean; backup: ServerBackupMeta }>('/api/backups', 'POST', {
    label: label || '',
  });
}

export async function createServerAutoBackupNow() {
  return apiJson<{ ok: boolean; backup: ServerBackupMeta }>('/api/backups/auto-now', 'POST', {});
}

export async function updateBackupSettings(patch: BackupSettingsPatch) {
  return apiJson<BackupSettings>('/api/backups/settings', 'PUT', patch);
}

export function onChangeModeLabel(mode: OnChangeBackupMode | string): string {
  if (mode === 'off') return 'فقط زمان‌بندی دوره‌ای (بدون بکاپ با تغییر)';
  if (mode === 'immediate') return 'سریع بعد از هر تغییر';
  return 'با تأخیر بعد از آخرین تغییر';
}

export async function restoreServerBackupById(id: string): Promise<any> {
  return apiJson(`/api/backups/${encodeURIComponent(id)}/restore`, 'POST', {});
}

export async function deleteServerBackup(id: string) {
  return apiJson(`/api/backups/${encodeURIComponent(id)}`, 'DELETE');
}

export async function downloadServerBackupById(id: string, fileName?: string) {
  const token = getAuthToken();
  const res = await fetch(`/api/backups/${encodeURIComponent(id)}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('دانلود پشتیبان ناموفق بود.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `${id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function kindLabel(kind: string): string {
  if (kind === 'auto') return 'خودکار';
  if (kind === 'manual') return 'دستی';
  if (kind === 'safety') return 'ایمنی';
  return kind;
}

export function formatBackupSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
