/**
 * Pure mail config helpers — no secrets in logs/responses.
 * Presence checks use env *names* only (truthy trimmed strings), never log values.
 */

export type MailProviderMode = 'resend-http' | 'smtp' | 'off';

export type MailSendKind =
  | 'order_paid'
  | 'admin_order_paid'
  | 'order_ready'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_status'
  | 'password_reset';

/** True when MAIL_FROM + (RESEND_API_KEY or SMTP_HOST) env names are present. Does not read secret values beyond emptiness. */
export function mailConfiguredFromEnvPresence(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!String(env.MAIL_FROM || '').trim()) return false;
  if (String(env.RESEND_API_KEY || '').trim()) return true;
  if (String(env.SMTP_HOST || '').trim()) return true;
  return false;
}

/**
 * Resolve runtime provider mode (mirrors MailService boot).
 * May inspect SMTP_PASS prefix for Resend dual-use — never return the value.
 */
export function resolveMailProviderMode(
  env: NodeJS.ProcessEnv = process.env,
): MailProviderMode {
  const from = String(env.MAIL_FROM || '').trim();
  if (!from) return 'off';

  if (String(env.RESEND_API_KEY || '').trim()) return 'resend-http';

  const host = String(env.SMTP_HOST || '').trim();
  const pass = env.SMTP_PASS ?? '';
  if (pass.startsWith('re_') && /resend/i.test(host)) return 'resend-http';

  if (host) return 'smtp';
  return 'off';
}

/** Normalize recipient for idempotency keys (lowercase trim). */
export function normalizeMailRecipient(to: string): string {
  return String(to || '').trim().toLowerCase();
}

/**
 * Build process-local idempotency key for transactional mail.
 * Password reset returns null (user may legitimately request again).
 */
export function buildMailIdempotencyKey(opts: {
  kind: MailSendKind;
  to: string;
  publicId?: string | null;
  statusLabel?: string | null;
}): string | null {
  if (opts.kind === 'password_reset') return null;
  const to = normalizeMailRecipient(opts.to);
  if (!to) return null;
  const publicId = String(opts.publicId || '').trim();
  if (!publicId) return null;
  if (opts.kind === 'order_status') {
    const label = String(opts.statusLabel || '').trim() || 'status';
    return `${opts.kind}:${publicId}:${label}:${to}`;
  }
  return `${opts.kind}:${publicId}:${to}`;
}
