/**
 * Home Lote 1 — Magalu-like structure, Schimitz routes only.
 * Display helpers. No new address or coupon APIs.
 */

import {
  ACCOUNT_ENDERECO_PATH,
  accountAddressToEdit,
  accountLoginHref,
  type AccountAddressRecord,
} from '@/lib/account-menu';
import { formatCepInput, isCompleteCep } from '@/lib/pdp-trust';

export type HomeShortcutId = 'cupons' | 'ofertas' | 'categorias';

export type HomeShortcut = {
  id: HomeShortcutId;
  label: string;
  href: string;
  description: string;
};

/**
 * Cupons: staff console is `/admin/cupons`. Shoppers apply a code on the sacola
 * (`/carrinho#cart-coupon`) — there is no public coupon catalog.
 * Ofertas: department filter (home shelf stays). Categorias: full catalog.
 */
export function homeQuickShortcuts(role?: string | null): HomeShortcut[] {
  const staff = String(role || '').trim().toLowerCase() === 'admin';
  return [
    {
      id: 'cupons',
      label: 'Cupons',
      href: staff ? '/admin/cupons' : '/carrinho#cart-coupon',
      description: staff ? 'Cupons da loja' : 'Aplicar cupom na sacola',
    },
    {
      id: 'ofertas',
      label: 'Ofertas',
      href: '/departamento/ofertas',
      description: 'Ofertas do departamento',
    },
    {
      id: 'categorias',
      label: 'Categorias',
      href: '/produtos',
      description: 'Todas as categorias',
    },
  ];
}

export type DeliveryBarMode = 'address' | 'cep' | 'prompt';

export type DeliveryBarCopy = {
  mode: DeliveryBarMode;
  title: string;
  detail: string;
  /** Formatted CEP when we actually have 8 digits. */
  cep: string;
  /** Saved street/city row opens the address block on Dados pessoais. */
  accountHref: typeof ACCOUNT_ENDERECO_PATH | null;
};

function streetLine(addr: AccountAddressRecord): string {
  const street = String(addr.street || '').trim();
  const number = String(addr.number || '').trim();
  if (street && number) return `${street}, ${number}`;
  return street || number;
}

function placeLine(addr: AccountAddressRecord): string {
  return String(addr.city || '').trim();
}

/** Prefer the saved account address, then the CEP already stored for frete (`sch_cep`). */
export function deliveryBarCopy(input: {
  addresses?: AccountAddressRecord[] | null;
  storedCep?: string | null;
}): DeliveryBarCopy {
  const addr = accountAddressToEdit(input.addresses);
  const fromAddress = formatCepInput(addr?.cep || '');
  const fromStore = formatCepInput(input.storedCep || '');
  const cep = isCompleteCep(fromAddress) ? fromAddress : isCompleteCep(fromStore) ? fromStore : '';
  const street = addr ? streetLine(addr) : '';
  const city = addr ? placeLine(addr) : '';
  const titled = [street, city].filter(Boolean).join(' · ');

  if (addr && titled) {
    return {
      mode: 'address',
      title: titled,
      detail: cep ? `CEP ${cep}` : 'Endereço salvo',
      cep,
      accountHref: ACCOUNT_ENDERECO_PATH,
    };
  }

  if (cep) {
    return {
      mode: 'cep',
      title: `Entrega para ${cep}`,
      detail: 'Toque para alterar',
      cep,
      accountHref: null,
    };
  }

  return {
    mode: 'prompt',
    title: 'Informar CEP',
    detail: 'Para ver a entrega na sua região',
    cep: '',
    accountHref: null,
  };
}

/** Customer-facing home catalog failure. No operator/seed instructions. */
export const HOME_CATALOG_LOAD_ERROR = 'Não foi possível carregar os produtos agora.';

export type HomeCatalogEmptyCopy = {
  kicker: string;
  title: string;
  body: string;
  whatsappText: string;
  whatsappLabel: string;
  supportHref: '/suporte';
  supportLabel: string;
};

/**
 * Home when GET /products has zero active items.
 * Invites the shopper back. Does not invent SKUs or mention a seed.
 */
export function homeCatalogEmptyCopy(showPreview: boolean): HomeCatalogEmptyCopy {
  return {
    kicker: 'Vitrine',
    title: 'A loja ainda não tem produtos à venda',
    body: showPreview
      ? 'A prévia abaixo não está à venda: sem preço, sem estoque e sem sacola. Avise a loja para ser chamado quando entrar um produto real.'
      : 'Nada à venda nesta página por enquanto. Avise a loja no WhatsApp — a vitrine só publica produtos reais.',
    whatsappText:
      'Olá! Vi a Lojas Schimitz sem produtos na vitrine e quero ser avisado quando a loja tiver itens à venda.',
    whatsappLabel: 'Avise-me no WhatsApp',
    supportHref: '/suporte',
    supportLabel: 'Falar com a loja',
  };
}

export type HomeHeroEmptyCopy = {
  kicker: string;
  title: string;
  accent: string;
  sub: string;
  supportHref: '/suporte';
  supportLabel: string;
  whatsappText: string;
  whatsappLabel: string;
};

/** Fallback hero only when the catalog itself is empty and there is no banner. */
export function homeHeroEmptyCopy(): HomeHeroEmptyCopy {
  return {
    kicker: 'Lojas Schimitz · Porto Alegre',
    title: 'A vitrine está sendo montada.',
    accent: 'Sem produtos de demonstração.',
    sub: 'Quando houver itens reais, o preço, a foto e o estoque aparecem aqui. Frete grátis em POA, PIX e parcelamento continuam valendo.',
    supportHref: '/suporte',
    supportLabel: 'Falar com a loja',
    whatsappText:
      'Olá! Vi o destaque da Lojas Schimitz e quero ser avisado quando a vitrine tiver produtos à venda.',
    whatsappLabel: 'Avise-me no WhatsApp',
  };
}

/** Light path to the existing address form — login first when there is no session. */
export function deliveryAddressHref(loggedIn: boolean): string {
  return loggedIn ? ACCOUNT_ENDERECO_PATH : accountLoginHref(ACCOUNT_ENDERECO_PATH);
}
