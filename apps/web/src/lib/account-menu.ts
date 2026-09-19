/**
 * Customer account hub (Minha conta) — Magalu-like sectioned menu.
 * Display helpers only. Links go to existing storefront routes / WhatsApp.
 * No Magalu trademarks, no invented backends.
 */

import { DEFAULT_STORE_WHATSAPP, storeWhatsAppDigits, waMeUrl } from '@/lib/whatsapp';
import { loginNextPath } from '@/lib/order-recovery';

export type AccountIconId =
  | 'orders'
  | 'recent'
  | 'profile'
  | 'heart'
  | 'bell'
  | 'logout'
  | 'whatsapp'
  | 'support'
  | 'admin'
  | 'seller';

export type AccountMenuItem = {
  id: string;
  label: string;
  href: string;
  icon: AccountIconId;
  external?: boolean;
  action?: 'logout';
};

export type AccountMenuSection = {
  id: string;
  title: string;
  items: AccountMenuItem[];
};

export type AccountMenuUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
} | null;

export const ACCOUNT_HUB_TITLE = 'Sua conta';
export const ACCOUNT_DADOS_PATH = '/conta/dados';
export const ACCOUNT_VISTOS_PATH = '/conta/vistos';
export const ACCOUNT_EDIT_ADDRESS_CTA = 'Alterar endereço';
export const ACCOUNT_WHATSAPP_HELP_TEXT =
  'Olá, vim pela Minha conta da Lojas Schimitz e preciso de atendimento.';

export type AccountAddressForm = {
  label: string;
  cep: string;
  street: string;
  number: string;
  district: string;
  city: string;
  uf: string;
};

export type AccountAddressRecord = {
  id: string;
  label?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  uf?: string | null;
  isDefault?: boolean;
};

/** Show the address form for first cadastro, or after the user asks to edit a saved one. */
export function accountAddressFormOpen(opts: {
  loaded: boolean;
  addressCount: number;
  userRequestedEdit: boolean;
}): boolean {
  if (!opts.loaded) return false;
  if (opts.addressCount < 1) return true;
  return opts.userRequestedEdit;
}

/** Prefer the default address, otherwise the first in the list (API already sorts default first). */
export function accountAddressToEdit<T extends { id?: string; isDefault?: boolean }>(
  addresses: T[] | null | undefined,
): T | null {
  const list = addresses || [];
  if (!list.length) return null;
  return list.find((a) => Boolean(a.isDefault)) ?? list[0];
}

export function emptyAccountAddressForm(): AccountAddressForm {
  return {
    label: 'Casa',
    cep: '',
    street: '',
    number: '',
    district: '',
    city: '',
    uf: 'RS',
  };
}

export function accountAddressFormFrom(
  addr: AccountAddressRecord | null | undefined,
): AccountAddressForm {
  if (!addr) return emptyAccountAddressForm();
  return {
    label: (addr.label || '').trim() || 'Casa',
    cep: addr.cep || '',
    street: addr.street || '',
    number: addr.number || '',
    district: addr.district || '',
    city: addr.city || '',
    uf: (addr.uf || 'RS').toUpperCase(),
  };
}

/** First cadastro POSTs; editing a saved address uses the existing PATCH /me/addresses/:id. */
export function accountAddressSaveRequest(editingId: string | null | undefined): {
  path: string;
  method: 'POST' | 'PATCH';
} {
  const id = typeof editingId === 'string' ? editingId.trim() : '';
  if (id) return { path: `/me/addresses/${id}`, method: 'PATCH' };
  return { path: '/me/addresses', method: 'POST' };
}

/** First name for greeting — never invent a person. */
export function accountFirstName(user: AccountMenuUser): string {
  const name = typeof user?.name === 'string' ? user.name.trim() : '';
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  if (first && first.toLowerCase() !== 'admin') return first;
  if (parts[1]) return parts[1];
  const local = typeof user?.email === 'string' ? user.email.split('@')[0]?.trim() : '';
  return local || '';
}

export function accountGreeting(user: AccountMenuUser): { title: string; subtitle: string } {
  if (!user) {
    return {
      title: 'Olá',
      subtitle: 'Entre para ver pedidos, dados e cashback SCHIMITZ+.',
    };
  }
  const first = accountFirstName(user);
  return {
    title: first ? `Olá, ${first}` : 'Olá',
    subtitle: typeof user.email === 'string' && user.email.trim() ? user.email.trim() : 'Sua conta Lojas Schimitz',
  };
}

export function accountLoginHref(nextPath = '/conta'): string {
  return loginNextPath(nextPath);
}

export function accountWhatsAppHref(
  text = ACCOUNT_WHATSAPP_HELP_TEXT,
  envPhone?: string | null,
): string {
  const digits = storeWhatsAppDigits(envPhone) || DEFAULT_STORE_WHATSAPP;
  return waMeUrl(digits, text);
}

export type AccountMenuOptions = {
  loggedIn: boolean;
  /** Accepted for callers; Conta hub never lists staff rows from role. */
  role?: string | null;
  whatsappHref: string;
};

/**
 * Sectioned hub rows. Guest still gets useful links + Entrar is rendered by the page.
 * Auth-gated destinations use /entrar?next= so the row is never a dead end.
 * Customer-only: never list Admin da loja or Portal do vendedor (staff uses /admin and /vendedor directly).
 */
export function accountMenuSections(opts: AccountMenuOptions): AccountMenuSection[] {
  const loggedIn = Boolean(opts.loggedIn);
  const ordersHref = loggedIn ? '/pedidos' : accountLoginHref('/pedidos');
  const dadosHref = loggedIn ? ACCOUNT_DADOS_PATH : accountLoginHref(ACCOUNT_DADOS_PATH);
  const notifHref = loggedIn ? '/notificacoes' : accountLoginHref('/notificacoes');

  const pedidos: AccountMenuSection = {
    id: 'pedidos',
    title: 'Pedidos',
    items: [
      { id: 'orders', label: 'Meus pedidos', href: ordersHref, icon: 'orders' },
      {
        id: 'recent',
        label: 'Últimos produtos vistos',
        href: ACCOUNT_VISTOS_PATH,
        icon: 'recent',
      },
    ],
  };

  const contaItems: AccountMenuItem[] = [
    { id: 'profile', label: 'Dados pessoais', href: dadosHref, icon: 'profile' },
    { id: 'favorites', label: 'Favoritos', href: '/favoritos', icon: 'heart' },
    { id: 'notifications', label: 'Notificações', href: notifHref, icon: 'bell' },
  ];
  if (loggedIn) {
    contaItems.push({
      id: 'logout',
      label: 'Sair',
      href: '#sair',
      icon: 'logout',
      action: 'logout',
    });
  }

  const ajuda: AccountMenuSection = {
    id: 'ajuda',
    title: 'Ajuda',
    items: [
      {
        id: 'whatsapp',
        label: 'WhatsApp atendimento',
        href: opts.whatsappHref,
        icon: 'whatsapp',
        external: true,
      },
      { id: 'support', label: 'Central de atendimento', href: '/suporte', icon: 'support' },
    ],
  };

  return [pedidos, { id: 'conta', title: 'Conta', items: contaItems }, ajuda];
}

export function recentVistosEmptyCopy(): { title: string; body: string; ctaHref: string; ctaLabel: string } {
  return {
    title: 'Nenhum produto visto ainda',
    body: 'Os produtos que você abrir na loja aparecem aqui para você voltar rápido.',
    ctaHref: '/produtos',
    ctaLabel: 'Ver produtos',
  };
}
