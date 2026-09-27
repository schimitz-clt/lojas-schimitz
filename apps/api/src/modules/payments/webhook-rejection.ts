/**
 * Safe description of a webhook rejected before processing (signature/secret/parse), for the
 * WEBHOOK_SIGNATURE_REJECTED log line. Pure, no I/O.
 * NEVER includes the x-signature value, the HMAC, the secret, the request body or the ts value —
 * only booleans, the error code/status and short sanitised tokens.
 */
import { sanitizeToken, type WebhookRejectReason } from './payment.provider';

export type WebhookRejection = {
  reason: WebhookRejectReason | 'signature_invalid' | 'rejected';
  httpStatus: number;
  code: string;
  hasSignature: boolean;
  hasRequestId: boolean;
  hasDataId: boolean;
  topic: string | null;
  userAgent: string | null;
};

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === name) return Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
  }
  return '';
}

function q(query: Record<string, unknown> | undefined, key: string): string {
  if (!query) return '';
  const v = query[key];
  if (Array.isArray(v)) return String(v[0] ?? '');
  return v == null ? '' : String(v);
}

export function describeWebhookRejection(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
  query: Record<string, unknown> | undefined,
  err: unknown,
): WebhookRejection {
  const e = (err || {}) as { rejectReason?: unknown; status?: unknown; code?: unknown };
  const hasSignature = Boolean((header(headers, 'x-signature') || header(headers, 'x-null-signature')).trim());
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const data = (b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>;
  const nestedQ = (query?.data && typeof query.data === 'object' ? query.data : {}) as Record<string, unknown>;
  const known: WebhookRejectReason[] = ['secret_missing', 'signature_missing', 'signature_mismatch', 'unparseable'];
  const reason: WebhookRejection['reason'] = known.includes(e.rejectReason as WebhookRejectReason)
    ? (e.rejectReason as WebhookRejectReason)
    : Number(e.status) === 400
      ? 'unparseable'
      : hasSignature
        ? 'signature_invalid'
        : 'signature_missing';
  const topic = sanitizeToken(q(query, 'type') || q(query, 'topic') || (typeof b.type === 'string' ? b.type : ''), 40);
  const ua = String(header(headers, 'user-agent')).replace(/[^\x20-\x7e]/g, '').slice(0, 60).trim();
  return {
    reason,
    httpStatus: Number(e.status) || 401,
    code: sanitizeToken(e.code, 60) || 'WEBHOOK_SIGNATURE_INVALID',
    hasSignature,
    hasRequestId: Boolean(header(headers, 'x-request-id').trim()),
    hasDataId: Boolean(q(query, 'data.id') || nestedQ.id != null || data.id != null),
    topic: topic || null,
    userAgent: ua || null,
  };
}
