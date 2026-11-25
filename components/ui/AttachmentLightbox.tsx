import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Attachment } from '../../types';
import { attachmentSrc } from '../../utils/attachments';
import { IconButton } from '../ui';

/** Fullscreen image preview (portaled + blocking Esc). */
const AttachmentLightbox: React.FC<{
  src?: string | null;
  attachment?: Attachment | null;
  alt?: string;
  onClose: () => void;
}> = ({ src, attachment, alt = 'پیش‌نمایش', onClose }) => {
  const resolvedSrc = src || (attachment ? attachmentSrc(attachment) : null);

  useEffect(() => {
    if (!resolvedSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [resolvedSrc, onClose]);

  if (!resolvedSrc || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      data-blocking-modal="true"
      onClick={onClose}
    >
      <div className="absolute left-4 top-4">
        <IconButton
          icon={X}
          label="بستن"
          onClick={onClose}
          className="!text-white hover:!bg-white/20"
        />
      </div>
      <img
        src={resolvedSrc}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
};

export default AttachmentLightbox;
