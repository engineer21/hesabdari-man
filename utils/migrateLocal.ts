import { STORAGE_KEYS } from '../constants';
import { apiJson } from './api';
import { normalizeAttachment } from './attachments';

const LS_KEYS = Object.values(STORAGE_KEYS);

function readLsJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Keep data: URLs so the server can materialize them into /uploads; keep path-based as-is. */
function prepareAttachmentForMigrate(att: any) {
  if (!att) return undefined;
  const dataUrl =
    (typeof att.data === 'string' && att.data.startsWith('data:') && att.data) ||
    (typeof att.dataUrl === 'string' && att.dataUrl.startsWith('data:') && att.dataUrl) ||
    null;
  if (dataUrl) {
    return {
      data: dataUrl,
      mimeType: att.mimeType || 'application/octet-stream',
      name: att.name || 'پیوست',
    };
  }
  return normalizeAttachment(att);
}

export function hasLegacyLocalData(): boolean {
  try {
    return LS_KEYS.some((k) => {
      const v = localStorage.getItem(k);
      return Boolean(v && v !== 'null' && v !== '[]' && v !== '{}' && v !== '""');
    });
  } catch {
    return false;
  }
}

export function collectLegacySnapshot() {
  const accounts = readLsJson(STORAGE_KEYS.accounts, []);
  const transactions = readLsJson(STORAGE_KEYS.transactions, []).map((t: any) => ({
    ...t,
    attachment: prepareAttachmentForMigrate(t.attachment),
  }));
  const contactGroups = readLsJson(STORAGE_KEYS.contactGroups, []);
  const contacts = readLsJson(STORAGE_KEYS.contacts, []);
  const userProfile = readLsJson(STORAGE_KEYS.profile, null);
  const appSettings = readLsJson(STORAGE_KEYS.settings, null);
  const owner = readLsJson(STORAGE_KEYS.owner, null);
  const permissionGroups = readLsJson(STORAGE_KEYS.permissionGroups, null);
  const staffUsers = readLsJson(STORAGE_KEYS.staffUsers, null);

  let themeVal = 'light';
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.theme);
    if (raw) {
      const cleaned = raw.replace(/^"|"$/g, '');
      if (cleaned === 'dark' || cleaned === 'light') themeVal = cleaned;
    }
  } catch {
    /* ignore */
  }

  return {
    version: 6,
    accounts,
    transactions,
    contactGroups,
    contacts,
    userProfile,
    appSettings,
    owner: owner?.hashedPassword ? owner : null,
    permissionGroups: Array.isArray(permissionGroups) ? permissionGroups : null,
    staffUsers: Array.isArray(staffUsers) ? staffUsers : null,
    prefs: {
      theme: themeVal,
      sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === '1',
    },
  };
}

export async function clearLegacyBrowserStorage() {
  try {
    for (const k of LS_KEYS) localStorage.removeItem(k);
    localStorage.removeItem('farzad_v2_pdf_page_size');
    localStorage.removeItem('farzad_v2_search_recent');
  } catch {
    /* ignore */
  }

  try {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('WalletAutoBackupDB');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  } catch {
    /* ignore */
  }

  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
  }
}

export async function migrateLegacyIfNeeded(): Promise<'migrated' | 'skipped' | 'none'> {
  if (!hasLegacyLocalData()) return 'none';

  try {
    const status = await apiJson<{ migratedFromLs: boolean }>('/api/migrate/status', 'GET');
    if (status.migratedFromLs) {
      await clearLegacyBrowserStorage();
      return 'skipped';
    }
  } catch {
    /* continue — try migrate anyway after login */
  }

  const snapshot = collectLegacySnapshot();
  const hasDomain =
    (Array.isArray(snapshot.accounts) && snapshot.accounts.length > 0) ||
    (Array.isArray(snapshot.transactions) && snapshot.transactions.length > 0) ||
    (Array.isArray(snapshot.contacts) && snapshot.contacts.length > 0) ||
    Boolean(snapshot.owner);

  if (!hasDomain) {
    await clearLegacyBrowserStorage();
    return 'none';
  }

  // Drop null auth fields so server keeps its seeded owner/groups when LS had none
  const payload: Record<string, unknown> = { ...snapshot };
  if (!payload.owner) delete payload.owner;
  if (!payload.permissionGroups) delete payload.permissionGroups;
  if (!payload.staffUsers) delete payload.staffUsers;

  await apiJson('/api/migrate/from-browser', 'POST', payload);
  await clearLegacyBrowserStorage();
  return 'migrated';
}
