import { json as expressJson, urlencoded as expressUrlencoded } from 'express';

const JSON_LIMIT = '1mb';
const CSP_REPORT_LIMIT = '32kb';

/** Express / Nest adapter that exposes `.use()`. */
export type BodyParserApp = { use: (...args: unknown[]) => unknown };

/**
 * Nest defaults (json + urlencoded) plus CSP report Content-Types.
 *
 * PR #60 registered only `application/csp-report` and `application/reports+json`.
 * In production that left `req.body` empty for every `application/json` POST
 * (login/register ValidationPipe saw undefined fields). Disable Nest's implicit
 * parser and register all types here so order cannot drop `application/json`.
 */
export function applyHttpBodyParsers(app: BodyParserApp): void {
  app.use(expressJson({ limit: JSON_LIMIT }));
  app.use(expressUrlencoded({ extended: true, limit: JSON_LIMIT }));
  app.use(expressJson({ type: 'application/csp-report', limit: CSP_REPORT_LIMIT }));
  app.use(expressJson({ type: 'application/reports+json', limit: CSP_REPORT_LIMIT }));
}
