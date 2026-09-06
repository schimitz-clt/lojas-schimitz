/** Lógica pura de frete própria (sem I/O) — testável. */

export type ShippingRuleMatch = {
  cepPrefix: string;
  fee: number;
  estimatedDays: number;
  label?: string | null;
  sortOrder?: number;
};

export type ShippingSettingsSnap = {
  freeAbove: number;
  defaultFee: number;
  defaultDays: number;
};

export type ShippingQuoteResult = {
  price: number;
  days: number;
  carrier: string;
  modality: string;
  matchedPrefix: string | null;
  label: string | null;
  freeAbove: number;
};

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettingsSnap = {
  freeAbove: 299,
  defaultFee: 19.9,
  defaultDays: 5,
};

export function normalizeCep(cep: string): string {
  return String(cep || '').replace(/\D/g, '');
}

/** Prefixo mais longo vence; em empate, maior sortOrder. */
export function pickCepRule(cepDigits: string, rules: ShippingRuleMatch[]): ShippingRuleMatch | null {
  const matches = rules.filter((r) => {
    const p = normalizeCep(r.cepPrefix);
    return p.length > 0 && cepDigits.startsWith(p);
  });
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const la = normalizeCep(a.cepPrefix).length;
    const lb = normalizeCep(b.cepPrefix).length;
    if (lb !== la) return lb - la;
    return (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
  });
  return matches[0];
}

/** Formata BRL no estilo pt-BR (R$ 29,90). */
export function formatShippingBrl(value: number): string {
  const n = Math.round(Number(value) * 100) / 100;
  const fixed = n.toFixed(2).replace('.', ',');
  return `R$ ${fixed}`;
}

/**
 * Rótulo amigável quando a regra não traz `label` (ex.: taxa padrão fora de POA).
 * Regras com label explícito (ex.: "Porto Alegre — frete grátis") têm precedência.
 */
export function resolveShippingLabel(opts: {
  ruleLabel?: string | null;
  price: number;
  modality: string;
  freeAbove: number;
}): string {
  const fromRule = (opts.ruleLabel || '').trim();
  if (fromRule) return fromRule;
  if (opts.price <= 0 || opts.modality === 'gratis') {
    return `Frete grátis (pedidos a partir de ${formatShippingBrl(opts.freeAbove)})`;
  }
  return `Entrega própria — ${formatShippingBrl(opts.price)}`;
}

export function computeShippingQuote(input: {
  cep: string;
  subtotal: number;
  settings: ShippingSettingsSnap;
  rules: ShippingRuleMatch[];
}): ShippingQuoteResult {
  const cep = normalizeCep(input.cep);
  const rule = pickCepRule(cep, input.rules);
  let price = rule ? Number(rule.fee) : Number(input.settings.defaultFee);
  let days = rule ? Number(rule.estimatedDays) : Number(input.settings.defaultDays);
  let modality = rule ? 'zona' : 'padrao';
  const freeAbove = Number(input.settings.freeAbove);
  if (input.subtotal >= freeAbove) {
    price = 0;
    modality = 'gratis';
  }
  const rounded = Math.round(price * 100) / 100;
  return {
    price: rounded,
    days,
    carrier: 'propria',
    modality,
    matchedPrefix: rule ? normalizeCep(rule.cepPrefix) : null,
    label: resolveShippingLabel({
      ruleLabel: rule?.label,
      price: rounded,
      modality,
      freeAbove,
    }),
    freeAbove,
  };
}
