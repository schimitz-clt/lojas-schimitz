import { CARD_INSTALLMENTS_HIGHLIGHT } from './pricing';

/**
 * A loja NÃO anuncia parcelamento sem juros (os juros são os do Mercado Pago, conforme o cartão).
 * Texto vindo do banco (configurações da loja, faixas, selos) também passa por aqui, porque o admin
 * pode ter salvo a frase antiga.
 */
export const NO_INTEREST_CLAIM_RE =
  /sem\s+juros|s\/\s*juros|sem\s+acr[eé]scimo|juros?\s+zero|zero\s+de\s+juros|0\s*%\s*(de\s+)?juros/i;

export function promisesNoInterest(text: string | null | undefined): boolean {
  return NO_INTEREST_CLAIM_RE.test(String(text ?? ''));
}

/** Descrição pública padrão quando a salva no banco promete "sem juros". */
export const SAFE_SITE_DESCRIPTION = `Lojas Schimitz — frete grátis em Porto Alegre, PIX 5% off e parcelamento no cartão em até ${CARD_INSTALLMENTS_HIGHLIGHT}x.`;

export const NO_INTEREST_CLAIM_ERROR =
  'Não use "sem juros" (ou equivalente): o parcelamento no cartão tem os juros do Mercado Pago. Escreva, por exemplo, "parcelamento no cartão em até 3x".';
