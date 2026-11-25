import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  APP_NAME,
  readDomainState,
  writeDomainState,
  getMeta,
  setMeta,
} from './db.js';

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(ROOT, 'backups');
const AUTO_DIR = path.join(BACKUP_DIR, 'auto');
const MANUAL_DIR = path.join(BACKUP_DIR, 'manual');
const SAFETY_DIR = path.join(BACKUP_DIR, 'safety');

/** @typedef {'off' | 'immediate' | 'debounced'} OnChangeMode */

const DEFAULTS = {
  enabled: true,
  /** How change-triggered backups work */
  onChangeMode: /** @type {OnChangeMode} */ ('debounced'),
  /** Wait after last change (debounced mode) */
  debounceMs: 45_000,
  /** Immediate mode uses a short settle delay */
  immediateSettleMs: 3_000,
  /** Minimum gap between two change-triggered autos */
  minIntervalMs: 60_000,
  /** Periodic backup every N hours (0 = disabled) */
  intervalHours: 6,
  /** Periodic only if data changed since last auto */
  intervalOnlyIfDirty: true,
  keepAuto: 20,
  keepSafety: 10,
  keepManual: 30,
};

fs.mkdirSync(AUTO_DIR, { recursive: true });
fs.mkdirSync(MANUAL_DIR, { recursive: true });
fs.mkdirSync(SAFETY_DIR, { recursive: true });

let debounceTimer = null;
let intervalTimer = null;
let lastAutoAtMs = 0;
let dirtySinceBackup = false;
/** @type {import('node:sqlite').DatabaseSync | null} */
let scheduledDb = null;

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function clamp(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function buildSnapshot(db) {
  const state = readDomainState(db);
  return {
    version: 8,
    format: 'farzad-accounting-backup',
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    accounts: state.accounts,
    warehouses: state.warehouses,
    products: state.products,
    transactions: state.transactions,
    invoices: state.invoices,
    payrollContracts: state.payrollContracts,
    payrollEntries: state.payrollEntries,
    checks: state.checks,
    loans: state.loans,
    loanInstallments: state.loanInstallments,
    reminderSettings: state.reminderSettings,
    contactGroups: state.contactGroups,
    contacts: state.contacts,
    userProfile: state.userProfile,
    appSettings: state.appSettings,
    owner: state.owner,
    permissionGroups: state.permissionGroups,
    staffUsers: state.staffUsers,
    prefs: state.prefs,
  };
}

export function validateBackupPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'INVALID_BACKUP', message: 'فایل پشتیبان نامعتبر است.' };
  }
  const hasAny =
    Array.isArray(body.accounts) ||
    Array.isArray(body.transactions) ||
    Array.isArray(body.invoices) ||
    Array.isArray(body.payrollContracts) ||
    Array.isArray(body.payrollEntries) ||
    Array.isArray(body.checks) ||
    Array.isArray(body.loans) ||
    Array.isArray(body.contacts) ||
    Array.isArray(body.contactGroups) ||
    Array.isArray(body.warehouses) ||
    Array.isArray(body.products) ||
    body.userProfile ||
    body.appSettings;
  if (!hasAny) {
    return { ok: false, error: 'EMPTY_BACKUP', message: 'پشتیبان هیچ داده‌ای ندارد.' };
  }
  if (body.format && body.format !== 'farzad-accounting-backup' && body.app == null) {
    return { ok: false, error: 'UNKNOWN_FORMAT', message: 'فرمت پشتیبان شناخته نشد.' };
  }
  return { ok: true };
}

function writeJsonBackup(dir, kind, snapshot) {
  const id = `${kind}-${stamp()}`;
  const fileName = `${id}.json`;
  const abs = path.join(dir, fileName);
  fs.writeFileSync(abs, JSON.stringify(snapshot, null, 2), 'utf8');
  const meta = {
    id,
    kind,
    fileName,
    createdAt: snapshot.exportedAt,
    size: fs.statSync(abs).size,
    accounts: Array.isArray(snapshot.accounts) ? snapshot.accounts.length : 0,
    transactions: Array.isArray(snapshot.transactions) ? snapshot.transactions.length : 0,
    contacts: Array.isArray(snapshot.contacts) ? snapshot.contacts.length : 0,
    invoices: Array.isArray(snapshot.invoices) ? snapshot.invoices.length : 0,
    checks: Array.isArray(snapshot.checks) ? snapshot.checks.length : 0,
    loans: Array.isArray(snapshot.loans) ? snapshot.loans.length : 0,
  };
  fs.writeFileSync(path.join(dir, `${id}.meta.json`), JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

function listDirBackups(dir, kind) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.meta.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((m) => ({ ...m, kind: m.kind || kind }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function prune(dir, keep) {
  const items = listDirBackups(dir, 'auto');
  for (const old of items.slice(Math.max(0, keep))) {
    try {
      fs.unlinkSync(path.join(dir, `${old.id}.json`));
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(path.join(dir, `${old.id}.meta.json`));
    } catch {
      /* ignore */
    }
  }
}

function resolveBackupFile(id) {
  if (!id || /[\\/]/.test(id) || id.includes('..')) return null;
  for (const dir of [AUTO_DIR, MANUAL_DIR, SAFETY_DIR]) {
    const jsonPath = path.join(dir, `${id}.json`);
    const metaPath = path.join(dir, `${id}.meta.json`);
    if (fs.existsSync(jsonPath) && fs.existsSync(metaPath)) {
      return { jsonPath, metaPath, dir };
    }
  }
  return null;
}

function parseOnChangeMode(raw) {
  if (raw === 'off' || raw === 'immediate' || raw === 'debounced') return raw;
  return DEFAULTS.onChangeMode;
}

export function getBackupSettings(db) {
  const lastIso = getMeta(db, 'backup_last_auto_at');
  if (lastIso && !lastAutoAtMs) {
    const t = Date.parse(lastIso);
    if (Number.isFinite(t)) lastAutoAtMs = t;
  }
  return {
    enabled: getMeta(db, 'backup_auto_enabled') !== '0',
    onChangeMode: parseOnChangeMode(getMeta(db, 'backup_onchange_mode')),
    debounceMs: Number(getMeta(db, 'backup_debounce_ms') || DEFAULTS.debounceMs),
    minIntervalMs: Number(getMeta(db, 'backup_min_interval_ms') || DEFAULTS.minIntervalMs),
    intervalHours: Number(getMeta(db, 'backup_interval_hours') ?? DEFAULTS.intervalHours),
    intervalOnlyIfDirty: getMeta(db, 'backup_interval_only_dirty') !== '0',
    keepAuto: Number(getMeta(db, 'backup_keep_auto') || DEFAULTS.keepAuto),
    keepSafety: Number(getMeta(db, 'backup_keep_safety') || DEFAULTS.keepSafety),
    keepManual: Number(getMeta(db, 'backup_keep_manual') || DEFAULTS.keepManual),
    lastAutoAt: lastIso || null,
    dirtySinceBackup,
  };
}

export function setBackupSettings(db, patch = {}) {
  if (patch.enabled != null) setMeta(db, 'backup_auto_enabled', patch.enabled ? '1' : '0');

  if (patch.onChangeMode != null) {
    setMeta(db, 'backup_onchange_mode', parseOnChangeMode(patch.onChangeMode));
  }

  if (patch.debounceMs != null) {
    // 10s … 30min
    const n = clamp(patch.debounceMs, 10_000, 1_800_000, DEFAULTS.debounceMs);
    setMeta(db, 'backup_debounce_ms', String(n));
  }
  // UI may send seconds
  if (patch.debounceSeconds != null) {
    const n = clamp(Number(patch.debounceSeconds) * 1000, 10_000, 1_800_000, DEFAULTS.debounceMs);
    setMeta(db, 'backup_debounce_ms', String(n));
  }

  if (patch.minIntervalMs != null) {
    // 30s … 6h
    const n = clamp(patch.minIntervalMs, 30_000, 21_600_000, DEFAULTS.minIntervalMs);
    setMeta(db, 'backup_min_interval_ms', String(n));
  }
  if (patch.minIntervalMinutes != null) {
    const n = clamp(Number(patch.minIntervalMinutes) * 60_000, 30_000, 21_600_000, DEFAULTS.minIntervalMs);
    setMeta(db, 'backup_min_interval_ms', String(n));
  }

  if (patch.intervalHours != null) {
    // 0 = off, max 168h (7 days)
    const n = clamp(patch.intervalHours, 0, 168, DEFAULTS.intervalHours);
    setMeta(db, 'backup_interval_hours', String(n));
  }

  if (patch.intervalOnlyIfDirty != null) {
    setMeta(db, 'backup_interval_only_dirty', patch.intervalOnlyIfDirty ? '1' : '0');
  }

  if (patch.keepAuto != null) {
    setMeta(db, 'backup_keep_auto', String(clamp(patch.keepAuto, 3, 100, DEFAULTS.keepAuto)));
  }
  if (patch.keepSafety != null) {
    setMeta(db, 'backup_keep_safety', String(clamp(patch.keepSafety, 2, 50, DEFAULTS.keepSafety)));
  }
  if (patch.keepManual != null) {
    setMeta(db, 'backup_keep_manual', String(clamp(patch.keepManual, 5, 100, DEFAULTS.keepManual)));
  }

  return getBackupSettings(db);
}

export function createManualBackup(db, label = '') {
  const snapshot = buildSnapshot(db);
  if (label) snapshot.label = String(label).slice(0, 120);
  const meta = writeJsonBackup(MANUAL_DIR, 'manual', snapshot);
  const settings = getBackupSettings(db);
  prune(MANUAL_DIR, settings.keepManual);
  return meta;
}

export function createSafetyBackup(db, reason = 'safety') {
  const snapshot = buildSnapshot(db);
  snapshot.reason = reason;
  const meta = writeJsonBackup(SAFETY_DIR, 'safety', snapshot);
  const settings = getBackupSettings(db);
  prune(SAFETY_DIR, settings.keepSafety);
  return meta;
}

export function createAutoBackup(db, { force = false, reason = 'auto' } = {}) {
  const settings = getBackupSettings(db);
  if (!settings.enabled && !force) return null;
  const snapshot = buildSnapshot(db);
  snapshot.reason = reason;
  const meta = writeJsonBackup(AUTO_DIR, 'auto', snapshot);
  setMeta(db, 'backup_last_auto_at', snapshot.exportedAt);
  lastAutoAtMs = Date.now();
  dirtySinceBackup = false;
  prune(AUTO_DIR, settings.keepAuto);
  return meta;
}

function delayForOnChange(settings) {
  if (settings.onChangeMode === 'immediate') {
    return DEFAULTS.immediateSettleMs;
  }
  return settings.debounceMs;
}

/**
 * After domain mutations — respects onChangeMode, debounce, and min interval.
 */
export function scheduleAutoBackup(db) {
  dirtySinceBackup = true;
  const settings = getBackupSettings(db);
  if (!settings.enabled) return;
  if (settings.onChangeMode === 'off') return;

  if (debounceTimer) clearTimeout(debounceTimer);

  const settle = delayForOnChange(settings);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    try {
      const now = Date.now();
      const since = now - lastAutoAtMs;
      if (lastAutoAtMs && since < settings.minIntervalMs) {
        // Too soon — retry when min interval elapses
        const wait = settings.minIntervalMs - since + 50;
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          try {
            if (dirtySinceBackup) createAutoBackup(db, { reason: 'onchange' });
          } catch (e) {
            console.error('[auto-backup]', e);
          }
        }, wait);
        return;
      }
      createAutoBackup(db, { reason: 'onchange' });
    } catch (e) {
      console.error('[auto-backup]', e);
    }
  }, settle);
}

function tickPeriodic() {
  if (!scheduledDb) return;
  try {
    const settings = getBackupSettings(scheduledDb);
    if (!settings.enabled) return;
    if (!settings.intervalHours || settings.intervalHours <= 0) return;
    if (settings.intervalOnlyIfDirty && !dirtySinceBackup) return;

    const intervalMs = settings.intervalHours * 3600_000;
    const now = Date.now();
    if (lastAutoAtMs && now - lastAutoAtMs < intervalMs) return;

    createAutoBackup(scheduledDb, { force: false, reason: 'interval' });
  } catch (e) {
    console.error('[auto-backup:interval]', e);
  }
}

/** Call once after server starts */
export function startBackupSchedulers(db) {
  scheduledDb = db;
  if (intervalTimer) clearInterval(intervalTimer);
  // Check every minute
  intervalTimer = setInterval(tickPeriodic, 60_000);
  // Soft tick soon after boot
  setTimeout(tickPeriodic, 15_000);
}

export function listBackups() {
  return [
    ...listDirBackups(MANUAL_DIR, 'manual'),
    ...listDirBackups(AUTO_DIR, 'auto'),
    ...listDirBackups(SAFETY_DIR, 'safety'),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function readBackupById(id) {
  const found = resolveBackupFile(id);
  if (!found) return null;
  const raw = fs.readFileSync(found.jsonPath, 'utf8');
  return JSON.parse(raw);
}

export function deleteBackupById(id) {
  const found = resolveBackupFile(id);
  if (!found) return false;
  try {
    fs.unlinkSync(found.jsonPath);
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(found.metaPath);
  } catch {
    /* ignore */
  }
  return true;
}

export function getBackupDownloadPath(id) {
  const found = resolveBackupFile(id);
  return found?.jsonPath || null;
}

export function applyRestoredPayload(db, body, { replaceAuth = true } = {}) {
  const check = validateBackupPayload(body);
  if (!check.ok) throw Object.assign(new Error(check.message), { code: check.error });
  writeDomainState(db, body, { replaceAuth });
}

export { buildSnapshot };
