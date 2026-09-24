/**
 * Cotação híbrida: sempre calcula via transportadora; zona com taxa 0
 * (Porto Alegre 90/91) só zera o preço cobrado do cliente.
 * O prazo é o da cotação — estimatedDays da zona não entra na resposta.
 * defaultFee / defaultDays não são cotação de vitrine.
 */

import { BadRequestException } from '@nestjs/common';
import { CarrierNotConfiguredError, type CarrierQuoteInput, type CarrierQuoteResult } from './carriers/carrier.types';
import { MelhorEnvioQuoteError } from './carriers/melhor-envio.quote';
import {
  formatShippingBrl,
  normalizeCep,
  pickCepRule,
  type ShippingQuoteResult,
  type ShippingRuleMatch,
  type ShippingSettingsSnap,
} from './shipping.rules';

export type HybridQuoteCarrier = (input: CarrierQuoteInput) => Promise<CarrierQuoteResult>;

export class ShippingQuoteUnavailableError extends Error {
  readonly code: 'SHIPPING_QUOTE_UNAVAILABLE' | 'SHIPPING_CEP_INVALID';
  readonly reason: 'NOT_CONFIGURED' | 'CARRIER_ERROR' | 'NO_OPTION' | 'INVALID_CEP';

  constructor(reason: 'NOT_CONFIGURED' | 'CARRIER_ERROR' | 'NO_OPTION' | 'INVALID_CEP', message: string) {
    super(message);
    this.name = 'ShippingQuoteUnavailableError';
    this.reason = reason;
    this.code = reason === 'INVALID_CEP' ? 'SHIPPING_CEP_INVALID' : 'SHIPPING_QUOTE_UNAVAILABLE';
  }
}

export const SHIPPING_QUOTE_NOT_CONFIGURED_MESSAGE =
  'Não foi possível cotar o frete deste CEP. Configure a cotação (MELHOR_ENVIO_TOKEN) — a taxa padrão não é um valor exato.';

export const SHIPPING_QUOTE_CARRIER_ERROR_MESSAGE =
  'A transportadora não devolveu uma cotação para este CEP. Tente de novo. A taxa padrão da loja não substitui esse cálculo.';

export const SHIPPING_QUOTE_NO_OPTION_MESSAGE =
  'Nenhuma opção de frete atendeu este CEP na cotação. A taxa padrão da loja não substitui esse cálculo.';

export const SHIPPING_CEP_INVALID_MESSAGE =
  'CEP inválido ou não encontrado. Confira os dígitos e tente de novo.';

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

export function isFreeZoneRule(rule: ShippingRuleMatch | null | undefined): boolean {
  return !!rule && Number(rule.fee) <= 0;
}

export function composeHybridQuote(input: {
  cep: string;
  subtotal: number;
  settings: ShippingSettingsSnap;
  rules: ShippingRuleMatch[];
  carrier: CarrierQuoteResult;
}): ShippingQuoteResult {
  const cep = normalizeCep(input.cep);
  const rule = pickCepRule(cep, input.rules);
  const subsidizedByZone = isFreeZoneRule(rule);
  const freeAbove = Number(input.settings.freeAbove);
  const subsidizedByThreshold = Number(input.subtotal) >= freeAbove;
  const customerFree = subsidizedByZone || subsidizedByThreshold;
  const carrierPrice = roundMoney(input.carrier.price);
  const days = Math.floor(Number(input.carrier.days));
  const service = String(input.carrier.service || input.carrier.modality || 'cotacao').trim() || 'cotacao';
  const carrierName = String(input.carrier.carrier || 'Melhor Envio').trim() || 'Melhor Envio';
  const zoneLabel = subsidizedByZone ? (rule?.label || '').trim() : '';
  const label = zoneLabel
    ? zoneLabel
    : customerFree
      ? `Frete grátis (pedidos a partir de ${formatShippingBrl(freeAbove)})`
      : null;

  return {
    price: customerFree ? 0 : carrierPrice,
    days,
    carrier: carrierName,
    modality: customerFree ? 'gratis' : service,
    matchedPrefix: subsidizedByZone && rule ? normalizeCep(rule.cepPrefix) : null,
    label,
    freeAbove,
    carrierPrice,
    service,
    subsidized: customerFree,
    assumedPackage: input.carrier.assumedPackage === true,
  };
}

export async function quoteHybridFreight(input: {
  cep: string;
  subtotal: number;
  items?: CarrierQuoteInput['items'];
  settings: ShippingSettingsSnap;
  rules: ShippingRuleMatch[];
  quoteCarrier: HybridQuoteCarrier;
}): Promise<ShippingQuoteResult> {
  const cep = normalizeCep(input.cep);
  if (cep.length !== 8) {
    throw new BadRequestException('Informe um CEP com 8 dígitos.');
  }
  let carrier: CarrierQuoteResult;
  try {
    carrier = await input.quoteCarrier({
      cep,
      subtotal: input.subtotal,
      items: input.items ?? [],
    });
  } catch (err) {
    if (err instanceof ShippingQuoteUnavailableError) throw err;
    if (err instanceof CarrierNotConfiguredError) {
      throw new ShippingQuoteUnavailableError('NOT_CONFIGURED', SHIPPING_QUOTE_NOT_CONFIGURED_MESSAGE);
    }
    if (err instanceof MelhorEnvioQuoteError && err.code === 'INVALID_CEP') {
      throw new ShippingQuoteUnavailableError('INVALID_CEP', err.message || SHIPPING_CEP_INVALID_MESSAGE);
    }
    if (err instanceof MelhorEnvioQuoteError && err.code === 'NO_OPTION') {
      throw new ShippingQuoteUnavailableError('NO_OPTION', SHIPPING_QUOTE_NO_OPTION_MESSAGE);
    }
    throw new ShippingQuoteUnavailableError('CARRIER_ERROR', SHIPPING_QUOTE_CARRIER_ERROR_MESSAGE);
  }

  const price = Number(carrier?.price);
  const days = Math.floor(Number(carrier?.days));
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days < 1) {
    throw new ShippingQuoteUnavailableError('NO_OPTION', SHIPPING_QUOTE_NO_OPTION_MESSAGE);
  }
  return composeHybridQuote({
    cep,
    subtotal: input.subtotal,
    settings: input.settings,
    rules: input.rules,
    carrier,
  });
}