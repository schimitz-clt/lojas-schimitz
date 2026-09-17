/**
 * Admin Ciclo C — Clientes CRM leve. Pure helpers, no DOM/network.
 */
import { buildAdminSectionHref } from './admin-sections';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAdminRecordId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

function paramFromSearch(
  search: string | null | undefined,
  keys: string[],
): string | null {
  if (!search) return null;
  const raw = search.startsWith('?') ? search.slice(1) : search;
  try {
    const params = new URLSearchParams(raw);
    for (const key of keys) {
      const v = params.get(key);
      if (isAdminRecordId(v)) return v.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/** Deep-link: /admin?section=clientes&customer=<uuid> */
export function customerIdFromSearch(search: string | null | undefined): string | null {
  return paramFromSearch(search, ['customer', 'cliente']);
}

/** Deep-link: /admin?section=pedidos&order=<uuid> */
export function orderIdFromSearch(search: string | null | undefined): string | null {
  return paramFromSearch(search, ['order', 'pedido']);
}

export function buildAdminCustomerHref(customerId?: string | null): string {
  const id = (customerId || '').trim();
  if (!isAdminRecordId(id)) return buildAdminSectionHref('clientes');
  return buildAdminSectionHref('clientes', { keepParams: { customer: id } });
}

export function buildAdminPedidoHref(orderId?: string | null): string {
  const id = (orderId || '').trim();
  if (!isAdminRecordId(id)) return buildAdminSectionHref('pedidos');
  return buildAdminSectionHref('pedidos', { keepParams: { order: id } });
}

export type CustomerAddressLike = {
  label?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  uf?: string | null;
  cep?: string | null;
  isDefault?: boolean;
};

export function formatCep(cep?: string | null): string {
  const d = String(cep || '').replace(/\D/g, '');
  if (d.length !== 8) return String(cep || '').trim();
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatCustomerCityUf(
  a: { city?: string | null; uf?: string | null } | null | undefined,
): string {
  if (!a) return '';
  return [a.city?.trim(), a.uf?.trim()].filter(Boolean).join('/');
}

export function formatCustomerAddressLine(
  a: CustomerAddressLike | null | undefined,
): string {
  if (!a) return '';
  const street = [a.street?.trim(), a.number?.trim()].filter(Boolean).join(', ');
  const extra = [a.complement?.trim(), a.district?.trim()].filter(Boolean).join(' · ');
  const city = formatCustomerCityUf(a);
  const cep = a.cep?.trim() ? `CEP ${formatCep(a.cep)}` : '';
  return [street, extra, city, cep].filter(Boolean).join(' — ');
}

export function pickPrimaryCustomerAddress<T extends { isDefault?: boolean }>(
  addresses: T[] | null | undefined,
): T | null {
  const list = addresses || [];
  if (!list.length) return null;
  return list.find((x) => x.isDefault) || list[0];
}

export function customerOrderPaymentLabel(method?: string | null): string {
  const m = String(method || '')
    .trim()
    .toLowerCase();
  if (!m) return '—';
  if (m === 'pix') return 'PIX';
  if (m === 'card' || m === 'credit_card' || m === 'debit_card' || m.includes('card')) {
    return 'Cartão';
  }
  if (m === 'boleto') return 'Boleto';
  if (m === 'wallet') return 'Carteira';
  return method!.trim();
}

export function formatAdminDateTime(iso?: string | Date | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

export function formatAdminDate(iso?: string | Date | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function customerHistoryEmptyMessage(hasSearch: boolean): string {
  return hasSearch
    ? 'Nenhum cliente encontrado para essa busca.'
    : 'Nenhum cliente cadastrado.';
}

export function customerOrdersEmptyMessage(): string {
  return 'Sem pedidos neste cliente.';
}

export function customerVerClienteLabel(hasUser: boolean): string {
  return hasUser ? 'Ver cliente' : 'Cliente sem cadastro';
}
