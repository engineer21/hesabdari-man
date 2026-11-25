import { randomUUID } from 'node:crypto';

/**
 * Server-side Iranian SMS gateway adapter.
 * Credentials are read strictly from server process.env (never exposed to browser).
 * Supported providers: kavenegar | melipayamak | farazsms.
 * When unconfigured (no SMS_PROVIDER / SMS_API_KEY), logs a clean dry_run record in SQLite.
 */

const VALID_PROVIDERS = new Set(['kavenegar', 'melipayamak', 'farazsms']);

export function getSmsGatewayStatus(reminderSettings = {}) {
  const savedProvider = String(reminderSettings?.smsProvider || '').trim().toLowerCase();
  const envProvider = String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
  const providerRaw = VALID_PROVIDERS.has(savedProvider)
    ? savedProvider
    : VALID_PROVIDERS.has(envProvider)
      ? envProvider
      : 'mock';
  const apiKey = String(process.env.SMS_API_KEY || '').trim();
  const sender = String(reminderSettings?.smsSender || process.env.SMS_SENDER || '').trim();
  const template = String(reminderSettings?.smsTemplate || process.env.SMS_TEMPLATE || '').trim();
  const configured = VALID_PROVIDERS.has(providerRaw) && apiKey.length > 0;
  return {
    configured,
    selectedProvider: providerRaw,
    provider: configured ? providerRaw : 'mock',
    providerLabel:
      providerRaw === 'kavenegar'
        ? 'کاوه‌نگار (Kavenegar)'
        : providerRaw === 'melipayamak'
          ? 'ملی‌پیامک (Melipayamak)'
          : providerRaw === 'farazsms'
            ? 'فراز اس‌ام‌اس (FarazSMS)'
            : 'حالت آزمایشی (درون‌برنامه)',
    hasSender: sender.length > 0,
    sender,
    template,
  };
}

function normalizeIranMobile(raw) {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const digits = String(raw || '')
    .replace(/[۰-۹]/g, (w) => String(persian.indexOf(w)))
    .replace(/[٠-٩]/g, (w) => String(arabic.indexOf(w)))
    .replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
}

export function isValidIranMobile(raw) {
  const n = normalizeIranMobile(raw);
  return /^09\d{9}$/.test(n);
}

export function recordSmsLog(db, entry) {
  const id = `sms_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO sms_logs (id, created_at, recipient, message, provider, status, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    createdAt,
    entry.recipient,
    entry.message,
    entry.provider,
    entry.status,
    entry.detail || null
  );
  return { id, createdAt, ...entry };
}

export function listSmsLogs(db, limit = 30) {
  return db
    .prepare('SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(100, Number(limit) || 30)))
    .map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      recipient: r.recipient,
      message: r.message,
      provider: r.provider,
      status: r.status,
      ...(r.detail ? { detail: r.detail } : {}),
    }));
}

export async function dispatchSms(db, { recipient, message }) {
  const normalized = normalizeIranMobile(recipient);
  if (!isValidIranMobile(normalized)) {
    throw new Error('شماره موبایل گیرنده معتبر نیست (با ۰۹ شروع و ۱۱ رقم باشد).');
  }
  const cleanMessage = String(message || '').trim().slice(0, 600);
  if (!cleanMessage) {
    throw new Error('متن پیامک نمی‌تواند خالی باشد.');
  }

  let savedSettings = {};
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'reminder_settings'").get();
    if (row?.value) savedSettings = JSON.parse(row.value);
  } catch {
    /* ignore */
  }

  const gw = getSmsGatewayStatus(savedSettings);
  const apiKey = String(process.env.SMS_API_KEY || '').trim();
  const sender = gw.sender;

  if (!gw.configured) {
    return recordSmsLog(db, {
      recipient: normalized,
      message: cleanMessage,
      provider: gw.selectedProvider && gw.selectedProvider !== 'mock' ? gw.selectedProvider : 'dry_run',
      status: 'dry_run',
      detail: `پیامک یادآوری (${gw.providerLabel}${sender ? ` — خط ${sender}` : ''}) با موفقیت در تاریخچه سامانه ثبت شد.`,
    });
  }

  try {
    let ok = false;
    let detail = '';

    if (gw.provider === 'kavenegar') {
      const params = new URLSearchParams({
        receptor: normalized,
        message: cleanMessage,
        ...(sender ? { sender } : {}),
      });
      const resp = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/sms/send.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const body = await resp.json().catch(() => ({}));
      ok = resp.ok && body?.return?.status === 200;
      detail = body?.return?.message || `HTTP ${resp.status}`;
    } else if (gw.provider === 'melipayamak') {
      const resp = await fetch('https://console.melipayamak.com/api/send/simple/' + encodeURIComponent(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: sender, to: normalized, text: cleanMessage }),
      });
      const body = await resp.json().catch(() => ({}));
      ok = resp.ok && Boolean(body?.recId);
      detail = body?.status || `HTTP ${resp.status}`;
    } else if (gw.provider === 'farazsms') {
      const resp = await fetch('https://api2.ippanel.com/api/v1/sms/send/webservice/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          recipient: [normalized],
          sender,
          message: cleanMessage,
        }),
      });
      const body = await resp.json().catch(() => ({}));
      ok = resp.ok && body?.status === 'OK';
      detail = body?.error_message || body?.status || `HTTP ${resp.status}`;
    }

    return recordSmsLog(db, {
      recipient: normalized,
      message: cleanMessage,
      provider: gw.provider,
      status: ok ? 'sent' : 'failed',
      detail,
    });
  } catch (e) {
    return recordSmsLog(db, {
      recipient: normalized,
      message: cleanMessage,
      provider: gw.provider,
      status: 'failed',
      detail: String(e?.message || 'خطای اتصال به درگاه پیامک'),
    });
  }
}
