/**
 * Process-local ring of store (post-paid) e-mail failures for GET /admin/ops.
 * Not a KPI: empty after API restart is honest. Never stores recipient addresses or secrets.
 */

export const STORE_NOTIFY_MAIL_FAILURE_CAP = 10;

export const STORE_NOTIFY_MAIL_FAILURE_CODES = [
  'STORE_EMAIL_SEND_FAILED',
  'STORE_EMAIL_NO_RECIPIENTS',
  'MAIL_PROVIDER_OFF_STORE_NOTIFY',
  'MAIL_PROVIDER_OFF',
] as const;

export type StoreNotifyMailFailureCode = (typeof STORE_NOTIFY_MAIL_FAILURE_CODES)[number];

export type StoreNotifyMailFailure = {
  code: StoreNotifyMailFailureCode;
  publicId: string;
  reason: string;
  at: string;
};

export type StoreNotifyMailOpsSummary = {
  recentFailures: StoreNotifyMailFailure[];
  failureCount: number;
};

const recent: StoreNotifyMailFailure[] = [];

function clip(value: string, max: number): string {
  return String(value || '').trim().slice(0, max);
}

export function isStoreNotifyMailFailureCode(code: string): code is StoreNotifyMailFailureCode {
  return (STORE_NOTIFY_MAIL_FAILURE_CODES as readonly string[]).includes(code);
}

/** Record one store-notify mail skip/failure. Idempotent-ish: same publicId+code replaces older row. */
export function recordStoreNotifyMailFailure(input: {
  code: StoreNotifyMailFailureCode;
  publicId?: string | null;
  reason?: string | null;
  at?: Date | string;
}): StoreNotifyMailFailure {
  const at =
    input.at instanceof Date
      ? input.at.toISOString()
      : String(input.at || new Date().toISOString());
  const row: StoreNotifyMailFailure = {
    code: input.code,
    publicId: clip(String(input.publicId || ''), 48),
    reason: clip(String(input.reason || ''), 80),
    at,
  };
  const idx = recent.findIndex((r) => r.publicId && r.publicId === row.publicId && r.code === row.code);
  if (idx >= 0) recent.splice(idx, 1);
  recent.unshift(row);
  if (recent.length > STORE_NOTIFY_MAIL_FAILURE_CAP) recent.length = STORE_NOTIFY_MAIL_FAILURE_CAP;
  return row;
}

export function summarizeStoreNotifyMailOps(
  rows: StoreNotifyMailFailure[] = recent,
): StoreNotifyMailOpsSummary {
  const recentFailures = rows.slice(0, STORE_NOTIFY_MAIL_FAILURE_CAP).map((r) => ({
    code: r.code,
    publicId: String(r.publicId || ''),
    reason: String(r.reason || ''),
    at: String(r.at || ''),
  }));
  return {
    recentFailures,
    failureCount: recentFailures.length,
  };
}

/** Specs only — do not call from production paths. */
export function resetStoreNotifyMailOpsForTests(): void {
  recent.length = 0;
}
