import type { EventAttachmentDraft } from '@/lib/types/event';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function inferMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}

export function isAllowedMime(mime: string): boolean {
  if (mime.startsWith('image/')) return true;
  const allowed = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/octet-stream',
  ]);
  return allowed.has(mime);
}

export function stripExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.substring(0, idx) : filename;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns Hebrew alert title/body if invalid, otherwise null. */
export function validateAttachmentDraft(
  draft: EventAttachmentDraft
): { title: string; message: string } | null {
  let { mimeType, sizeBytes } = draft;
  if (!mimeType) mimeType = inferMimeType(draft.originalName);
  if (!isAllowedMime(mimeType)) {
    return { title: 'סוג קובץ לא נתמך', message: 'סוג קובץ זה אינו נתמך' };
  }
  if (sizeBytes > 0 && sizeBytes > MAX_ATTACHMENT_BYTES) {
    return {
      title: 'קובץ גדול מדי',
      message: 'הקובץ גדול מדי. הגודל המקסימלי הוא 10MB',
    };
  }
  return null;
}
