/**
 * CSP report sanitizer — never persist cookies / tokens / full bodies.
 */

const MAX_FIELD = 400;

function clip(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f]/g, '')
    .slice(0, MAX_FIELD);
}

export type CspViolationSummary = {
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  blockedUri: string;
  disposition: string;
};

export function summarizeCspReport(body: unknown): CspViolationSummary[] {
  if (body == null) return [];
  const items: unknown[] = Array.isArray(body) ? body : [body];
  const out: CspViolationSummary[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const nested =
      (rec['csp-report'] as Record<string, unknown> | undefined) ||
      (rec.body as Record<string, unknown> | undefined) ||
      rec;
    if (!nested || typeof nested !== 'object') continue;
    const documentUri = clip(nested['document-uri'] || nested.documentURI || nested.documentUrl);
    const violatedDirective = clip(
      nested['violated-directive'] || nested.violatedDirective || nested.effectiveDirective,
    );
    const effectiveDirective = clip(nested['effective-directive'] || nested.effectiveDirective);
    const blockedUri = clip(nested['blocked-uri'] || nested.blockedURL || nested.blockedUri);
    const disposition = clip(nested.disposition || rec.disposition || 'enforce');
    if (!documentUri && !violatedDirective && !blockedUri) continue;
    out.push({ documentUri, violatedDirective, effectiveDirective, blockedUri, disposition });
  }
  return out.slice(0, 8);
}
