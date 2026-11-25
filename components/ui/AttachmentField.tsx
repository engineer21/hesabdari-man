import React, { useRef, useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import type { Attachment } from '../../types';
import {
  ACCEPT_ATTACHMENTS,
  attachmentSrc,
  isImageAttachment,
  isPdfAttachment,
  readFileAsAttachment,
} from '../../utils/attachments';
import AttachmentLightbox from './AttachmentLightbox';
import { cn } from './cn';

interface AttachmentFieldProps {
  value?: Attachment;
  onChange: (value: Attachment | undefined) => void;
  label?: string;
  className?: string;
}

const AttachmentField: React.FC<AttachmentFieldProps> = ({
  value,
  onChange,
  label = 'پیوست (عکس یا PDF)',
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const att = await readFileAsAttachment(file);
      onChange(att);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری فایل.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const src = attachmentSrc(value);

  return (
    <div className={cn('space-y-2', className)}>
      <span className="block text-[11px] font-semibold text-[color:var(--muted)]">{label}</span>

      {value ? (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-2)]/60">
          <div className="flex items-center gap-3 p-3">
            {isImageAttachment(value) && src ? (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-[color:var(--line)]"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                <FileText size={22} />
              </div>
            )}
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-sm font-bold text-[color:var(--ink)]">{value.name}</p>
              <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                {isPdfAttachment(value) ? 'سند PDF' : 'تصویر'}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {isPdfAttachment(value) && src ? (
                <a
                  href={src}
                  download={value.name}
                  className="rounded-xl px-2.5 py-2 text-[11px] font-bold text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)]"
                >
                  دانلود
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[color:var(--expense)] hover:bg-[color:var(--expense-soft)]"
                aria-label="حذف پیوست"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--surface-1)] text-sm font-bold text-[color:var(--brand)] transition hover:border-[color:var(--brand)]/30 hover:bg-[color:var(--brand-soft)]/40"
        >
          <Paperclip size={16} />
          افزودن فاکتور، رسید یا عکس
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTACHMENTS}
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />

      {error ? <p className="text-xs font-medium text-[color:var(--expense)]">{error}</p> : null}

      {previewOpen && src ? (
        <AttachmentLightbox src={src} alt={value?.name} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </div>
  );
};

export default AttachmentField;
