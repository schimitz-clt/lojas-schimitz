/**
 * WhatsApp click-to-chat (wa.me) — sem Cloud API, Twilio ou tokens.
 * Envio automático exige WhatsApp Cloud API (Meta) + templates aprovados (futuro).
 */

export const DEFAULT_STORE_WHATSAPP = '5551996253766';

export type WhatsAppKind = 'generic' | 'paid' | 'shipped';

export type WhatsAppOrderInput = {
  publicId: string;
  total: number | string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  storePhone?: string | null;
};

export const ORDER_STATUS_LABEL_PT: Record<string, string> = {
  draft: 'Rascunho',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  separating: 'Separando',
  shipped: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export function statusLabelPt(status: string) {
  return ORDER_STATUS_LABEL_PT[status] || status;
}

export function formatBRL(value: number | string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Normaliza telefone BR para dígitos com DDI 55 (formato wa.me).
 * Aceita User.phone / Address.phone / rascunho em addressSnap.
 */
export function toWhatsAppDigits(raw?: string | null): string | null {
  if (raw == null) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('55') && d.length >= 12 && d.length <= 13) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

export function storeWhatsAppDigits(envValue?: string | null): string {
  return toWhatsAppDigits(envValue) || DEFAULT_STORE_WHATSAPP;
}

export function waMeUrl(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function orderWhatsAppMessage(
  input: WhatsAppOrderInput & { kind?: WhatsAppKind; toCustomer: boolean },
): string {
  const name = (input.customerName || '').trim();
  const publicId = input.publicId;
  const total = formatBRL(input.total);
  const status = statusLabelPt(input.status);
  const kind = input.kind || 'generic';

  if (input.toCustomer) {
    const hi = name ? `Olá, ${name}!` : 'Olá!';
    if (kind === 'paid') {
      return `${hi} Aqui é a Lojas Schimitz.

Recebemos o pagamento do seu pedido ${publicId}.

Total: ${total}
Status: ${status}

Já vamos separar e enviar. Qualquer dúvida, fale com a gente por aqui.`;
    }
    if (kind === 'shipped') {
      return `${hi} Aqui é a Lojas Schimitz.

Seu pedido ${publicId} saiu para entrega.

Total: ${total}
Status: ${status}

Em breve ele chega até você.`;
    }
    return `${hi} Aqui é a Lojas Schimitz.

Sobre o pedido ${publicId}:
Status: ${status}
Total: ${total}

Qualquer dúvida, estamos à disposição.`;
  }

  const cliente = name || 'Cliente';
  if (kind === 'paid') {
    return `Cliente pagou — pedido ${publicId}

Cliente: ${cliente}
Total: ${total}
Status: ${status}

Rascunho interno: o cliente não tem WhatsApp cadastrado. Use este chat da loja para anotar ou avisar a equipe.`;
  }
  if (kind === 'shipped') {
    return `Pedido saiu para entrega — ${publicId}

Cliente: ${cliente}
Total: ${total}
Status: ${status}

Rascunho interno: cliente sem WhatsApp cadastrado.`;
  }
  return `Aviso Lojas Schimitz — pedido ${publicId}

Cliente: ${cliente}
Status: ${status}
Total: ${total}

Rascunho interno: cliente sem WhatsApp cadastrado.`;
}

export function resolveOrderWhatsApp(input: WhatsAppOrderInput & { kind?: WhatsAppKind }) {
  const customer = toWhatsAppDigits(input.customerPhone);
  const toCustomer = Boolean(customer);
  const digits = customer || storeWhatsAppDigits(input.storePhone);
  const text = orderWhatsAppMessage({ ...input, toCustomer });
  return {
    url: waMeUrl(digits, text),
    digits,
    toCustomer,
    text,
    label: toCustomer ? 'cliente' : 'loja',
  };
}

export function envStoreWhatsApp() {
  return storeWhatsAppDigits(process.env.NEXT_PUBLIC_WHATSAPP || process.env.WHATSAPP_PHONE);
}
