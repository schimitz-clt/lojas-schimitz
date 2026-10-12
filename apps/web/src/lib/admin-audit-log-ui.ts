/** Admin → Equipe → Registro de atividades (GET /admin/audit-log). Funções puras e textos. */
export const ADMIN_AUDIT_LOG_API = '/admin/audit-log';
export const ADMIN_AUDIT_LOG_PAGE = 50;

export type AdminAuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  actor: { id: string; name: string | null; email: string | null } | null;
};

export type AdminAuditLogPage = {
  total: number;
  take: number;
  skip: number;
  items: AdminAuditLogItem[];
};

export const ADMIN_AUDIT_LOG_LEDE =
  'Quem fez o quê no painel: alterações de produto (preço, estoque, ativo), pedidos, estornos, cupons, frete, vitrine e equipe. Somente leitura. Senhas, tokens e CPF nunca são gravados.';

export const ADMIN_AUDIT_ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todas as áreas' },
  { value: 'products', label: 'Produtos' },
  { value: 'orders', label: 'Pedidos' },
  { value: 'payments', label: 'Pagamentos / estornos' },
  { value: 'coupons', label: 'Cupons' },
  { value: 'shipping', label: 'Frete' },
  { value: 'banners', label: 'Banners' },
  { value: 'store', label: 'Loja (configurações)' },
  { value: 'admins', label: 'Equipe' },
  { value: 'sellers', label: 'Vendedores' },
  { value: 'commissions', label: 'Comissões' },
  { value: 'reviews', label: 'Avaliações' },
];

const VERB: Record<string, string> = {
  POST: 'Criou / executou',
  PUT: 'Alterou',
  PATCH: 'Alterou',
  DELETE: 'Removeu',
};

const CURATED: Record<string, string> = {
  'product.created': 'Criou produto',
  'product.updated': 'Alterou produto',
  'catalog.import': 'Importou planilha de catálogo',
  'catalog.batch': 'Alterou produtos em lote',
  'order.refunded': 'Estorno concluído',
  'admin.user.create': 'Criou administrador',
  'admin.user.promote': 'Promoveu a administrador',
};

/** "admin.http.PATCH /api/v1/admin/products/:id" → "Alterou · products/:id" */
export function auditActionLabel(action: string): string {
  if (CURATED[action]) return CURATED[action];
  const m = action.match(/^admin\.http\.([A-Z]+) (.+)$/);
  if (!m) return action;
  const path = m[2].replace(/^\/?(api\/v1\/)?admin\//, '');
  return `${VERB[m[1]] || m[1]} · ${path}`;
}

export function auditActorLabel(actor: AdminAuditLogItem['actor']): string {
  if (!actor) return 'Sistema';
  return actor.name || actor.email || actor.id.slice(0, 8);
}

const FIELD_PT: Record<string, string> = {
  price: 'preço',
  compareAtPrice: 'preço "de"',
  stock: 'estoque',
  active: 'ativo',
  name: 'nome',
  sku: 'SKU',
  badge: 'selo',
};

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return String(v);
}

/** Resumo curto "preço 100 → 79.9; estoque 10 → 3" para linhas de produto; senão ''. */
export function auditChangesSummary(meta: AdminAuditLogItem['meta']): string {
  const changes = meta && typeof meta === 'object' ? (meta as { changes?: unknown }).changes : null;
  if (!changes || typeof changes !== 'object') return '';
  return Object.entries(changes as Record<string, { from?: unknown; to?: unknown }>)
    .map(([k, v]) => `${FIELD_PT[k] || k} ${fmt(v?.from)} → ${fmt(v?.to)}`)
    .join('; ');
}

export function auditOutcomeLabel(meta: AdminAuditLogItem['meta']): string {
  const o = meta && typeof meta === 'object' ? (meta as { outcome?: unknown; status?: unknown }) : null;
  if (o?.outcome === 'error') return `falhou${o.status ? ` (${String(o.status)})` : ''}`;
  return '';
}

export function auditLogQueryString(f: { entity: string; action: string; skip: number; take?: number }): string {
  const p = new URLSearchParams();
  if (f.entity) p.set('entity', f.entity);
  if (f.action.trim()) p.set('action', f.action.trim());
  p.set('take', String(f.take ?? ADMIN_AUDIT_LOG_PAGE));
  if (f.skip > 0) p.set('skip', String(f.skip));
  return p.toString();
}
