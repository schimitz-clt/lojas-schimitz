/**
 * Uploads durability signal — real UPLOADS_DIR path check only.
 * Persistent root is /data (Railway Volume per docs/DEPLOY.md).
 * Does not probe mounts, move files, or create volumes.
 */

/** Railway Volume mount root per docs/DEPLOY.md — only /data is treated as durable. */
export const UPLOADS_PERSISTENT_ROOT = '/data';

/**
 * Resolve UPLOADS_DIR the same way main.ts / UploadsService do.
 * Missing/empty → `<cwd>/uploads` (typically ephemeral).
 */
export function resolveUploadsDir(
  envDir?: string | null,
  cwd: string = process.cwd(),
): string {
  const t = typeof envDir === 'string' ? envDir.trim() : '';
  if (!t) {
    const base = (cwd || '.').replace(/\\/g, '/').replace(/\/+$/, '');
    return `${base}/uploads`;
  }
  return t.replace(/\\/g, '/').replace(/\/+$/, '') || t;
}

/**
 * Real path-prefix check: durable iff path is `/data` or under `/data/`.
 * Does not probe mounts/filesystem or invent volume status.
 * `/datafoo` is NOT persistent (boundary-safe).
 */
export function isUploadsDirPersistent(uploadsDir: string): boolean {
  const n = String(uploadsDir || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  if (!n) return false;
  if (n === UPLOADS_PERSISTENT_ROOT) return true;
  return n.startsWith(`${UPLOADS_PERSISTENT_ROOT}/`);
}

export type UploadsDurabilitySummary = {
  /** Resolved path as configured — ops only; not a secret. */
  dir: string;
  /** True when dir is under /data (DEPLOY.md Volume). */
  persistent: boolean;
};

/** Summarize uploads durability from env/path — no fake metrics. */
export function summarizeUploadsDurability(input?: {
  uploadsDir?: string | null;
  envDir?: string | null;
  cwd?: string;
}): UploadsDurabilitySummary {
  const dir =
    input?.uploadsDir != null && String(input.uploadsDir).trim()
      ? resolveUploadsDir(String(input.uploadsDir).trim(), input.cwd)
      : resolveUploadsDir(input?.envDir, input?.cwd);
  return {
    dir,
    persistent: isUploadsDirPersistent(dir),
  };
}
