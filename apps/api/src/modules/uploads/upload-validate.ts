/**
 * Additive upload guards: size + magic-bytes for JPG/PNG/WebP.
 * Declared Content-Type is a hint only — a valid image still passes
 * if the bytes match (browsers sometimes send application/octet-stream).
 * Does not invent files or write to disk.
 */

export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const UPLOAD_MAX_MB = 15;

export const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const UPLOAD_ALLOWED_MIME = new Set(Object.keys(MIME_EXT));

export type UploadValidateOk = { ok: true; mime: string };
export type UploadValidateFail = { ok: false; code: string; message: string };
export type UploadValidateResult = UploadValidateOk | UploadValidateFail;

export const UPLOAD_ERRORS = {
  EMPTY: {
    code: 'UPLOAD_EMPTY',
    message: 'Envie um arquivo no campo "file" (JPG, PNG ou WebP, até 15 MB).',
  },
  TOO_LARGE: {
    code: 'UPLOAD_TOO_LARGE',
    message: 'Arquivo maior que 15 MB. Envie uma imagem JPG, PNG ou WebP menor.',
  },
  TYPE_INVALID: {
    code: 'UPLOAD_TYPE_INVALID',
    message: 'Tipo inválido. Use JPG, PNG ou WebP (máx. 15 MB).',
  },
  CONTENT_INVALID: {
    code: 'UPLOAD_CONTENT_INVALID',
    message: 'O arquivo não é uma imagem JPG, PNG ou WebP válida.',
  },
} as const;

/** Detect image/jpeg | image/png | image/webp from magic bytes. */
export function sniffImageMime(buffer: Buffer | Uint8Array | null | undefined): string | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateUpload(input: {
  buffer?: Buffer | Uint8Array | null;
  mimetype?: string | null;
  size?: number;
}): UploadValidateResult {
  const buffer = input.buffer;
  const size = input.size ?? (buffer ? buffer.length : 0);
  if (!buffer || buffer.length === 0) {
    return { ok: false, ...UPLOAD_ERRORS.EMPTY };
  }
  if (size > UPLOAD_MAX_BYTES || buffer.length > UPLOAD_MAX_BYTES) {
    return { ok: false, ...UPLOAD_ERRORS.TOO_LARGE };
  }
  const sniffed = sniffImageMime(buffer);
  if (sniffed && UPLOAD_ALLOWED_MIME.has(sniffed)) {
    return { ok: true, mime: sniffed };
  }
  const declared = String(input.mimetype || '')
    .toLowerCase()
    .trim();
  if (declared && !UPLOAD_ALLOWED_MIME.has(declared)) {
    return { ok: false, ...UPLOAD_ERRORS.TYPE_INVALID };
  }
  return { ok: false, ...UPLOAD_ERRORS.CONTENT_INVALID };
}

/** Map Multer LIMIT_* to the same upload error envelope (400, not 500). */
export function mapMulterUploadError(err: unknown): { code: string; message: string } | null {
  if (!err || typeof err !== 'object') return null;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  const name = 'name' in err ? String((err as { name: unknown }).name) : '';
  if (code === 'LIMIT_FILE_SIZE') return { ...UPLOAD_ERRORS.TOO_LARGE };
  if (name === 'MulterError' && (code === 'LIMIT_UNEXPECTED_FILE' || code === 'LIMIT_FILE_COUNT')) {
    return { ...UPLOAD_ERRORS.EMPTY };
  }
  return null;
}
