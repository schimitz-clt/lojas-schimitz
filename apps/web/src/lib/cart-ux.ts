/**
 * Carrinho Lote 1 — display only.
 * PIX math stays in @/lib/pricing. Freight copy stays entrega própria.
 */

import { brl } from './api';
import { installmentLine, toNumber } from './pricing';
import { pixHighlight } from './storefront-pro';

export type CartLinePriceView = {
  /** Server line total (what the bag charged for this row). */
  list: number;
  /** PIX preview of that line. Null when a colliding coupon already covers the 5%. */
  pix: number | null;
  tag: string | null;
  /** Same suffix as home and search cards. */
  pixSuffix: 'no PIX';
  orList: string | null;
  install: string | null;
  unitHint: string | null;
};

/**
 * PIX-first line, same helpers as home/search cards.
 * Does not invent a compare-at price or a second discount rate.
 */
export function cartLinePriceView(
  unitPrice: number | string,
  qty: number,
  lineTotal: number | string,
  opts?: { skipPixPromo?: boolean },
): CartLinePriceView {
  const list = toNumber(lineTotal);
  const unit = toNumber(unitPrice);
  const q = Math.max(0, Math.floor(toNumber(qty)));
  const unitHint = q > 1 ? `${brl(unit)} cada · ${q} un.` : null;
  const install = list > 0 ? installmentLine(list) : null;
  if (opts?.skipPixPromo || list <= 0) {
    return {
      list,
      pix: null,
      tag: null,
      pixSuffix: 'no PIX',
      orList: null,
      install,
      unitHint,
    };
  }
  const highlight = pixHighlight(list);
  const showPix = highlight.savings > 0 && highlight.pix < list;
  return {
    list,
    pix: showPix ? highlight.pix : null,
    tag: showPix ? highlight.tag : null,
    pixSuffix: 'no PIX',
    orList: showPix ? `ou ${brl(list)}` : null,
    install,
    unitHint,
  };
}

export type CartEmptyCopy = {
  title: string;
  body: string;
  homeHref: '/';
  homeLabel: string;
  catalogHref: '/produtos';
  catalogLabel: string;
};

/** Empty sacola — real routes only. */
export function cartEmptyCopy(): CartEmptyCopy {
  return {
    title: 'Sua sacola está vazia',
    body: 'Escolha um produto na loja. A foto, o preço no PIX e a quantidade aparecem aqui.',
    homeHref: '/',
    homeLabel: 'Ir para o início',
    catalogHref: '/produtos',
    catalogLabel: 'Ver produtos',
  };
}

export type CartFreightNote = {
  title: string;
  body: string;
  pay: string;
};

/**
 * Readable restatement of the sacola freight sentence.
 * Checkout still quotes CEP. This does not call a carrier.
 */
export function cartFreightNote(): CartFreightNote {
  return {
    title: 'Frete e CEP',
    body: 'Frete calculado no checkout conforme o CEP (entrega própria).',
    pay: 'Após confirmar, você paga com PIX ou cartão (Mercado Pago).',
  };
}
