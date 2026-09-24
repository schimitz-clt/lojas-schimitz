/** Frete: cálculo por CEP (Melhor Envio) + subsídio de zona grátis. */
export type ShippingQuoteInput = {
  cep: string;
  subtotal: number;
  items: {
    id?: string;
    qty: number;
    weightKg?: number;
    widthCm?: number;
    heightCm?: number;
    lengthCm?: number;
    insuranceValue?: number;
  }[];
};

export type ShippingQuote = {
  price: number;
  days: number;
  carrier: string;
  modality: string;
  matchedPrefix?: string | null;
  label?: string | null;
  freeAbove?: number;
  carrierPrice?: number;
  service?: string;
  subsidized?: boolean;
  assumedPackage?: boolean;
};

export interface ShippingProvider {
  name: string;
  quote(input: ShippingQuoteInput): Promise<ShippingQuote>;
}

/**
 * Fallback estático (mesmos defaults históricos).
 * Mantido para testes/offline; produção usa SelfDeliveryShippingProvider.
 */
export class NullShippingProvider implements ShippingProvider {
  name = 'null';
  async quote(input: ShippingQuoteInput): Promise<ShippingQuote> {
    const price = input.subtotal >= 299 ? 0 : 19.9;
    return {
      price,
      days: 5,
      carrier: 'propria',
      modality: input.subtotal >= 299 ? 'gratis' : 'padrao',
      matchedPrefix: null,
      label: null,
      freeAbove: 299,
    };
  }
}
