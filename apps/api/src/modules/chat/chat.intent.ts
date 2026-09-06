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
]);

export function needsHandoff(message: string): boolean {
  const t = (message || '').normalize('NFC').trim();
  if (!t) return false;
  return HANDOFF_RE.test(t);
}

export function extractSearchTerms(message: string): string[] {
  const raw = (message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+\s-]/g, ' ')
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

export function looksLikeProductQuery(message: string): boolean {
  const t = (message || '').toLowerCase();
  if (/(produto|notebook|celular|iphone|samsung|tv|geladeira|fog[aã]o|micro[- ]?ondas|aspirador|fone|headphone|tablet|monitor|impressora|air fryer|airfryer|xbox|playstation|ps5|nintendo)/i.test(t)) {
    return true;
  }
  const terms = extractSearchTerms(message);
  return terms.length >= 1 && !faqReply(message);
}

export function faqReply(message: string): string | null {
  const t = (message || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t.trim()) return null;

  const pix = /\b(pix|5%|cinco por cento|desconto a vista|desconto à vista)\b/.test(t);
  const card = /\b(12x|parcel|cartao|cartão|mercado pago|mercadopago|juros)\b/.test(t);
  const ship = /\b(frete|entrega|cep|envio|prazo)\b/.test(t);
  const cash = /(cupom|cupons|cashback|schimitz\+|schimitz plus|fidelidade|\bpontos\b)/.test(t);
  const track = /\b(rastre|status do pedido|onde esta meu pedido|onde está meu pedido|separando|saiu para)\b/.test(t);
  const about = /\b(quem (sao|são)|sobre a loja|onde fica|porto alegre|endereco|endereço)\b/.test(t);
  const ret = /\b(troca|devolucao|devolução|garantia|arrepend)\b/.test(t);

  const bits: string[] = [];
  if (pix) bits.push('No PIX você tem 5% de desconto à vista.');
  if (card) bits.push('Dá para parcelar em até 12x pelo Mercado Pago.');
  if (ship) {
    bits.push('Frete grátis em Porto Alegre (CEP iniciando em 90). Entrega própria: Separando → Saiu para entrega → Entregue.');
  }
  if (track) {
    bits.push('Acompanhe o pedido na sua conta. A entrega própria segue: Separando → Saiu para entrega → Entregue.');
  }
  if (cash) {
    bits.push('Aceitamos cupons no checkout e o SCHIMITZ+ devolve cerca de 1% de cashback em compras pagas.');
  }
  if (about) {
    bits.push('A Lojas Schimitz é de Porto Alegre — eletro, celulares, informática, eletrodomésticos e casa.');
  }
  if (ret) bits.push('Troca em até 7 dias, conforme as regras da loja.');

  if (!bits.length) return null;
  bits.push('Se preferir, continue no chat da loja ou fale no WhatsApp (51) 99625-3766.');
  return bits.join(' ');
}

export function noLlmFallbackReply(opts: { faq: string | null; hasProducts: boolean }): string {
  if (opts.faq) return opts.faq;
  if (opts.hasProducts) {
    return 'Encontrei estes itens no catálogo atual. Os preços são os da loja — não invento produto que não esteja listado. Quer que eu detalhe algum, ou prefere falar no WhatsApp (51) 99625-3766?';
  }
  return 'No momento o assistente automático está limitado. Posso confirmar políticas da loja (PIX 5% off, 12x no Mercado Pago, frete grátis em Porto Alegre, SCHIMITZ+) ou te passar para o WhatsApp (51) 99625-3766 — o chat da loja continua disponível.';
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
