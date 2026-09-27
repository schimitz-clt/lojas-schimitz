/**
 * PII/secret masking for free-text log fields (error messages, stacks, client error reports).
 * Complements redactSecrets() (which works on object KEYS) by scrubbing VALUES inside strings.
 * Never throws; always returns a string.
 */

const RULES: Array<[RegExp, string]> = [
  // credentials inside connection strings / URLs: scheme://user:pass@host
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s@/]+@/gi, '$1[REDACTED]@'],
  // Authorization headers / bearer tokens
  [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]'],
  // JWTs (header.payload.signature)
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, '[JWT]'],
  // Mercado Pago / generic API keys
  [/\b(APP_USR|TEST)-[A-Za-z0-9-]{16,}\b/g, '[MP_TOKEN]'],
  [/\b(sk|pk|re|rk)_(live|test)?_?[A-Za-z0-9]{12,}\b/g, '[API_KEY]'],
  [/\bsk-[A-Za-z0-9_-]{10,}\b/g, '[API_KEY]'],
  // secret-looking query/body params: token=..., password=..., etc.
  [
    /\b(access_token|refresh_token|token|password|senha|secret|api_key|apikey|code|signature)=([^&\s"']+)/gi,
    '$1=[REDACTED]',
  ],
  // e-mail addresses
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]'],
  // CPF (000.000.000-00 or 11 digits) and CNPJ (00.000.000/0000-00 or 14 digits)
  [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ]'],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]'],
  [/(?<![\d.])\d{14}(?![\d.])/g, '[CNPJ]'],
  [/(?<![\d.])\d{11}(?![\d.])/g, '[CPF_OR_PHONE]'],
  // BR phones: +55 (11) 91234-5678, (11) 1234-5678, 11 91234 5678
  [/(?:\+?55\s?)?\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]\d{4}\b/g, '[PHONE]'],
  // card numbers (13-19 digits, optionally grouped)
  [/\b(?:\d[ -]?){13,19}\b/g, '[CARD]'],
];

export function maskPii(input: unknown, maxLen = 2000): string {
  let s: string;
  try {
    s = typeof input === 'string' ? input : input == null ? '' : String(input);
  } catch {
    s = '[unprintable]';
  }
  // strip control chars except newline/tab (stacks keep their lines)
  s = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
  for (const [re, rep] of RULES) s = s.replace(re, rep);
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}…[truncated ${s.length - maxLen}]`;
  return s;
}

/** Stack trace for logs: masked, first N frames, bounded size. */
export function safeStack(err: unknown, maxFrames = 15, maxLen = 4000): string | undefined {
  const stack = err instanceof Error ? err.stack : undefined;
  if (!stack) return undefined;
  const lines = stack.split('\n');
  const kept = lines.slice(0, maxFrames + 1).join('\n');
  return maskPii(kept, maxLen);
}

/** URL path for logs: no query string / fragment (queries may carry tokens or e-mails). */
export function pathOnly(url: unknown): string {
  const raw = typeof url === 'string' ? url : '';
  const p = raw.split(/[?#]/)[0] || '/';
  return maskPii(p, 300);
}
