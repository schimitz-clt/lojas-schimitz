/**
 * Admin console section routing — App Router paths under /admin/...
 * Legacy ?section= / ?tab= and photo-queue hashes still parse for redirects.
 */

export const ADMIN_BASE_PATH = '/admin';

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

/** Query/path aliases kept for bookmarks and muscle memory. */
const SECTION_ALIASES: Record<string, AdminSectionId> = {
  home: 'ops',
  comando: 'ops',
  command: 'ops',
  recon: 'ops',
  reconciliations: 'ops',
  reconciliacao: 'ops',
  orders: 'pedidos',
  order: 'pedidos',
  fila: 'pedidos',
  products: 'catalogo',
  product: 'catalogo',
  estoque: 'catalogo',
  customers: 'clientes',
  crm: 'clientes',
  sales: 'vendas',
  report: 'vendas',
  relatorio: 'vendas',
  shipping: 'frete',
  entrega: 'frete',
  coupons: 'cupons',
  coupon: 'cupons',
  banners: 'vitrine',
  seo: 'vitrine',
  store: 'vitrine',
  reviews: 'avaliacoes',
  review: 'avaliacoes',
  sellers: 'marketplace',
  seller: 'marketplace',
  commissions: 'marketplace',
  admins: 'equipe',
  admin: 'equipe',
  team: 'equipe',
};

export function isAdminSectionId(value: unknown): value is AdminSectionId {
  return typeof value === 'string' && (ADMIN_SECTION_IDS as readonly string[]).includes(value);
}

/** Normalize query/hash/manual input → valid section (default ops). */
export function parseAdminSection(raw: string | null | undefined): AdminSectionId {
  if (raw == null) return DEFAULT_ADMIN_SECTION;
  const v = String(raw).trim().toLowerCase();
  if (!v) return DEFAULT_ADMIN_SECTION;
  if (v in SECTION_ALIASES) return SECTION_ALIASES[v];
  if (isAdminSectionId(v)) return v;
  return DEFAULT_ADMIN_SECTION;
}

export function adminSectionLabel(id: AdminSectionId): string {
  const item = ADMIN_NAV_ITEMS.find((n) => n.id === id);
  return item?.label ?? id;
}

/** Canonical pathname for a section. Ops lives at /admin (not /admin/ops). */
export function adminSectionPath(section: AdminSectionId): string {
  return section === DEFAULT_ADMIN_SECTION ? ADMIN_BASE_PATH : `${ADMIN_BASE_PATH}/${section}`;
}

function normalizePathname(pathname: string | null | undefined): string {
  const raw = String(pathname || '').trim() || '/';
  if (raw === '/') return '/';
  return raw.replace(/\/+$/, '') || '/';
}

/**
 * Read section from an App Router pathname (`/admin`, `/admin/pedidos`).
 * Unknown /admin/<alias> values use parseAdminSection (orders → pedidos).
 */
export function sectionFromPathname(pathname: string | null | undefined): AdminSectionId {
  const path = normalizePathname(pathname);
  if (path === ADMIN_BASE_PATH) return DEFAULT_ADMIN_SECTION;
  if (!path.startsWith(`${ADMIN_BASE_PATH}/`)) return DEFAULT_ADMIN_SECTION;
  const rest = path.slice(ADMIN_BASE_PATH.length + 1);
  const first = rest.split('/')[0] || '';
  return parseAdminSection(first);
}

function searchParamsFrom(search: string | URLSearchParams | Record<string, string> | null | undefined) {
  if (!search) return new URLSearchParams();
  if (search instanceof URLSearchParams) return new URLSearchParams(search);
  if (typeof search === 'string') {
    const raw = search.startsWith('?') ? search.slice(1) : search;
    return new URLSearchParams(raw);
  }
  return new URLSearchParams(Object.entries(search));
}

const NAV_NOISE_KEYS = ['section', 'tab'] as const;

/**
 * Build pathname+search for Admin section navigation.
 * Ops is `/admin`; other sections are `/admin/<id>`. Extra params (customer, order, photos) stay.
 */
export function buildAdminSectionHref(
  section: AdminSectionId,
  opts?: { pathname?: string; keepParams?: URLSearchParams | Record<string, string> | null },
): string {
  const pathname = opts?.pathname || adminSectionPath(section);
  const params = searchParamsFrom(opts?.keepParams);
  for (const key of NAV_NOISE_KEYS) params.delete(key);
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

const PHOTO_HASHES = new Set([
  'admin-photo-queue',
  'photos',
  'photo',
  'fotos',
  'foto',
  'admin-photos-checklist',
]);

/** Legacy in-page hash for the catalog photo queue. */
export function isPhotoQueueHash(hash: string | null | undefined): boolean {
  const h = String(hash || '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase();
  return PHOTO_HASHES.has(h);
}

const PHOTO_QUERY_TRUTHY = new Set(['1', 'true', 'yes', 'fotos', 'foto', 'photos', 'photo', 'queue']);

/** Deep-link: /admin/catalogo?photos=1 (also fila=fotos / queue=photos). */
export function photosQueueFromSearch(search: string | URLSearchParams | null | undefined): boolean {
  if (!search) return false;
  try {
    const params = search instanceof URLSearchParams ? search : searchParamsFrom(search);
    for (const key of ['photos', 'photo', 'fila', 'queue']) {
      const v = (params.get(key) || '').trim().toLowerCase();
      if (v && PHOTO_QUERY_TRUTHY.has(v)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function buildAdminCatalogoPhotosHref(): string {
  return buildAdminSectionHref('catalogo', { keepParams: { photos: '1' } });
}

/**
 * Canonical location (pathname + search, no hash) for a request, or null if already canonical.
 * Used by middleware (query/path) and a client effect (hash — servers never see #).
 */
export function legacyAdminRedirect(input: {
  pathname?: string | null;
  search?: string | URLSearchParams | null;
  hash?: string | null;
}): string | null {
  const pathname = normalizePathname(input.pathname);
  if (pathname !== ADMIN_BASE_PATH && !pathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return null;
  }

  const params = searchParamsFrom(input.search);
  const legacySectionRaw = params.get('section') || params.get('tab');
  const hashPhotos = isPhotoQueueHash(input.hash);
  const queryPhotos = photosQueueFromSearch(params);

  let section = sectionFromPathname(pathname);
  if (legacySectionRaw != null && String(legacySectionRaw).trim()) {
    section = parseAdminSection(legacySectionRaw);
  }
  if (hashPhotos) section = 'catalogo';

  const nextParams = new URLSearchParams(params);
  for (const key of NAV_NOISE_KEYS) nextParams.delete(key);
  if (hashPhotos && !queryPhotos) nextParams.set('photos', '1');

  const nextPath = adminSectionPath(section);
  const qs = nextParams.toString();
  const next = qs ? `${nextPath}?${qs}` : nextPath;
  const currentQs = params.toString();
  const current = currentQs ? `${pathname}?${currentQs}` : pathname;
  if (next === current && !hashPhotos) return null;
  if (next === current && hashPhotos) {
    // Drop the hash even if path+query already match (client-only).
    return next;
  }
  return next;
}

/** Safe `?next=` target after admin auth failure (same-origin path only). */
export function adminLoginNextPath(pathname?: string | null, search?: string | null): string {
  const redirected = legacyAdminRedirect({ pathname, search });
  if (redirected) return redirected;
  const path = normalizePathname(pathname);
  const safePath = path === ADMIN_BASE_PATH || path.startsWith(`${ADMIN_BASE_PATH}/`) ? path : ADMIN_BASE_PATH;
  const params = searchParamsFrom(search);
  for (const key of NAV_NOISE_KEYS) params.delete(key);
  const qs = params.toString();
  return qs ? `${safePath}?${qs}` : safePath;
}

export function adminEntrarHref(nextPath = ADMIN_BASE_PATH): string {
  return `/entrar?next=${encodeURIComponent(nextPath)}`;
}

/** PT label for Admin header logout — same wording as Conta. */
export const ADMIN_LOGOUT_LABEL = 'Sair';

/**
 * After explicit Admin logout: `/entrar?next=/admin` (email/password gate).
 * Conta lands on `/`; Admin uses the login form so the owner must sign in
 * again to re-enter the console, then returns to `/admin`.
 */
export function adminLogoutHref(): string {
  return adminEntrarHref(ADMIN_BASE_PATH);
}

/** All first-class App Router paths (for smoke / nav). */
export function adminAppRoutePaths(): string[] {
  return ADMIN_SECTION_IDS.map((id) => adminSectionPath(id));
}
