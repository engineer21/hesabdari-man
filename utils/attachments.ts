import type { Attachment } from '../types';
import { uploadFile } from './api';

type LegacyAttachment = {
  name: string;
  mimeType: string;
  path?: string;
  data?: string;
  dataUrl?: string;
};

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_ATTACHMENT_MB = 2;
export const ACCEPT_ATTACHMENTS =
  'image/jpeg,image/png,image/webp,image/gif,application/pdf';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export function normalizeAttachment(
  raw?: Attachment | LegacyAttachment | null
): Attachment | undefined {
  if (!raw) return undefined;
  const path =
    raw.path ||
    (typeof (raw as LegacyAttachment).data === 'string' &&
    !(raw as LegacyAttachment).data!.startsWith('data:')
      ? (raw as LegacyAttachment).data
      : undefined) ||
    (typeof (raw as LegacyAttachment).dataUrl === 'string' &&
    !(raw as LegacyAttachment).dataUrl!.startsWith('data:')
      ? (raw as LegacyAttachment).dataUrl
      : undefined);
  if (!path) return undefined;
  return {
    path,
    mimeType: raw.mimeType || 'application/octet-stream',
    name: raw.name || 'پیوست',
  };
}

export function attachmentSrc(raw?: Attachment | LegacyAttachment | null): string | undefined {
  return normalizeAttachment(raw)?.path;
}

export function isImageAttachment(att?: Attachment | null): boolean {
  return Boolean(att?.mimeType?.startsWith('image/'));
}

export function isPdfAttachment(att?: Attachment | null): boolean {
  return att?.mimeType === 'application/pdf';
}

export function validateAttachmentFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return 'فقط تصویر (JPG, PNG, WebP, GIF) یا PDF مجاز است.';
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `حجم فایل نباید بیشتر از ${MAX_ATTACHMENT_MB} مگابایت باشد.`;
  }
  return null;
}

export async function readFileAsAttachment(file: File): Promise<Attachment> {
  const err = validateAttachmentFile(file);
  if (err) throw new Error(err);
  const saved = await uploadFile(file, 'attachments');
  return { path: saved.path, mimeType: saved.mimeType, name: saved.name || file.name };
}

export async function uploadImagePath(
  file: File,
  category: 'logos' | 'avatars' | 'profiles' | 'misc' = 'misc'
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('فقط تصویر مجاز است.');
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`حجم فایل نباید بیشتر از ${MAX_ATTACHMENT_MB} مگابایت باشد.`);
  }
  const saved = await uploadFile(file, category);
  return saved.path;
}

/** Fetch remote/public image and re-upload to server (for logo presets) */
export async function fetchImageAsUploadPath(
  url: string,
  category: 'logos' | 'misc' = 'logos'
): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('دریافت تصویر ناموفق بود.');
  const blob = await res.blob();
  const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
  return uploadImagePath(file, category);
}
