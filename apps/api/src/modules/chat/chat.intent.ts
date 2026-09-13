/** Detecção de intenção e FAQ (puro, sem I/O). */

const HANDOFF_RE = new RegExp(
  [
    '\\b(atendente|humano|pessoa real|falar com (algu[eé]m|voc[eê]s|a loja|um humano|um atendente))\\b',
    '\\b(reclama[cç][aã]o|reclamar|procon|advogad[oa]|processo judicial)\\b',
    '\\b(disputa|contesta[cç][aã]o|chargeback|estorn(o|ar)|cobran[cç]a (indevida|errada|duplicada))\\b',
    '\\b(n[aã]o reconhe[cç]o|cobraram errado|pagamento (errado|indevido|duplicado)|golpe|fraude)\\b',
    'quero falar com (um )?human',
    'preciso de (um )?human',
    // WhatsApp / WA — handoff mesmo sem LLM (429 / sem chave)
    '\\b(whats\\s*app|whatsapp|wpp|zap)\\b',
    '(^|\\s)wa(\\s|$|[,.!?;:])',
    'quero (o )?whats',
    'passar (no|pro|para o|pelo) (whats|zap|wpp)',
    'chama(r)? (no|pelo) (whats|zap|wpp)',
    'link do whats',
  ].join('|'),
  'i',
);

const STOP = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'sem', 'que', 'se',
  'eu', 'me', 'meu', 'minha', 'voce', 'você', 'voces', 'vocês', 'tem', 'ter',
  'quero', 'queria', 'gostaria', 'procuro', 'procurando', 'buscar', 'busca',
  'produto', 'produtos', 'item', 'itens', 'loja', 'site', 'preco', 'preço',
  'valor', 'quanto', 'custa', 'qual', 'quais', 'como', 'onde', 'quando',
  'esse', 'essa', 'isso', 'este', 'esta', 'aquele', 'aquela', 'the', 'and',
  'ola', 'olá', 'oi', 'bom', 'boa', 'dia', 'tarde', 'noite', 'obrigado',
  'obrigada', 'porfavor', 'pfv', 'please', 'me', 'ajuda', 'ajudar', 'sobre',
  'compara', 'comparar', 'compare', 'comparacao', 'comparação', 'versus', 'vs',
  'entre', 'diferenca', 'diferença',
]);

export function needsHandoff(message: string): boolean {
  const t = (message || '').normalize('NFC').trim();
  if (!t) return false;
  return HANDOFF_RE.test(t);
}

/** Case/diacritics/space/light-punctuation normalizer for search matching only — never mutate displayed names. */
export function normalizeForSearch(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSearchTerms(message: string): string[] {
  const raw = normalizeForSearch(message)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 6) break;
  }
  return out;
}

const STRONG_PRODUCT_RE =
  /(notebook|celular|iphone|samsung|tv|geladeira|fog[aã]o|micro[- ]?ondas|aspirador|fone|headphone|tablet|monitor|impressora|air fryer|airfryer|xbox|playstation|ps5|nintendo)/i;

export function looksLikeProductQuery(message: string): boolean {
  const t = (message || '').toLowerCase();
  if (STRONG_PRODUCT_RE.test(t)) return true;
  const terms = extractSearchTerms(message);
  return terms.length >= 1 && !faqReply(message);
}

export function faqReply(message: string): string | null {
  const t = (message || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t.trim()) return null;

  const greet = /^(oi|ola|olá|bom dia|boa tarde|boa noite|eai|e ai|hey|hello)[\s!.?]*$/i.test(
    (message || '').trim(),
  );
  const pix = /\b(pix|5%|cinco por cento|desconto a vista|desconto à vista|a vista|à vista)\b/.test(t);
  // parcelamento / parcela / cartao — sem \b no fim de "parcel"
  const card = /(12x|\bparcel|\bcartao|mercado pago|mercadopago|\bjuros|\bcredito)/.test(t);
  const ship = /\b(frete|entrega|cep|envio|prazo de entrega|prazo)\b/.test(t);
  const cash = /(cupom|cupons|cashback|schimitz\+|schimitz plus|fidelidade|\bpontos\b)/.test(t);
  const track = /\b(rastre|status do pedido|onde esta meu pedido|onde está meu pedido|separando|saiu para|meu pedido)\b/.test(t);
  const about = /\b(quem (sao|são)|sobre a loja|onde fica|porto alegre|endereco|endereço)\b/.test(t);
  // troca / trocar / devolucao / garantia / arrependimento
  const ret = /\b(troc|devolu|garantia|arrepend)/.test(t);
  const hours = /\b(horario|horário|funcionamento|abre|abertura|fecha|fechamento|atendem|atendimento)\b/.test(t);
  const support = /\b(suporte|ajuda|duvida|dúvida|fale conosco|contato)\b/.test(t);
  const pay = /\b(form(a|as) de pagamento|como pagar|pagar com|aceita)\b/.test(t);

  const bits: string[] = [];
  if (greet) {
    bits.push(
      'Olá! Posso ajudar com frete (grátis em Porto Alegre), PIX 5% off, parcelamento em até 12x, troca em 7 dias e produtos do catálogo.',
    );
  }
  if (pix) bits.push('No PIX você tem 5% de desconto à vista.');
  if (card) bits.push('Dá para parcelar em até 12x pelo Mercado Pago.');
  if (pay && !pix && !card) {
    bits.push('Aceitamos PIX (5% off à vista) e cartão em até 12x pelo Mercado Pago.');
  }
  if (ship) {
    bits.push(
      'Frete grátis em Porto Alegre (CEP iniciando em 90). Fora de POA, cotamos entrega própria no checkout. Status: Separando → Saiu para entrega → Entregue.',
    );
  }
  if (track) {
    bits.push('Acompanhe o pedido em /pedidos (conta logada). A entrega própria segue: Separando → Saiu para entrega → Entregue.');
  }
  if (cash) {
    bits.push('Aceitamos cupons no checkout e o SCHIMITZ+ devolve cerca de 1% de cashback em compras pagas.');
  }
  if (about) {
    bits.push('A Lojas Schimitz é de Porto Alegre — eletro, celulares, informática, eletrodomésticos e casa.');
  }
  if (ret) bits.push('Troca em até 7 dias, conforme as regras da loja. Se precisar, fale no WhatsApp (51) 99625-3766.');
  if (hours) {
    bits.push(
      'Para horário de atendimento e dúvidas pontuais, veja /suporte ou fale no WhatsApp (51) 99625-3766 — a equipe confirma o melhor horário.',
    );
  }
  if (support && !bits.length) {
    bits.push(
      'Estou aqui para políticas da loja (frete, PIX, 12x, troca) e busca no catálogo. Também tem a página /suporte e o WhatsApp (51) 99625-3766.',
    );
  }

  if (!bits.length) return null;
  if (!greet || bits.length > 1) {
    bits.push('Mais detalhes em /suporte · WhatsApp (51) 99625-3766.');
  } else {
    bits.push('Pergunte por aqui ou veja /suporte · WhatsApp (51) 99625-3766.');
  }
  return bits.join(' ');
}

export function noLlmFallbackReply(opts: { faq: string | null; hasProducts: boolean }): string {
  if (opts.faq) return opts.faq;
  if (opts.hasProducts) {
    return 'Encontrei estes itens no catálogo atual. Os preços são os da loja — não invento produto que não esteja listado. Quer que eu detalhe algum, ou prefere falar no WhatsApp (51) 99625-3766?';
  }
  return [
    'Posso ajudar com o que a loja já publica: frete grátis em Porto Alegre (CEP 90…), PIX 5% off, até 12x no Mercado Pago, troca em 7 dias e SCHIMITZ+.',
    'Para atendimento humano ou horários, use /suporte ou o WhatsApp (51) 99625-3766.',
    'Se estiver buscando um produto, diga o nome ou modelo que eu consulto o catálogo.',
  ].join(' ');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isConversationId(value?: string): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function parseLlmJson(raw: string): { reply: string; handoff: boolean } | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    const parsed = JSON.parse(text) as { reply?: unknown; handoff?: unknown };
    if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) return null;
    return { reply: parsed.reply.trim(), handoff: Boolean(parsed.handoff) };
  } catch {
    if (text.length > 0 && text.length < 2000 && !text.startsWith('{')) {
      return { reply: text, handoff: false };
    }
    return null;
  }
}

/** Max length after sanitize (aligned with ChatMessageDto @MaxLength). */
export const CHAT_MESSAGE_MAX_LENGTH = 1200;

/**
 * Basic prompt-injection hygiene for user chat text.
 * - strips control chars / null bytes
 * - collapses whitespace
 * - removes common "ignore previous instructions" / role-spoof lines
 * - hard-caps length
 * Does not invent content; empty after sanitize stays empty.
 */
export function sanitizeChatMessage(raw: string | null | undefined): string {
  let t = typeof raw === 'string' ? raw : '';
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  t = t.replace(/\r\n?/g, '\n');
  // Drop lines that look like role / instruction overrides
  const lines = t.split('\n').filter((line) => {
    const s = line.trim();
    if (!s) return true;
    if (/^(system|assistant|developer)\s*:/i.test(s)) return false;
    if (/ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i.test(s)) return false;
    if (/disregard\s+(all\s+)?(previous|prior|above)/i.test(s)) return false;
    if (/you\s+are\s+now\s+(dan|jailbreak|unrestricted)/i.test(s)) return false;
    return true;
  });
  t = lines.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length > CHAT_MESSAGE_MAX_LENGTH) {
    t = t.slice(0, CHAT_MESSAGE_MAX_LENGTH);
  }
  return t;
}

export type ChatIntent =
  | 'handoff'
  | 'refuse'
  | 'faq'
  | 'search'
  | 'get_product'
  | 'compare'
  | 'availability'
  | 'policies'
  | 'shipping'
  | 'order'
  | 'general';

const CATEGORY_HINTS: { slug: string; re: RegExp }[] = [
  { slug: 'celulares', re: /\b(celular|smartphone|iphone|samsung|xiaomi|motorola|android)\b/i },
  { slug: 'informatica', re: /\b(notebook|laptop|computador|\bpc\b|monitor|impressora|mouse|teclado)\b/i },
  { slug: 'eletro', re: /\b(tv|televis[aã]o|smart tv|soundbar|home theater)\b/i },
  {
    slug: 'eletrodomesticos',
    re: /\b(geladeira|fog[aã]o|micro[- ]?ondas|lava[- ]?(lou[cç]a|roupa)|air\s*fryer|airfryer|aspirador|cafeteira)\b/i,
  },
  { slug: 'casa', re: /\b(cama|sof[aá]|panela|toalha|travesseiro|mesa de jantar)\b/i },
  { slug: 'esporte', re: /\b(t[eê]nis|bicicleta|academia|bola|esteira)\b/i },
];

export function extractCategoryHint(message: string): string | undefined {
  const t = message || '';
  for (const h of CATEGORY_HINTS) {
    if (h.re.test(t)) return h.slug;
  }
  return undefined;
}

export function extractBudgetMax(message: string): number | undefined {
  const t = (message || '').toLowerCase().replace(/\./g, '').replace(',', '.');
  const m = t.match(
    /(?:at[eé]|no m[aá]ximo|maximo|menos de|abaixo de|or[cç]amento(?: de)?)\s*(?:r\$\s*)?(\d+(?:\.\d+)?)/i,
  );
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return undefined;
  return Math.round(n * 100) / 100;
}

export function looksLikeCompare(message: string): boolean {
  return /\b(comparar?|compare|compara[cç][aã]o|diferen[cç]a entre|versus)\b|\bvs\.?\b/i.test(
    message || '',
  );
}

export function looksLikeAvailability(message: string): boolean {
  return /\b(estoque|dispon[ií]vel|ainda tem|tem a[ií]|tem esse|tem essa)\b/i.test(message || '');
}

export function looksLikeOrderQuery(message: string): boolean {
  return /\b(meu pedido|meus pedidos|pedido sch-|status do pedido|onde est[aá] meu pedido|rastreio|rastrear)\b/i.test(
    message || '',
  );
}

export function looksLikeGetProduct(message: string): boolean {
  const t = message || '';
  if (/\b(detalhe|ficha|especifica[cç][aã]o)s?\b/i.test(t)) return true;
  if (/\/produto\/[a-z0-9-]+/i.test(t)) return true;
  return false;
}

export function looksLikePolicies(message: string): boolean {
  return /\b(pol[ií]tica|troca|devolu|garantia|pix|parcel|frete|cupom|cashback|schimitz\+)\b/i.test(
    message || '',
  );
}

export function looksLikeShippingQuery(message: string): boolean {
  return /\b(frete|entrega|cep|envio|prazo de entrega)\b/i.test(message || '');
}

const SLUG_IN_TEXT = /(?:\/produto\/|slug\s*[:=]\s*)([a-z0-9]+(?:-[a-z0-9]+){1,})/i;

export function extractProductRefs(message: string): string[] {
  const t = message || '';
  const out: string[] = [];
  const push = (raw: string) => {
    const s = raw.replace(/^(o|a|os|as|um|uma)\s+/i, '').trim();
    if (s.length >= 2 && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  };

  const slug = t.match(SLUG_IN_TEXT);
  if (slug) push(slug[1].toLowerCase());

  const quoted = [...t.matchAll(/"([^"]{2,80})"|'([^']{2,80})'/g)].map((m) => (m[1] || m[2] || '').trim());
  for (const q of quoted) {
    if (q) push(q);
  }

  // Bare product-like slugs (foo-bar-baz)
  for (const m of t.matchAll(/\b([a-z0-9]+(?:-[a-z0-9]+){1,})\b/gi)) {
    push(m[1].toLowerCase());
  }

  // "compare X e Y" / "compare X and Y" / "diferença entre X e Y"
  const afterCompare = t.match(
    /(?:comparar?|compare|compara[cç][aã]o|diferen[cç]a entre)\s+(.+?)$/i,
  );
  if (afterCompare) {
    const parts = afterCompare[1]
      .replace(/[?.!]+$/g, '')
      .split(/\s+(?:e|and|vs\.?|versus)\s+|\s*,\s*/i)
      .map((p) => p.trim())
      .filter((p) => p.length >= 2);
    for (const part of parts) push(part);
  } else {
    // Bare "X vs Y" / "X versus Y"
    const vs = t.match(/^\s*(.+?)\s+(?:vs\.?|versus)\s+(.+?)\s*$/i);
    if (vs) {
      push(vs[1]);
      push(vs[2].replace(/[?.!]+$/g, ''));
    }
  }

  return out.slice(0, 3);
}

export function extractOrderPublicId(message: string): string | undefined {
  const m = (message || '').match(/\b(SCH-[A-Z0-9-]{4,})\b/i);
  return m ? m[1].toUpperCase() : undefined;
}

export function extractCepFromMessage(message: string): string | undefined {
  const m = (message || '').match(/\b(\d{5}-?\d{3})\b/);
  if (!m) return undefined;
  const digits = m[1].replace(/\D/g, '');
  return digits.length === 8 ? digits : undefined;
}

/**
 * Deterministic intent for cost levels.
 * Security refuse is decided separately (ai.security) before this.
 */
export function classifyIntent(message: string): ChatIntent {
  const t = (message || '').trim();
  if (!t) return 'general';
  if (needsHandoff(t)) return 'handoff';
  if (looksLikeCompare(t)) return 'compare';
  if (looksLikeOrderQuery(t)) return 'order';
  if (looksLikeGetProduct(t)) return 'get_product';
  if (looksLikeAvailability(t) && (STRONG_PRODUCT_RE.test(t) || looksLikeProductQuery(t))) return 'availability';
  if (looksLikeShippingQuery(t) && !STRONG_PRODUCT_RE.test(t)) return 'shipping';
  if (faqReply(t) && !STRONG_PRODUCT_RE.test(t)) return 'faq';
  if (STRONG_PRODUCT_RE.test(t)) return 'search';
  const terms = extractSearchTerms(t);
  if (terms.length >= 2 && !faqReply(t) && !looksLikePolicies(t)) return 'search';
  if (faqReply(t)) return 'faq';
  if (looksLikePolicies(t)) return 'policies';
  if (looksLikeAvailability(t)) return 'availability';
  if (looksLikeShippingQuery(t)) return 'shipping';
  return 'general';
}
