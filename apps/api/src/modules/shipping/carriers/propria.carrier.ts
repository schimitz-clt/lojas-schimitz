import {
  computeShippingQuote,
  DEFAULT_SHIPPING_SETTINGS,
} from '../shipping.rules';
import type {
  CarrierProvider,
  CarrierQuoteInput,
  CarrierQuoteResult,
  CreateLabelInput,
  CreateLabelResult,
  TrackInput,
  TrackResult,
} from './carrier.types';

/**
 * Entrega própria (manual) — default ativo.
 * FREIGHT de checkout continua em ShippingService; aqui só normaliza etiqueta/rastreio manual.
 * Nunca chama API externa nem inventa eventos de tracking.
 */
export class PropriaCarrierProvider implements CarrierProvider {
  readonly name = 'propria';

  async quote(input: CarrierQuoteInput): Promise<CarrierQuoteResult> {
    // Informational mirror of CEP defaults (no DB). Checkout must use ShippingProvider.
    const q = computeShippingQuote({
      cep: input.cep,
      subtotal: input.subtotal,
      settings: DEFAULT_SHIPPING_SETTINGS,
      rules: [],
    });
    return {
      price: q.price,
      days: q.days,
      carrier: 'propria',
      service: 'entrega_propria',
      modality: q.modality,
      informational: true,
    };
  }

  async createLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
    const trackingCode =
      input.trackingCode !== undefined && input.trackingCode !== null
        ? String(input.trackingCode).trim() || null
        : null;
    return {
      carrier: 'propria',
      trackingCode,
      labelUrl: null,
      externalShipmentId: null,
      mode: 'manual',
    };
  }

  async track(input: TrackInput): Promise<TrackResult> {
    const code = String(input.trackingCode || '').trim();
    return {
      trackingCode: code,
      carrier: input.carrier?.trim() || 'propria',
      status: 'unknown',
      events: [
        {
          description:
            'Rastreio manual (entrega própria) — sem sincronização automática com transportadora',
        },
      ],
    };
  }
}
