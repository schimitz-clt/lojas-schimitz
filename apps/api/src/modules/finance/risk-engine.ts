/**
 * Rule-based risk engine (deterministic rules — this is NOT machine learning).
 * Output is advisory: decision ALLOW or REVIEW. The engine never blocks a payment or an order
 * automatically; REVIEW only flags Payment.reviewStatus = UNDER_REVIEW for a human.
 */

export const RISK_RULESET_VERSION = 'omega-rules-v1';

export type RiskRuleConfig = {
  highValueThreshold: number;
  newAccountHours: number;
  newAccountValueThreshold: number;
  refusedAttemptsThreshold: number;
  velocityWindowMinutes: number;
  velocityOrdersThreshold: number;
  reviewScoreThreshold: number;
  disabledRules: string[];
};

export const DEFAULT_RISK_CONFIG: RiskRuleConfig = {
  highValueThreshold: 5000,
  newAccountHours: 24,
  newAccountValueThreshold: 1500,
  refusedAttemptsThreshold: 3,
  velocityWindowMinutes: 60,
  velocityOrdersThreshold: 5,
  reviewScoreThreshold: 60,
  disabledRules: [],
};

/** FINANCE_RISK_RULES_JSON can override thresholds (invalid JSON ⇒ defaults, never throws). */
export function riskConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RiskRuleConfig {
  const raw = String(env.FINANCE_RISK_RULES_JSON || '').trim();
  if (!raw) return { ...DEFAULT_RISK_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<RiskRuleConfig>;
    const out: RiskRuleConfig = { ...DEFAULT_RISK_CONFIG };
    for (const k of Object.keys(DEFAULT_RISK_CONFIG) as (keyof RiskRuleConfig)[]) {
      const v = (parsed as any)[k];
      if (k === 'disabledRules') {
        if (Array.isArray(v)) out.disabledRules = v.map(String);
      } else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        (out as any)[k] = v;
      }
    }
    return out;
  } catch {
    return { ...DEFAULT_RISK_CONFIG };
  }
}

export type RiskSignals = {
  orderTotal: number;
  accountAgeHours: number | null;
  refusedAttempts: number;
  ordersInWindow: number;
  openReconciliationForOrder: boolean;
  priorChargebacks: number;
};

export type RiskHit = { ruleId: string; reason: string; weight: number; forceReview?: boolean };

export type RiskResult = { decision: 'ALLOW' | 'REVIEW'; score: number; hits: RiskHit[]; rulesetVersion: string };

export function evaluateRisk(signals: RiskSignals, cfg: RiskRuleConfig = DEFAULT_RISK_CONFIG): RiskResult {
  const hits: RiskHit[] = [];
  const on = (id: string) => !cfg.disabledRules.includes(id);

  if (on('R001_HIGH_VALUE') && signals.orderTotal >= cfg.highValueThreshold) {
    hits.push({ ruleId: 'R001_HIGH_VALUE', reason: `Pedido ≥ R$ ${cfg.highValueThreshold}`, weight: 30 });
  }
  if (
    on('R002_NEW_ACCOUNT_HIGH_VALUE') &&
    signals.accountAgeHours != null &&
    signals.accountAgeHours < cfg.newAccountHours &&
    signals.orderTotal >= cfg.newAccountValueThreshold
  ) {
    hits.push({
      ruleId: 'R002_NEW_ACCOUNT_HIGH_VALUE',
      reason: `Conta com menos de ${cfg.newAccountHours}h e pedido ≥ R$ ${cfg.newAccountValueThreshold}`,
      weight: 30,
    });
  }
  if (on('R003_REPEATED_REFUSALS') && signals.refusedAttempts >= cfg.refusedAttemptsThreshold) {
    hits.push({ ruleId: 'R003_REPEATED_REFUSALS', reason: `${signals.refusedAttempts} tentativas recusadas neste pedido`, weight: 40 });
  }
  if (on('R004_ORDER_VELOCITY') && signals.ordersInWindow >= cfg.velocityOrdersThreshold) {
    hits.push({
      ruleId: 'R004_ORDER_VELOCITY',
      reason: `${signals.ordersInWindow} pedidos em ${cfg.velocityWindowMinutes} min`,
      weight: 30,
    });
  }
  if (on('R005_OPEN_RECONCILIATION') && signals.openReconciliationForOrder) {
    hits.push({ ruleId: 'R005_OPEN_RECONCILIATION', reason: 'Reconciliação aberta para este pedido', weight: 50, forceReview: true });
  }
  if (on('R006_PRIOR_CHARGEBACK') && signals.priorChargebacks > 0) {
    hits.push({ ruleId: 'R006_PRIOR_CHARGEBACK', reason: `${signals.priorChargebacks} chargeback(s) anterior(es) do cliente`, weight: 50, forceReview: true });
  }

  const score = hits.reduce((s, h) => s + h.weight, 0);
  const review = score >= cfg.reviewScoreThreshold || hits.some((h) => h.forceReview);
  return { decision: review ? 'REVIEW' : 'ALLOW', score, hits, rulesetVersion: RISK_RULESET_VERSION };
}
