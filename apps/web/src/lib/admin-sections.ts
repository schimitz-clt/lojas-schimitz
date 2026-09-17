/**
 * Admin console section routing (?section=) — pure helpers, no DOM.
 * Default section is Ops (command center). Unknown values fall back to ops.
 */

export const ADMIN_SECTION_IDS = [
  'ops',
  'pedidos',
  'catalogo',
  'clientes',
  'vendas',
  'frete',
  'cupons',
  'vitrine',
  'avaliacoes',
  'marketplace',
  'equipe',
] as const;

export type AdminSectionId = (typeof ADMIN_SECTION_IDS)[number];

export type AdminNavItem = {
  id: AdminSectionId;
  label: string;
  /** Short PT subtitle for sidebar / mobile */
  description: string;
  /** Optional badge key for live counts (wired by page) */
  badgeKey?: 'paid' | 'recon' | 'lowStock' | 'alerts';
};

/** Sidebar / mobile nav — Portuguese labels, business console tone. */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { id: 'ops', label: 'Ops', description: 'Centro de comando', badgeKey: 'alerts' },
  { id: 'pedidos', label: 'Pedidos', description: 'Fila e Separar', badgeKey: 'paid' },
  { id: 'catalogo', label: 'Catálogo', description: 'Produtos e estoque', badgeKey: 'lowStock' },
  { id: 'clientes', label: 'Clientes', description: 'CRM' },
  { id: 'vendas', label: 'Vendas', description: 'Relatório' },
  { id: 'frete', label: 'Frete', description: 'Entrega própria' },
  { id: 'cupons', label: 'Cupons', description: 'Descontos' },
  { id: 'vitrine', label: 'Vitrine', description: 'Banners e SEO' },
  { id: 'avaliacoes', label: 'Avaliações', description: 'Moderação' },
  { id: 'marketplace', label: 'Marketplace', description: 'Vendedores' },
  { id: 'equipe', label: 'Equipe', description: 'Administradores' },
] as const;

export const DEFAULT_ADMIN_SECTION: AdminSectionId = 'ops';

export function isAdminSectionId(value: unknown): value is AdminSectionId {
  return typeof value === 'string' && (ADMIN_SECTION_IDS as readonly string[]).includes(value);
}

/** Normalize query/hash/manual input → valid section (default ops). */
export function parseAdminSection(raw: string | null | undefined): AdminSectionId {
  if (raw == null) return DEFAULT_ADMIN_SECTION;
  const v = String(raw).trim().toLowerCase();
  if (!v || v === 'home' || v === 'comando' || v === 'command') return DEFAULT_ADMIN_SECTION;
  // Aliases for deep links / muscle memory
  if (v === 'orders' || v === 'order' || v === 'fila') return 'pedidos';
  if (v === 'products' || v === 'product' || v === 'estoque') return 'catalogo';
  if (v === 'customers' || v === 'crm') return 'clientes';
  if (v === 'sales' || v === 'report' || v === 'relatorio') return 'vendas';
  if (v === 'shipping' || v === 'entrega') return 'frete';
  if (v === 'coupons' || v === 'coupon') return 'cupons';
  if (v === 'banners' || v === 'seo' || v === 'store') return 'vitrine';
  if (v === 'reviews' || v === 'review') return 'avaliacoes';
  if (v === 'sellers' || v === 'seller' || v === 'commissions') return 'marketplace';
  if (v === 'admins' || v === 'admin' || v === 'team') return 'equipe';
  if (v === 'recon' || v === 'reconciliations' || v === 'reconciliacao') return 'ops';
  if (isAdminSectionId(v)) return v;
  return DEFAULT_ADMIN_SECTION;
}

export function adminSectionLabel(id: AdminSectionId): string {
  const item = ADMIN_NAV_ITEMS.find((n) => n.id === id);
  return item?.label ?? id;
}

/**
 * Build pathname+search for Admin section navigation.
 * Ops is default — omit ?section= for cleaner URL (still accepts ?section=ops).
 */
export function buildAdminSectionHref(
  section: AdminSectionId,
  opts?: { pathname?: string; keepParams?: URLSearchParams | Record<string, string> | null },
): string {
  const pathname = opts?.pathname || '/admin';
  const params = new URLSearchParams(
    opts?.keepParams instanceof URLSearchParams
      ? opts.keepParams
      : opts?.keepParams
        ? Object.entries(opts.keepParams)
        : undefined,
  );
  // Drop legacy noise; section is the only nav param we own here.
  params.delete('section');
  params.delete('tab');
  if (section !== DEFAULT_ADMIN_SECTION) {
    params.set('section', section);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Read section from a querystring or full search ("?section=pedidos" or "section=pedidos"). */
export function sectionFromSearch(search: string | null | undefined): AdminSectionId {
  if (!search) return DEFAULT_ADMIN_SECTION;
  const raw = search.startsWith('?') ? search.slice(1) : search;
  try {
    const params = new URLSearchParams(raw);
    return parseAdminSection(params.get('section') || params.get('tab'));
  } catch {
    return DEFAULT_ADMIN_SECTION;
  }
}
