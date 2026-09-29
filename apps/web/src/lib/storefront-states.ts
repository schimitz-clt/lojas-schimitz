/** Shared storefront state copy. No invented stock, price or address. */

export type StorefrontStateCopy = {
  title: string;
  body: string;
};

export function cartJourneyLede(): string {
  return 'Revise os itens. Frete e pagamento são confirmados no checkout.';
}

export function checkoutJourneyLede(): string {
  return 'Confira entrega e pagamento. PIX ou cartão — o valor desta etapa é o que vale.';
}

export function catalogUnavailableCopy(): StorefrontStateCopy {
  return {
    title: 'Não foi possível carregar os produtos agora.',
    body: 'Tente de novo em instantes ou fale com a loja pelo WhatsApp.',
  };
}
