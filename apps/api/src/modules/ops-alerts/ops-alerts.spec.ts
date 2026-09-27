import assert from 'node:assert/strict';
import { SlidingWindowCounter, opsSignals } from '../../common/sliding-window';
import { financeMetrics } from '../finance/finance-metrics';
import { MailService } from '../mail/mail.service';
import {
  evaluateOpsAlerts,
  formatOpsAlert,
  opsAlertConfigFromEnv,
  parseRecipients,
} from './ops-alerts.rules';
import { OpsAlertsService } from './ops-alerts.service';

async function main() {
  // --- sliding window
  const w = new SlidingWindowCounter(60_000, 10);
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) w.record('k', t0 + i * 1000);
  assert.equal(w.count('k', 10_000, t0 + 5000), 5);
  assert.equal(w.count('k', 2_500, t0 + 5000), 2); // events at t0+3000, t0+4000
  assert.equal(w.count('k', 60_000, t0 + 200_000), 0); // pruned by retention
  for (let i = 0; i < 50; i++) w.record('cap', t0);
  assert.equal(w.count('cap', 60_000, t0), 10); // bounded memory

  // --- config
  assert.deepEqual(parseRecipients(' Dono@Loja.com.br, invalid, b@c.io '), ['dono@loja.com.br', 'b@c.io']);
  const off = opsAlertConfigFromEnv({});
  assert.equal(off.enabled, false);
  const cfg = opsAlertConfigFromEnv({ OPS_ALERT_EMAIL_TO: 'dono@loja.com.br', OPS_ALERT_5XX_THRESHOLD: '3', OPS_ALERT_COOLDOWN_MINUTES: '30' });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.rules.find((r) => r.key === 'http_5xx')!.threshold, 3);
  assert.equal(cfg.rules.find((r) => r.key === 'provider_errors')!.threshold, 3);

  // --- evaluate: threshold + cooldown
  const counts: Record<string, number> = { http_5xx: 2, provider_errors: 0, webhook_failures: 0, webhook_processing_failures: 0 };
  const last = new Map<string, number>();
  const now = Date.UTC(2026, 8, 27, 18, 0);
  assert.equal(evaluateOpsAlerts(cfg, (k) => counts[k], last, now).length, 0);
  counts.http_5xx = 3;
  const fired = evaluateOpsAlerts(cfg, (k) => counts[k], last, now);
  assert.deepEqual(fired.map((f) => f.rule.key), ['http_5xx']);
  last.set('http_5xx', now);
  assert.equal(evaluateOpsAlerts(cfg, (k) => counts[k], last, now + 10 * 60_000).length, 0); // cooldown
  assert.equal(evaluateOpsAlerts(cfg, (k) => counts[k], last, now + 31 * 60_000).length, 1); // after cooldown

  // --- webhook alert watches ONLY processing failures (fetch/apply/chargeback), never raw webhook_failures
  assert.ok(!cfg.rules.some((r) => (r.key as string) === 'webhook_failures'), 'no rule on raw webhook_failures');
  const wh = cfg.rules.find((r) => r.key === 'webhook_processing_failures')!;
  assert.equal(wh.threshold, 10);
  assert.equal(opsAlertConfigFromEnv({ OPS_ALERT_EMAIL_TO: 'a@b.io', OPS_ALERT_WEBHOOK_FAILURES_THRESHOLD: '4' }).rules.find((r) => r.key === 'webhook_processing_failures')!.threshold, 4);
  {
    const c2: Record<string, number> = { http_5xx: 0, provider_errors: 0, webhook_failures: 500, webhook_unsigned_ipn: 500, webhook_unsigned_rejected: 500, webhook_processing_failures: 0 };
    assert.equal(evaluateOpsAlerts(cfg, (k) => c2[k] ?? 0, new Map(), now).length, 0, 'signature/IPN noise never alerts');
    c2.webhook_processing_failures = 10;
    assert.deepEqual(evaluateOpsAlerts(cfg, (k) => c2[k] ?? 0, new Map(), now).map((f) => f.rule.key), ['webhook_processing_failures']);
  }

  // --- message: Portuguese, BRT, no data beyond counts
  const msg = formatOpsAlert(fired[0], 'production', cfg.cooldownMs, new Date(now));
  assert.ok(msg.subject.startsWith('[ALERTA Lojas Schimitz] Erros 500'));
  assert.ok(msg.text.includes('15:00 (BRT)'), msg.text);
  assert.ok(msg.text.includes('HTTP_5XX'));
  assert.ok(msg.text.includes('30 min'));

  // --- finance counters feed the window (real financeMetrics)
  opsSignals.reset();
  financeMetrics.inc('provider_errors');
  financeMetrics.inc('provider_errors');
  financeMetrics.inc('refunds_requested'); // not mirrored
  assert.equal(opsSignals.count('provider_errors', 60_000), 2);
  assert.equal(opsSignals.count('refunds_requested', 60_000), 0);
  financeMetrics.inc('webhook_processing_failures');
  financeMetrics.inc('webhook_unsigned_ipn'); // not mirrored (never alerts)
  financeMetrics.inc('webhook_unsigned_rejected'); // not mirrored
  assert.equal(opsSignals.count('webhook_processing_failures', 60_000), 1);
  assert.equal(opsSignals.count('webhook_unsigned_ipn', 60_000), 0);
  assert.equal(opsSignals.count('webhook_unsigned_rejected', 60_000), 0);
  financeMetrics.reset();

  // --- service with the REAL MailService (mail off in this env → logs OPS_ALERT, emailed=0, never throws)
  for (const k of ['MAIL_FROM', 'RESEND_API_KEY', 'SMTP_HOST']) delete process.env[k];
  process.env.OPS_ALERT_EMAIL_TO = 'dono@loja.com.br';
  process.env.OPS_ALERT_5XX_THRESHOLD = '3';
  opsSignals.reset();
  const svc = new OpsAlertsService(new MailService());
  assert.equal(svc.status().emailEnabled, false);
  const lines: string[] = [];
  const orig = console.warn;
  console.warn = (l: unknown) => lines.push(String(l));
  try {
    for (let i = 0; i < 3; i++) opsSignals.record('http_5xx');
    const r1 = await svc.runCheck();
    assert.deepEqual(r1, [{ key: 'http_5xx', count: 3, emailed: 0 }]);
    const r2 = await svc.runCheck(); // cooldown → nothing
    assert.deepEqual(r2, []);
  } finally {
    console.warn = orig;
  }
  const alertLine = JSON.parse(lines.find((l) => l.includes('OPS_ALERT'))!);
  assert.equal(alertLine.alert, 'http_5xx');
  assert.equal(alertLine.emailed, 0);
  svc.onModuleDestroy();
  delete process.env.OPS_ALERT_EMAIL_TO;
  delete process.env.OPS_ALERT_5XX_THRESHOLD;
  opsSignals.reset();

  console.log('ops-alerts.spec OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
