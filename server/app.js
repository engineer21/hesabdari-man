import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  openDatabase,
  readDomainState,
  writeDomainState,
  clearDomainData,
  getOwner,
  saveOwner,
  hashPassword,
  createSession,
  deleteSession,
  resolveSessionFromToken,
  getMeta,
  setMeta,
  findStaffByUsername,
  APP_NAME,
  DEFAULT_OWNER_PASSWORD,
  DIST_DIR,
  PUBLIC_DIR,
} from './db.js';
import { sessionCan } from './permissions.js';
import { parseUploadRequest, saveDataUrl, resolveUploadPath, readRequestBody } from './uploads.js';
import {
  buildSnapshot,
  createAutoBackup,
  createManualBackup,
  createSafetyBackup,
  scheduleAutoBackup,
  listBackups,
  readBackupById,
  deleteBackupById,
  getBackupDownloadPath,
  getBackupSettings,
  setBackupSettings,
  startBackupSchedulers,
  validateBackupPayload,
  applyRestoredPayload,
} from './backup-service.js';
import { getSmsGatewayStatus, listSmsLogs, dispatchSms } from './sms-service.js';

const PORT = Number(process.env.PORT || 3000);
const db = openDatabase();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

function bearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

function requireSession(req, res) {
  const session = resolveSessionFromToken(db, bearer(req));
  if (!session) {
    json(res, 401, { error: 'UNAUTHORIZED' });
    return null;
  }
  return session;
}

function requirePerm(session, res, perm) {
  if (!sessionCan(session, perm)) {
    json(res, 403, { error: 'FORBIDDEN' });
    return false;
  }
  return true;
}

async function readJson(req, limit = 32 * 1024 * 1024) {
  const ctype = req.headers['content-type'] || '';
  if (!ctype.toLowerCase().includes('application/json')) throw new Error('JSON_REQUIRED');
  const raw = await readRequestBody(req, limit);
  const text = raw.toString('utf8');
  if (!text) return {};
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_JSON');
  return value;
}

function normalizeAttachment(att) {
  if (!att) return undefined;
  const pathVal = att.path || (typeof att.data === 'string' && !att.data.startsWith('data:') ? att.data : null);
  if (!pathVal) return undefined;
  return {
    path: pathVal,
    mimeType: att.mimeType || 'application/octet-stream',
    name: att.name || 'پیوست',
  };
}

function materializeMediaInPayload(payload) {
  const out = structuredClone(payload);

  const maybeUpload = (value, category, name) => {
    if (typeof value !== 'string' || !value) return value || '';
    if (value.startsWith('data:')) {
      return saveDataUrl(value, category, name).path;
    }
    return value;
  };

  if (out.userProfile) {
    out.userProfile.picture = maybeUpload(out.userProfile.picture, 'profiles', 'profile');
  }
  if (out.appSettings) {
    out.appSettings.logo = maybeUpload(out.appSettings.logo, 'logos', 'logo');
  }
  if (Array.isArray(out.contacts)) {
    out.contacts = out.contacts.map((c) => ({
      ...c,
      picture: maybeUpload(c.picture, 'avatars', c.fullName || 'avatar'),
    }));
  }
  if (Array.isArray(out.transactions)) {
    out.transactions = out.transactions.map((t) => {
      const att = t.attachment;
      if (!att) return { ...t, attachment: undefined };
      const dataUrl =
        (att.data && String(att.data).startsWith('data:') && att.data) ||
        (att.dataUrl && String(att.dataUrl).startsWith('data:') && att.dataUrl) ||
        null;
      if (dataUrl) {
        const saved = saveDataUrl(dataUrl, 'attachments', att.name || 'attachment');
        return {
          ...t,
          attachment: { path: saved.path, mimeType: saved.mimeType || att.mimeType, name: att.name || saved.name },
        };
      }
      return { ...t, attachment: normalizeAttachment(att) };
    });
  }
  if (Array.isArray(out.invoices)) {
    out.invoices = out.invoices.map((inv) => {
      const att = inv.attachment;
      if (!att) return { ...inv, attachment: undefined };
      const dataUrl =
        (att.data && String(att.data).startsWith('data:') && att.data) ||
        (att.dataUrl && String(att.dataUrl).startsWith('data:') && att.dataUrl) ||
        null;
      if (dataUrl) {
        const saved = saveDataUrl(dataUrl, 'attachments', att.name || 'invoice');
        return {
          ...inv,
          attachment: { path: saved.path, mimeType: saved.mimeType || att.mimeType, name: att.name || saved.name },
        };
      }
      return { ...inv, attachment: normalizeAttachment(att) };
    });
  }
  return out;
}

function publicState(session) {
  const state = readDomainState(db);
  const { owner, staffUsers, ...rest } = state;
  const isOwner = session?.kind === 'owner';
  return {
    ...rest,
    session,
    // Never expose password hashes to non-owners
    staffUsers: isOwner
      ? staffUsers
      : (staffUsers || []).map(({ hashedPassword: _h, ...u }) => ({ ...u, hashedPassword: '' })),
    ownerPublic: owner
      ? {
          username: owner.username,
          displayName: owner.displayName,
          needsPasswordChange: owner.needsPasswordChange,
        }
      : null,
  };
}

function serveFile(res, absPath, cache = 'no-store') {
  const ext = path.extname(absPath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(absPath);
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': data.length,
  });
  res.end(data);
}

function tryStatic(urlPath, baseDir, res, cache) {
  const rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.includes('..')) return false;
  const abs = path.normalize(path.join(baseDir, rel === '/' ? 'index.html' : rel));
  if (!abs.startsWith(path.normalize(baseDir))) return false;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    serveFile(res, abs, cache);
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const { pathname } = url;

    if (pathname === '/api/health' && req.method === 'GET') {
      return json(res, 200, { status: 'ok', uptime: process.uptime(), app: APP_NAME });
    }

    // Uploaded files
    if (pathname.startsWith('/uploads/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const abs = resolveUploadPath(pathname);
      if (!abs) return json(res, 404, { error: 'NOT_FOUND' });
      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        return res.end();
      }
      return serveFile(res, abs, 'no-store');
    }

    if (pathname.startsWith('/api/')) {
      // --- Auth ---
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await readJson(req, 4096);
        const username = typeof body.username === 'string' ? body.username.trim() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const hash = hashPassword(password);
        const owner = getOwner(db);
        if (owner && owner.username === username && owner.hashedPassword === hash) {
          const token = createSession(db, { kind: 'owner', username: owner.username });
          const full = resolveSessionFromToken(db, token);
          return json(res, 200, { token, session: full });
        }
        const staff = findStaffByUsername(db, username);
        if (staff && staff.hashedPassword === hash) {
          const token = createSession(db, { kind: 'staff', userId: staff.id });
          const full = resolveSessionFromToken(db, token);
          if (!full) return json(res, 401, { error: 'UNAUTHORIZED' });
          return json(res, 200, { token, session: full });
        }
        return json(res, 401, { error: 'INVALID_CREDENTIALS' });
      }

      if (pathname === '/api/auth/default-hint' && req.method === 'GET') {
        const owner = getOwner(db);
        const isDefault = owner && owner.hashedPassword === hashPassword(DEFAULT_OWNER_PASSWORD);
        return json(res, 200, {
          showDefaultHints: Boolean(isDefault),
          defaultUsername: isDefault ? owner.username : null,
        });
      }

      if (pathname === '/api/help/config' && req.method === 'GET') {
        const showHelpOnLogin = getMeta(db, 'help_show_on_login') === '1';
        const token = bearer(req);
        const sessionMaybe = token ? resolveSessionFromToken(db, token) : null;
        if (!sessionMaybe) {
          return json(res, 200, { showHelpOnLogin });
        }
        let seenPages = [];
        try {
          seenPages = JSON.parse(getMeta(db, 'help_seen_pages') || '[]');
          if (!Array.isArray(seenPages)) seenPages = [];
        } catch {
          seenPages = [];
        }
        return json(res, 200, { showHelpOnLogin, seenPages });
      }

      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const token = bearer(req);
        if (token) deleteSession(db, token);
        return json(res, 200, { ok: true });
      }

      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const session = requireSession(req, res);
        if (!session) return;
        return json(res, 200, { session, ...publicState(session) });
      }

      if (pathname === '/api/auth/password' && req.method === 'POST') {
        const session = requireSession(req, res);
        if (!session) return;
        if (!requirePerm(session, res, 'settings.password')) return;
        const body = await readJson(req, 4096);
        const owner = getOwner(db);
        if (!owner) return json(res, 400, { error: 'NO_OWNER' });
        if (hashPassword(body.currentPassword || '') !== owner.hashedPassword) {
          return json(res, 400, { error: 'BAD_CURRENT', message: 'رمز فعلی نادرست است.' });
        }
        const next = String(body.newPassword || '');
        if (next.length < 4) return json(res, 400, { error: 'WEAK', message: 'رمز جدید کوتاه است.' });
        saveOwner(db, {
          ...owner,
          hashedPassword: hashPassword(next),
          needsPasswordChange: false,
        });
        return json(res, 200, { ok: true, message: 'رمز عبور با موفقیت تغییر کرد.' });
      }

      // All other API routes need session
      const session = requireSession(req, res);
      if (!session) return;

      if (pathname === '/api/state' && req.method === 'GET') {
        return json(res, 200, publicState(session));
      }

      if (pathname === '/api/state' && req.method === 'PUT') {
        const body = await readJson(req);
        // Auth tables are owner-only
        if (body.permissionGroups || body.staffUsers || body.owner) {
          if (session.kind !== 'owner') {
            return json(res, 403, { error: 'FORBIDDEN' });
          }
        }
        const materialized = materializeMediaInPayload(body);
        if (materialized.appSettings && !sessionCan(session, 'settings.business')) {
          delete materialized.appSettings;
        }
        // Enforce strict RBAC on all domain mutations so read-only viewers get 403 FORBIDDEN
        const hasDomainMutation =
          Array.isArray(body.accounts) ||
          Array.isArray(body.transactions) ||
          Array.isArray(body.invoices) ||
          Array.isArray(body.payrollContracts) ||
          Array.isArray(body.payrollEntries) ||
          Array.isArray(body.checks) ||
          Array.isArray(body.loans) ||
          Array.isArray(body.loanInstallments) ||
          Array.isArray(body.contacts) ||
          Array.isArray(body.contactGroups) ||
          Array.isArray(body.warehouses) ||
          Array.isArray(body.products) ||
          Boolean(body.reminderSettings);

        if (
          hasDomainMutation &&
          session.kind !== 'owner' &&
          !sessionCan(session, 'journals.edit') &&
          !sessionCan(session, 'journals.create') &&
          !sessionCan(session, 'contacts.edit') &&
          !sessionCan(session, 'settings.accounts')
        ) {
          return json(res, 403, { error: 'FORBIDDEN' });
        }
        if (materialized.reminderSettings && session.kind !== 'owner' && !sessionCan(session, 'settings.business')) {
          delete materialized.reminderSettings;
        }
        writeDomainState(db, materialized, {
          replaceAuth: session.kind === 'owner' && Boolean(body.owner?.hashedPassword),
        });
        scheduleAutoBackup(db);
        return json(res, 200, publicState(session));
      }

      // --- Reminders & SMS Gateway ---
      if (pathname === '/api/reminders/status' && req.method === 'GET') {
        const state = readDomainState(db);
        return json(res, 200, {
          gateway: getSmsGatewayStatus(state.reminderSettings),
          settings: state.reminderSettings,
          logs: listSmsLogs(db, 30),
        });
      }

      if (pathname === '/api/reminders/test-sms' && req.method === 'POST') {
        if (session.kind !== 'owner' && !sessionCan(session, 'settings.business')) {
          return json(res, 403, { error: 'FORBIDDEN' });
        }
        const body = await readJson(req, 8192);
        const state = readDomainState(db);
        const recipient = body.recipient || state.reminderSettings?.recipientMobile || '';
        const message =
          body.message ||
          `پیامک آزمایشی سامانه ${state.appSettings?.name || APP_NAME}: یادآور چک‌ها و اقساط وام فعال است.`;
        try {
          const log = await dispatchSms(db, { recipient, message });
          return json(res, 200, {
            ok: true,
            log,
            gateway: getSmsGatewayStatus(readDomainState(db).reminderSettings),
          });
        } catch (err) {
          return json(res, 400, { error: 'SMS_VALIDATION', message: String(err?.message || err) });
        }
      }

      if (pathname === '/api/reminders/dispatch' && req.method === 'POST') {
        if (session.kind !== 'owner' && !sessionCan(session, 'journals.create') && !sessionCan(session, 'settings.business')) {
          return json(res, 403, { error: 'FORBIDDEN' });
        }
        const body = await readJson(req, 16384);
        const state = readDomainState(db);
        const recipient = body.recipient || state.reminderSettings?.recipientMobile || '';
        const message = String(body.message || '').trim();
        try {
          const log = await dispatchSms(db, { recipient, message });
          return json(res, 200, {
            ok: true,
            log,
            gateway: getSmsGatewayStatus(readDomainState(db).reminderSettings),
          });
        } catch (err) {
          return json(res, 400, { error: 'SMS_VALIDATION', message: String(err?.message || err) });
        }
      }

      if (pathname === '/api/prefs' && req.method === 'PUT') {
        const body = await readJson(req, 4096);
        writeDomainState(db, { prefs: body });
        return json(res, 200, { ok: true, prefs: readDomainState(db).prefs });
      }

      if (pathname === '/api/help/config' && req.method === 'PUT') {
        const body = await readJson(req, 8192);
        if (body.showHelpOnLogin != null) {
          setMeta(db, 'help_show_on_login', body.showHelpOnLogin ? '1' : '0');
        }
        if (Array.isArray(body.seenPages)) {
          const cleaned = [...new Set(body.seenPages.map(String))].slice(0, 200);
          setMeta(db, 'help_seen_pages', JSON.stringify(cleaned));
        }
        let seenPages = [];
        try {
          seenPages = JSON.parse(getMeta(db, 'help_seen_pages') || '[]');
        } catch {
          seenPages = [];
        }
        return json(res, 200, {
          showHelpOnLogin: getMeta(db, 'help_show_on_login') === '1',
          seenPages: Array.isArray(seenPages) ? seenPages : [],
        });
      }

      if (pathname === '/api/uploads' && req.method === 'POST') {
        try {
          const saved = await parseUploadRequest(req);
          return json(res, 201, saved);
        } catch (e) {
          const code = e.message || 'UPLOAD_FAILED';
          const status = code === 'TOO_LARGE' ? 413 : 400;
          return json(res, status, { error: code });
        }
      }

      if (pathname === '/api/demo/load' && req.method === 'POST') {
        if (!requirePerm(session, res, 'settings.demo')) return;
        createSafetyBackup(db, 'before-demo');
        const body = await readJson(req);
        const materialized = materializeMediaInPayload(body);
        writeDomainState(db, {
          accounts: materialized.accounts,
          contactGroups: materialized.contactGroups,
          contacts: materialized.contacts,
          warehouses: materialized.warehouses,
          products: materialized.products,
          transactions: materialized.transactions,
          invoices: materialized.invoices || [],
          payrollContracts: materialized.payrollContracts || [],
          payrollEntries: materialized.payrollEntries || [],
          checks: materialized.checks || [],
          loans: materialized.loans || [],
          loanInstallments: materialized.loanInstallments || [],
          userProfile: materialized.userProfile,
          appSettings: materialized.appSettings,
        });
        scheduleAutoBackup(db);
        return json(res, 200, publicState(session));
      }

      if (pathname === '/api/data/clear' && req.method === 'POST') {
        if (!requirePerm(session, res, 'settings.backup')) return;
        createSafetyBackup(db, 'before-clear');
        clearDomainData(db);
        scheduleAutoBackup(db);
        return json(res, 200, publicState(session));
      }

      if (pathname === '/api/backup' && req.method === 'GET') {
        if (!requirePerm(session, res, 'settings.backup')) return;
        return json(res, 200, buildSnapshot(db));
      }

      if (pathname === '/api/restore' && req.method === 'POST') {
        if (!requirePerm(session, res, 'settings.backup')) return;
        const body = await readJson(req);
        const check = validateBackupPayload(body);
        if (!check.ok) return json(res, 400, { error: check.error, message: check.message });
        createSafetyBackup(db, 'before-restore');
        const materialized = materializeMediaInPayload(body);
        applyRestoredPayload(db, materialized, {
          replaceAuth: session.kind === 'owner' && Boolean(materialized.owner?.hashedPassword),
        });
        scheduleAutoBackup(db);
        return json(res, 200, publicState(session));
      }

      // --- Server backup vault ---
      if (pathname === '/api/backups' && req.method === 'GET') {
        if (!requirePerm(session, res, 'settings.backup')) return;
        return json(res, 200, {
          items: listBackups(),
          settings: getBackupSettings(db),
        });
      }

      if (pathname === '/api/backups' && req.method === 'POST') {
        if (!requirePerm(session, res, 'settings.backup')) return;
        let body = {};
        try {
          body = await readJson(req, 4096);
        } catch {
          body = {};
        }
        const meta = createManualBackup(db, body?.label || '');
        return json(res, 201, { ok: true, backup: meta });
      }

      if (pathname === '/api/backups/settings' && req.method === 'GET') {
        if (!requirePerm(session, res, 'settings.backup')) return;
        return json(res, 200, getBackupSettings(db));
      }

      if (pathname === '/api/backups/settings' && req.method === 'PUT') {
        if (!requirePerm(session, res, 'settings.backup')) return;
        const body = await readJson(req, 4096);
        return json(res, 200, setBackupSettings(db, body));
      }

      if (pathname === '/api/backups/auto-now' && req.method === 'POST') {
        if (!requirePerm(session, res, 'settings.backup')) return;
        const meta = createAutoBackup(db, { force: true });
        return json(res, 201, { ok: true, backup: meta });
      }

      const backupMatch = /^\/api\/backups\/([^/]+)(?:\/(restore|download))?$/.exec(pathname);
      if (backupMatch) {
        if (!requirePerm(session, res, 'settings.backup')) return;
        const id = decodeURIComponent(backupMatch[1]);
        const action = backupMatch[2];

        if (req.method === 'DELETE' && !action) {
          const ok = deleteBackupById(id);
          if (!ok) return json(res, 404, { error: 'NOT_FOUND' });
          return json(res, 200, { ok: true });
        }

        if (req.method === 'POST' && action === 'restore') {
          const payload = readBackupById(id);
          if (!payload) return json(res, 404, { error: 'NOT_FOUND' });
          createSafetyBackup(db, `before-restore-${id}`);
          const materialized = materializeMediaInPayload(payload);
          applyRestoredPayload(db, materialized, {
            replaceAuth: session.kind === 'owner' && Boolean(materialized.owner?.hashedPassword),
          });
          scheduleAutoBackup(db);
          return json(res, 200, publicState(session));
        }

        if (req.method === 'GET' && action === 'download') {
          const abs = getBackupDownloadPath(id);
          if (!abs) return json(res, 404, { error: 'NOT_FOUND' });
          const data = fs.readFileSync(abs);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${path.basename(abs)}"`,
            'Cache-Control': 'no-store',
            'Content-Length': data.length,
          });
          return res.end(data);
        }
      }

      if (pathname === '/api/migrate/from-browser' && req.method === 'POST') {
        if (session.kind !== 'owner') return json(res, 403, { error: 'FORBIDDEN' });
        const body = await readJson(req);
        if (getMeta(db, 'migrated_from_ls') === '1' && !body.force) {
          return json(res, 409, { error: 'ALREADY_MIGRATED' });
        }
        const materialized = materializeMediaInPayload(body);
        // Prefer keeping current server owner password unless LS snapshot has a real hash
        if (!materialized.owner?.hashedPassword) delete materialized.owner;
        createSafetyBackup(db, 'before-migrate');
        writeDomainState(db, materialized, {
          replaceAuth: Boolean(materialized.owner?.hashedPassword),
        });
        setMeta(db, 'migrated_from_ls', '1');
        createAutoBackup(db, { force: true });
        return json(res, 200, { ok: true, ...publicState(session) });
      }

      if (pathname === '/api/migrate/status' && req.method === 'GET') {
        return json(res, 200, {
          migratedFromLs: getMeta(db, 'migrated_from_ls') === '1',
          hasAccounts: readDomainState(db).accounts.length > 0,
        });
      }

      return json(res, 404, { error: 'NOT_FOUND' });
    }

    // Public demo assets & SPA
    if (pathname.startsWith('/demo/') || pathname.startsWith('/assets/') || pathname === '/icon.svg') {
      if (tryStatic(pathname, PUBLIC_DIR, res, 'public, max-age=3600')) return;
      if (tryStatic(pathname, DIST_DIR, res, 'public, max-age=3600')) return;
    }

    if (fs.existsSync(DIST_DIR)) {
      if (tryStatic(pathname, DIST_DIR, res, pathname.startsWith('/assets/') ? 'public, max-age=31536000' : 'no-store')) {
        return;
      }
      const index = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(index) && (req.method === 'GET' || req.method === 'HEAD')) {
        return serveFile(res, index, 'no-store');
      }
    }

    // Dev: serve public when dist missing
    if (tryStatic(pathname, PUBLIC_DIR, res, 'no-store')) return;

    json(res, 404, { error: 'NOT_FOUND' });
  } catch (e) {
    console.error(e);
    if (e.message === 'TOO_LARGE') return json(res, 413, { error: 'TOO_LARGE' });
    if (e.message === 'JSON_REQUIRED' || e.message === 'INVALID_JSON') {
      return json(res, 400, { error: e.message });
    }
    json(res, 500, { error: 'SERVER_ERROR', message: String(e.message || e) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Accounting API listening on http://0.0.0.0:${PORT}`);
  try {
    startBackupSchedulers(db);
    const settings = getBackupSettings(db);
    if (settings.enabled && !settings.lastAutoAt) {
      createAutoBackup(db, { force: true, reason: 'startup' });
      console.log('[backup] initial auto snapshot created');
    }
  } catch (e) {
    console.error('[backup] startup snapshot failed', e);
  }
});
