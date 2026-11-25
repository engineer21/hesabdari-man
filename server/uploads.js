import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { UPLOAD_DIR } from './db.js';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

const CATEGORIES = new Set(['logos', 'avatars', 'attachments', 'profiles', 'misc']);

function parseMultipart(buffer, boundary) {
  const parts = [];
  const sep = Buffer.from(`--${boundary}`);
  let start = buffer.indexOf(sep) + sep.length;
  while (start < buffer.length) {
    if (buffer[start] === 45 && buffer[start + 1] === 45) break; // --
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;
    const next = buffer.indexOf(sep, start);
    if (next < 0) break;
    let part = buffer.subarray(start, next);
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd >= 0) {
      const header = part.subarray(0, headerEnd).toString('utf8');
      const body = part.subarray(headerEnd + 4);
      const nameMatch = /name="([^"]+)"/i.exec(header);
      const fileMatch = /filename="([^"]*)"/i.exec(header);
      const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(header);
      parts.push({
        name: nameMatch?.[1] || '',
        filename: fileMatch?.[1] || '',
        mimeType: (typeMatch?.[1] || '').trim(),
        data: body,
      });
    }
    start = next + sep.length;
  }
  return parts;
}

export async function readRequestBody(req, limit = MAX_UPLOAD_BYTES + 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function parseUploadRequest(req) {
  const ctype = req.headers['content-type'] || '';
  const m = /multipart\/form-data;\s*boundary=(.+)$/i.exec(ctype);
  if (!m) throw new Error('MULTIPART_REQUIRED');
  let boundary = m[1].trim();
  if (boundary.startsWith('"') && boundary.endsWith('"')) boundary = boundary.slice(1, -1);
  const raw = await readRequestBody(req);
  const parts = parseMultipart(raw, boundary);
  const file = parts.find((p) => p.name === 'file' && p.data?.length);
  const categoryPart = parts.find((p) => p.name === 'category');
  if (!file) throw new Error('FILE_REQUIRED');
  const mimeType = file.mimeType || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mimeType)) throw new Error('MIME_INVALID');
  if (file.data.length > MAX_UPLOAD_BYTES) throw new Error('TOO_LARGE');
  let category = (categoryPart?.data?.toString('utf8') || 'misc').trim();
  if (!CATEGORIES.has(category)) category = 'misc';
  const ext = EXT[mimeType] || path.extname(file.filename) || '';
  const safeName = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
  const absDir = path.join(UPLOAD_DIR, category);
  fs.mkdirSync(absDir, { recursive: true });
  const absPath = path.join(absDir, safeName);
  fs.writeFileSync(absPath, file.data);
  const publicPath = `/uploads/${category}/${safeName}`;
  return {
    path: publicPath,
    mimeType,
    name: file.filename || safeName,
    size: file.data.length,
  };
}

/** Save a data URL or raw buffer to uploads; returns public path */
export function saveDataUrl(dataUrl, category = 'misc', originalName = 'file') {
  let cat = CATEGORIES.has(category) ? category : 'misc';
  let mimeType = 'application/octet-stream';
  let buffer;
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
    if (!m) throw new Error('INVALID_DATA_URL');
    mimeType = m[1];
    buffer = Buffer.from(m[2], 'base64');
  } else if (Buffer.isBuffer(dataUrl)) {
    buffer = dataUrl;
  } else {
    throw new Error('INVALID_DATA_URL');
  }
  if (!ALLOWED_MIME.has(mimeType)) throw new Error('MIME_INVALID');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('TOO_LARGE');
  const ext = EXT[mimeType] || '';
  const safeName = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
  const absDir = path.join(UPLOAD_DIR, cat);
  fs.mkdirSync(absDir, { recursive: true });
  fs.writeFileSync(path.join(absDir, safeName), buffer);
  return {
    path: `/uploads/${cat}/${safeName}`,
    mimeType,
    name: originalName,
  };
}

export function resolveUploadPath(urlPath) {
  if (!urlPath?.startsWith('/uploads/')) return null;
  const rel = urlPath.slice('/uploads/'.length);
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return null;
  const abs = path.normalize(path.join(UPLOAD_DIR, rel));
  if (!abs.startsWith(path.normalize(UPLOAD_DIR))) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}
