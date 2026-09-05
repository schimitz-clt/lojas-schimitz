/** TODO: Shipping Provider — integração real no SCH-004 */
export type ShippingQuoteInput = {
  cep: string;
  subtotal: number;
  items: { qty: number; weightKg?: number }[];
};

export interface ShippingProvider {
  name: string;
  quote(input: ShippingQuoteInput): Promise<{ price: number; days: number; carrier: string; modality: string }>;
}

export class NullShippingProvider implements ShippingProvider {
  name = 'null';
  async quote(input: ShippingQuoteInput) {
    const price = input.subtotal >= 299 ? 0 : 19.9;
    return {
      price,
      days: 5,
      carrier: 'propria',
      modality: input.subtotal >= 299 ? 'gratis' : 'padrao',
    };
  }
}
