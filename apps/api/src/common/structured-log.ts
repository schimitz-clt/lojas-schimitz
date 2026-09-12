/**
 * Structured JSON log helper — never emit secrets.
 * Use for ops/observability lines; Nest Logger remains fine for class logs.
 */

const SECRET_KEY_RE =
  /^(password|passwd|pwd|secret|token|accessToken|refreshToken|authorization|api[_-]?key|apikey|openai|chat_api_key|private[_-]?key|cookie|set-cookie|credit[_-]?card|cvv|pin)$/i;

const SECRET_VALUE_HINT_RE =
  /\b(sk-[a-zA-Z0-9]{10,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*|-----BEGIN [A-Z ]+PRIVATE KEY-----)\b/i;

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error';

export function redactSecrets<T extends Record<string, unknown>>(fields?: T | null): Record<string, unknown> {
  if (!fields || typeof fields !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SECRET_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (typeof v === 'string' && SECRET_VALUE_HINT_RE.test(v)) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = redactSecrets(v as Record<string, unknown>);
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function structuredLog(
  level: StructuredLogLevel,
  message: string,
  fields?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...redactSecrets(fields),
  });
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
