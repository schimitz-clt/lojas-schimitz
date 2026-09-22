/**
 * Home Lote 1 — Magalu-like structure, Schimitz routes only.
 * Display helpers. No new address or coupon APIs.
 */

import { accountAddressToEdit, accountLoginHref, type AccountAddressRecord } from '@/lib/account-menu';
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
  /** Saved street/city row opens the account address page. */
  accountHref: '/conta/dados' | null;
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
      accountHref: '/conta/dados',
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

/** Light path to the existing address form — login first when there is no session. */
export function deliveryAddressHref(loggedIn: boolean): string {
  return loggedIn ? '/conta/dados' : accountLoginHref('/conta/dados');
}
