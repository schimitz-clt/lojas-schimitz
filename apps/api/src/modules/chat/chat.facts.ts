/**
 * Fatos oficiais da loja — única fonte de políticas do assistente.
 * Não inventar produtos, preços ou regras fora daqui + catálogo.
 */
import { storeWhatsAppDigits, waMeUrl } from '../../common/whatsapp';

export const STORE_NAME = 'Lojas Schimitz';
export const STORE_CITY = 'Porto Alegre';
export const STORE_CATEGORIES = 'eletro, celulares, informática, eletrodomésticos e casa';
export const PIX_DISCOUNT_PCT = 5;
export const INSTALLMENTS = 12;
export const INSTALLMENTS_PROVIDER = 'Mercado Pago';
export const FREE_SHIPPING_ABOVE = 299;
export const DELIVERY_FLOW = 'Separando → Saiu para entrega → Entregue';
export const CASHBACK_LABEL = 'SCHIMITZ+';
export const CASHBACK_RATE_PCT = 1;
export const RETURN_DAYS = 7;

export function storeWhatsApp() {
  return storeWhatsAppDigits(process.env.WHATSAPP_PHONE || process.env.NEXT_PUBLIC_WHATSAPP);
}

export function storeWhatsAppUrl(text?: string) {
  const msg = text || 'Olá, vim pelo chat da Lojas Schimitz e gostaria de falar com um atendente.';
  return waMeUrl(storeWhatsApp(), msg);
}

export function storeFactsBlock() {
  const wa = storeWhatsApp();
  return [
    `${STORE_NAME} — ${STORE_CATEGORIES}. Loja em ${STORE_CITY}.`,
    `PIX: ${PIX_DISCOUNT_PCT}% de desconto à vista.`,
    `Cartão: até ${INSTALLMENTS}x via ${INSTALLMENTS_PROVIDER}.`,
    `Frete grátis acima de R$ ${FREE_SHIPPING_ABOVE} (entrega própria).`,
    `Acompanhamento do pedido (entrega própria): ${DELIVERY_FLOW}.`,
    `Cupons no checkout + cashback ${CASHBACK_LABEL} (cerca de ${CASHBACK_RATE_PCT}% em compras pagas).`,
    `Troca em ${RETURN_DAYS} dias, conforme regras da loja.`,
    `Atendimento humano no WhatsApp: (51) 99625-3766 — https://wa.me/${wa}`,
  ].join('\n');
}

export const HANDOFF_MESSAGE =
  'Vou te passar para um atendente humano no WhatsApp. Clique no link e continue por lá — a equipe da Lojas Schimitz te responde.';
