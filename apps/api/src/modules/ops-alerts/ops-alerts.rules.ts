/**
 * Pure alert rules (no I/O) — H4. Evaluated every minute and right after a 5xx.
 * Signals come from the in-process sliding window (opsSignals).
 */

export type OpsAlertRule = {
  key: 'http_5xx' | 'provider_errors' | 'webhook_failures';
  /** events counted in this window… */
  windowMs: number;
  /** …at or above this count fire the alert */
  threshold: number;
  title: string;
  hint: string;
};

export type OpsAlertConfig = {
  enabled: boolean;
  recipients: string[];
  cooldownMs: number;
  rules: OpsAlertRule[];
};

function intEnv(env: NodeJS.ProcessEnv, name: string, def: number, min = 1, max = 100000) {
  const n = Number.parseInt(String(env[name] ?? ''), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function parseRecipients(raw: unknown): string[] {
  return String(raw ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
    .slice(0, 5);
}

/**
 * OPS_ALERT_EMAIL_TO unset → disabled (only OPS_ALERT log lines, no e-mail).
 * Thresholds are per API process (1 replica on Railway today).
 */
export function opsAlertConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OpsAlertConfig {
  const recipients = parseRecipients(env.OPS_ALERT_EMAIL_TO);
  return {
    enabled: recipients.length > 0,
    recipients,
    cooldownMs: intEnv(env, 'OPS_ALERT_COOLDOWN_MINUTES', 30, 5, 24 * 60) * 60_000,
    rules: [
      {
        key: 'http_5xx',
        windowMs: 5 * 60_000,
        threshold: intEnv(env, 'OPS_ALERT_5XX_THRESHOLD', 10),
        title: 'Erros 500 na API',
        hint: 'Procure "HTTP_5XX" nos logs do serviço lojas-schimitz no Railway (cada linha tem requestId, rota e stack).',
      },
      {
        key: 'provider_errors',
        windowMs: 15 * 60_000,
        threshold: intEnv(env, 'OPS_ALERT_PROVIDER_ERRORS_THRESHOLD', 3),
        title: 'Falhas ao falar com o Mercado Pago (pagamentos)',
        hint: 'Clientes podem não estar conseguindo pagar. Veja GET /api/v1/health/payments e os logs "payment.intent_failed". Status do MP: https://status.mercadopago.com',
      },
      {
        key: 'webhook_failures',
        windowMs: 15 * 60_000,
        threshold: intEnv(env, 'OPS_ALERT_WEBHOOK_FAILURES_THRESHOLD', 10),
        title: 'Falhas nos webhooks do Mercado Pago',
        hint: 'Confirmações de pagamento podem não estar chegando/processando. Veja /admin/finance/health e os logs de webhook.',
      },
    ],
  };
}

export type FiredAlert = { rule: OpsAlertRule; count: number };

/**
 * Which rules fire now. `lastSent` holds the last send time per rule (cooldown / anti-spam).
 */
export function evaluateOpsAlerts(
  config: OpsAlertConfig,
  countFor: (key: OpsAlertRule['key'], windowMs: number) => number,
  lastSent: Map<string, number>,
  now = Date.now(),
): FiredAlert[] {
  const out: FiredAlert[] = [];
  for (const rule of config.rules) {
    const count = countFor(rule.key, rule.windowMs);
    if (count < rule.threshold) continue;
    const prev = lastSent.get(rule.key);
    if (prev != null && now - prev < config.cooldownMs) continue;
    out.push({ rule, count });
  }
  return out;
}

export function formatOpsAlert(
  a: FiredAlert,
  env: string,
  cooldownMs: number,
  now = new Date(),
): { subject: string; text: string } {
  const minutes = Math.round(a.rule.windowMs / 60_000);
  const brt = new Date(now.getTime() - 3 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
  const subject = `[ALERTA Lojas Schimitz] ${a.rule.title} (${a.count} em ${minutes} min)`;
  const text = [
    `${a.rule.title}: ${a.count} ocorrência(s) nos últimos ${minutes} minutos (limite ${a.rule.threshold}).`,
    `Ambiente: ${env}. Horário: ${brt} (BRT).`,
    '',
    `O que fazer: ${a.rule.hint}`,
    '',
    'Site: https://lojasschimitz.com.br/',
    'Saúde da API: https://lojasschimitz.com.br/api/v1/health/ready',
    'Saúde dos pagamentos: https://lojasschimitz.com.br/api/v1/health/payments',
    '',
    `Este aviso se repete no máximo 1x a cada ${Math.round(cooldownMs / 60_000)} min enquanto o problema continuar.`,
  ].join('\n');
  return { subject, text };
}
