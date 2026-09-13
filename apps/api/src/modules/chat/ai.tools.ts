/**
 * Controlled tools — server-side only. The LLM never receives SQL or raw Prisma.
 * Private order tools are gated by JWT userId; guest never sees another customer's data.
 */

import { pixChargeAmount } from '../../common/pricing';
import { rewritePublicUploadUrl } from '../../common/public-upload-url';
import { sameOwner } from '../../common/ownership';
import { availableQty } from '../inventory/inventory.math';
import { primaryImageUrl } from '../catalog/product.serialize';
import { buildProductWhere } from '../catalog/catalog.query';
import { normalizeCep } from '../shipping/shipping.rules';
import type { PrismaService } from '../../prisma.service';
import type { ShippingService } from '../shipping/shipping.service';
import type { ChatProductHit } from './chat.dto';
import { storePolicies } from './chat.facts';
import {
  sanitizeBudget,
  sanitizeCep,
  sanitizePublicOrderId,
  sanitizeSlug,
  sanitizeToolQuery,
  sanitizeUuid,
} from './ai.security';
import { normalizeForSearch } from './chat.intent';
import type { AiToolSpec } from './ai.provider';

const PRODUCT_SLUG_ALIASES: Record<string, string> = {
  'ar-condicionado-aiwa': 'ar-condicionado-aiwa-2',
};

export const ALFA_PUBLIC_TOOLS = [
  'searchProducts',
  'getProduct',
  'compareProducts',
  'checkAvailability',
  'getStorePolicies',
  'getShippingEstimate',
] as const;

export const BETA_PRIVATE_TOOLS = ['getOrderStatus', 'getCustomerOrders'] as const;

export const ALL_TOOL_NAMES = [...ALFA_PUBLIC_TOOLS, ...BETA_PRIVATE_TOOLS] as const;
export type ToolName = (typeof ALL_TOOL_NAMES)[number];

export type ToolContext = {
  userId?: string | null;
  prisma: Pick<PrismaService, 'product' | 'order'>;
  shipping?: Pick<ShippingService, 'quoteDetailed'> | null;
};

export type ToolResult = {
  name: string;
  ok: boolean;
  code: string;
  data: unknown;
};

export type PublicOrderSnap = {
  publicId: string;
  status: string;
  total: number;
  trackingCode: string | null;
  carrier: string | null;
  createdAt: string;
};

export function isKnownTool(name: string): name is ToolName {
  return (ALL_TOOL_NAMES as readonly string[]).includes(name);
}

export function isPrivateTool(name: string): boolean {
  return (BETA_PRIVATE_TOOLS as readonly string[]).includes(name);
}

/** Alfa: LLM may only see public catalog/policy tools — never private order tools. */
export function toolsExposedToLlm(): AiToolSpec[] {
  return [
    {
      type: 'function',
      function: {
        name: 'searchProducts',
        description: 'Busca produtos ativos no catálogo real (query, categoria, orçamento).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            category: { type: 'string' },
            budgetMax: { type: 'number' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getProduct',
        description: 'Detalhe de um produto ativo por slug ou id. Não inventa se não existir.',
        parameters: {
          type: 'object',
          properties: { ref: { type: 'string', description: 'slug ou uuid' } },
          required: ['ref'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'compareProducts',
        description: 'Compara 2 ou 3 produtos reais por slug/id.',
        parameters: {
          type: 'object',
          properties: { refs: { type: 'array', items: { type: 'string' } } },
          required: ['refs'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'checkAvailability',
        description: 'Estoque público (em estoque / esgotado) de um produto ativo.',
        parameters: {
          type: 'object',
          properties: { ref: { type: 'string' } },
          required: ['ref'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getStorePolicies',
        description: 'Fatos estáticos da loja (PIX, frete, troca). Não inventa regras.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getShippingEstimate',
        description: 'Cotação real por CEP via API de frete da loja. Sem CEP retorna NEED_CEP.',
        parameters: {
          type: 'object',
          properties: { cep: { type: 'string' }, subtotal: { type: 'number' } },
        },
      },
    },
  ];
}

export function toProductHit(p: {
  id: string;
  name: string;
  slug: string;
  price: unknown;
  compareAtPrice?: unknown;
  badge?: string | null;
  images?: { url?: string | null; position?: number }[];
  inventory?: { qtyOnHand: number; qtyReserved: number } | null;
}): ChatProductHit {
  const price = Number(p.price);
  const onHand = p.inventory?.qtyOnHand ?? 0;
  const reserved = p.inventory?.qtyReserved ?? 0;
  const image = rewritePublicUploadUrl(primaryImageUrl(p.images));
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price,
    pixPrice: pixChargeAmount(price),
    compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice),
    badge: p.badge ?? null,
    inStock: availableQty(onHand, reserved) > 0,
    path: `/produto/${p.slug}`,
    image,
  };
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  badge: true,
  images: { orderBy: { position: 'asc' as const }, take: 1, select: { url: true, position: true } },
  inventory: { select: { qtyOnHand: true, qtyReserved: true } },
};

const SEARCH_SELECT = {
  ...PRODUCT_SELECT,
  description: true,
  sku: true,
};

function searchTokens(query: string): string[] {
  return normalizeForSearch(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function rowMatchesTokens(
  row: { name: string; description?: string | null; sku?: string | null; slug?: string },
  tokens: string[],
): boolean {
  if (!tokens.length) return true;
  const hay = normalizeForSearch(
    [row.name, row.description || '', row.sku || '', row.slug || ''].join(' '),
  );
  return tokens.every((t) => hay.includes(t));
}

async function findActiveProduct(prisma: ToolContext['prisma'], ref: string) {
  const slug = sanitizeSlug(ref);
  const id = sanitizeUuid(ref);
  const alias = slug ? PRODUCT_SLUG_ALIASES[slug] : undefined;
  const or = [
    ...(id ? [{ id }] : []),
    ...(slug ? [{ slug }] : []),
    ...(alias ? [{ slug: alias }] : []),
    ...(!id && !slug && ref.trim().length >= 2
      ? [{ name: { equals: ref.trim(), mode: 'insensitive' as const } }]
      : []),
  ];
  if (!or.length) return null;
  return prisma.product.findFirst({
    where: { active: true, OR: or },
    select: PRODUCT_SELECT,
  });
}

export function gatePrivateOrder(actorUserId?: string | null): { ok: true; userId: string } | { ok: false; code: 'LOGIN_REQUIRED' } {
  const id = typeof actorUserId === 'string' ? actorUserId.trim() : '';
  if (!id) return { ok: false, code: 'LOGIN_REQUIRED' };
  return { ok: true, userId: id };
}

export function resolveOwnedOrder<T extends { userId?: string | null }>(
  actorUserId: string,
  order: T | null,
): { ok: true; order: T } | { ok: false; code: 'ORDER_NOT_FOUND' } {
  if (!order || !sameOwner(actorUserId, order.userId)) {
    return { ok: false, code: 'ORDER_NOT_FOUND' };
  }
  return { ok: true, order };
}

async function fetchSearchCandidates(
  ctx: ToolContext,
  opts: { fetchQ?: string; category?: string; budgetMax?: number; take?: number },
) {
  const where = buildProductWhere({
    q: opts.fetchQ || undefined,
    category: opts.category,
    maxPrice: opts.budgetMax != null ? String(opts.budgetMax) : undefined,
  });
  return ctx.prisma.product.findMany({
    where,
    select: SEARCH_SELECT,
    take: opts.take ?? 24,
    orderBy: [{ ratingCount: 'desc' }, { updatedAt: 'desc' }],
  });
}

async function toolSearchProducts(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const query = sanitizeToolQuery(args.query ?? args.q, 80);
  const category = sanitizeSlug(args.category) || undefined;
  const budgetMax = sanitizeBudget(args.budgetMax ?? args.maxPrice);
  if (!query && !category && budgetMax == null) {
    return { name: 'searchProducts', ok: false, code: 'NEED_QUERY', data: { products: [] } };
  }

  const tokens = query ? searchTokens(query) : [];
  // Broad Prisma fetch on first token (accent-safe later via in-memory filter).
  const fetchQ = tokens[0] || query || undefined;

  const filterRows = (
    rows: Awaited<ReturnType<typeof fetchSearchCandidates>>,
  ) => (tokens.length ? rows.filter((r) => rowMatchesTokens(r, tokens)) : rows);

  let rows = await fetchSearchCandidates(ctx, {
    fetchQ,
    category,
    budgetMax: budgetMax ?? undefined,
    take: 24,
  });
  let matched = filterRows(rows);

  // Category must never hard-kill relevant hits — retry global with same query/budget.
  if (category && matched.length === 0) {
    rows = await fetchSearchCandidates(ctx, {
      fetchQ,
      category: undefined,
      budgetMax: budgetMax ?? undefined,
      take: 24,
    });
    matched = filterRows(rows);
  }

  // Accent-only / second-token miss: broader fetch without text q, filter in memory.
  if (matched.length === 0 && tokens.length) {
    rows = await fetchSearchCandidates(ctx, {
      fetchQ: undefined,
      category: undefined,
      budgetMax: budgetMax ?? undefined,
      take: 48,
    });
    matched = filterRows(rows);
  }

  const products = matched.slice(0, 4).map(toProductHit);
  return { name: 'searchProducts', ok: true, code: products.length ? 'OK' : 'EMPTY', data: { products } };
}

async function toolGetProduct(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const ref = typeof args.ref === 'string' ? args.ref : typeof args.slug === 'string' ? args.slug : typeof args.id === 'string' ? args.id : '';
  const row = ref ? await findActiveProduct(ctx.prisma, ref) : null;
  if (!row) {
    return { name: 'getProduct', ok: false, code: 'NOT_FOUND', data: { product: null } };
  }
  return { name: 'getProduct', ok: true, code: 'OK', data: { product: toProductHit(row) } };
}

async function resolveRefForCompare(
  ctx: ToolContext,
  ref: string,
): Promise<
  | { kind: 'hit'; row: NonNullable<Awaited<ReturnType<typeof findActiveProduct>>> }
  | { kind: 'ambiguous'; rows: Awaited<ReturnType<typeof fetchSearchCandidates>> }
  | { kind: 'miss' }
> {
  const exact = await findActiveProduct(ctx.prisma, ref);
  if (exact) return { kind: 'hit', row: exact };

  const tokens = searchTokens(ref);
  if (!tokens.length) return { kind: 'miss' };

  let rows = await fetchSearchCandidates(ctx, { fetchQ: tokens[0], take: 24 });
  let matched = rows.filter((r) => rowMatchesTokens(r, tokens));
  if (!matched.length) {
    rows = await fetchSearchCandidates(ctx, { fetchQ: undefined, take: 48 });
    matched = rows.filter((r) => rowMatchesTokens(r, tokens));
  }
  if (matched.length === 1) return { kind: 'hit', row: matched[0] };
  if (matched.length > 1) return { kind: 'ambiguous', rows: matched.slice(0, 5) };
  return { kind: 'miss' };
}

async function toolCompare(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const raw = Array.isArray(args.refs) ? args.refs : Array.isArray(args.ids) ? args.ids : [];
  const refs = raw.map((r) => String(r || '').trim()).filter(Boolean).slice(0, 3);
  if (refs.length < 2) {
    return { name: 'compareProducts', ok: false, code: 'NEED_TWO', data: { products: [] } };
  }

  const products: ChatProductHit[] = [];
  const ambiguous: ChatProductHit[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const resolved = await resolveRefForCompare(ctx, ref);
    if (resolved.kind === 'hit') {
      const hit = toProductHit(resolved.row);
      if (!seen.has(hit.slug)) {
        seen.add(hit.slug);
        products.push(hit);
      }
    } else if (resolved.kind === 'ambiguous') {
      for (const row of resolved.rows) {
        const hit = toProductHit(row);
        if (!seen.has(hit.slug)) {
          seen.add(hit.slug);
          ambiguous.push(hit);
        }
      }
    }
  }

  if (ambiguous.length) {
    const candidates = [...products, ...ambiguous].slice(0, 6);
    return {
      name: 'compareProducts',
      ok: false,
      code: 'AMBIGUOUS',
      data: { products: candidates },
    };
  }
  if (products.length >= 2) {
    return { name: 'compareProducts', ok: true, code: 'OK', data: { products: products.slice(0, 3) } };
  }
  if (!products.length) {
    return { name: 'compareProducts', ok: false, code: 'NOT_FOUND', data: { products: [] } };
  }
  return { name: 'compareProducts', ok: false, code: 'NEED_TWO', data: { products } };
}

async function toolAvailability(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const ref = typeof args.ref === 'string' ? args.ref : '';
  const row = ref ? await findActiveProduct(ctx.prisma, ref) : null;
  if (!row) {
    return { name: 'checkAvailability', ok: false, code: 'NOT_FOUND', data: { product: null, inStock: false } };
  }
  const hit = toProductHit(row);
  return {
    name: 'checkAvailability',
    ok: true,
    code: hit.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK',
    data: { product: hit, inStock: hit.inStock },
  };
}

function toolPolicies(): ToolResult {
  return { name: 'getStorePolicies', ok: true, code: 'OK', data: { policies: storePolicies() } };
}

async function toolShipping(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const cepRaw = typeof args.cep === 'string' || typeof args.cep === 'number' ? args.cep : '';
  const digits = sanitizeCep(cepRaw) || normalizeCep(String(cepRaw || ''));
  if (!digits || digits.length < 8) {
    return {
      name: 'getShippingEstimate',
      ok: false,
      code: 'NEED_CEP',
      data: {
        hint: 'Informe um CEP com 8 dígitos para cotar. Frete grátis em Porto Alegre (CEP 90…), conforme as políticas da loja.',
      },
    };
  }
  if (!ctx.shipping?.quoteDetailed) {
    return { name: 'getShippingEstimate', ok: false, code: 'NOT_CONFIGURED', data: { hint: 'Cotação de frete indisponível agora.' } };
  }
  const subtotal = sanitizeBudget(args.subtotal) ?? 0;
  try {
    const quote = await ctx.shipping.quoteDetailed({ cep: digits, subtotal, items: [] });
    return {
      name: 'getShippingEstimate',
      ok: true,
      code: 'OK',
      data: {
        cep: digits,
        price: quote.price,
        days: quote.days,
        carrier: quote.carrier,
        modality: quote.modality,
        label: quote.label,
        matchedPrefix: quote.matchedPrefix,
        freeAbove: quote.freeAbove,
      },
    };
  } catch {
    return { name: 'getShippingEstimate', ok: false, code: 'NOT_CONFIGURED', data: { hint: 'Não consegui cotar agora. Use o checkout ou o WhatsApp.' } };
  }
}

async function toolOrderStatus(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const gate = gatePrivateOrder(ctx.userId);
  if (!gate.ok) {
    return { name: 'getOrderStatus', ok: false, code: gate.code, data: { order: null } };
  }
  const publicId = sanitizePublicOrderId(args.publicId);
  if (!publicId) {
    return { name: 'getOrderStatus', ok: false, code: 'NEED_ORDER_ID', data: { order: null } };
  }
  // Always scope by actor userId — never load by publicId alone (existence leak).
  const row = await ctx.prisma.order.findFirst({
    where: { publicId, userId: gate.userId },
    select: {
      publicId: true,
      status: true,
      total: true,
      trackingCode: true,
      carrier: true,
      createdAt: true,
      userId: true,
    },
  });
  const owned = resolveOwnedOrder(gate.userId, row);
  if (!owned.ok) {
    return { name: 'getOrderStatus', ok: false, code: 'ORDER_NOT_FOUND', data: { order: null } };
  }
  const o = owned.order;
  const snap: PublicOrderSnap = {
    publicId: o.publicId,
    status: o.status,
    total: Number(o.total),
    trackingCode: o.trackingCode ?? null,
    carrier: o.carrier ?? null,
    createdAt: o.createdAt.toISOString(),
  };
  return { name: 'getOrderStatus', ok: true, code: 'OK', data: { order: snap } };
}

async function toolCustomerOrders(ctx: ToolContext): Promise<ToolResult> {
  const gate = gatePrivateOrder(ctx.userId);
  if (!gate.ok) {
    return { name: 'getCustomerOrders', ok: false, code: gate.code, data: { orders: [] } };
  }
  const rows = await ctx.prisma.order.findMany({
    where: { userId: gate.userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      publicId: true,
      status: true,
      total: true,
      trackingCode: true,
      carrier: true,
      createdAt: true,
    },
  });
  const orders: PublicOrderSnap[] = rows.map((o) => ({
    publicId: o.publicId,
    status: o.status,
    total: Number(o.total),
    trackingCode: o.trackingCode ?? null,
    carrier: o.carrier ?? null,
    createdAt: o.createdAt.toISOString(),
  }));
  return { name: 'getCustomerOrders', ok: true, code: 'OK', data: { orders } };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (!isKnownTool(name)) {
    return { name, ok: false, code: 'UNKNOWN_TOOL', data: null };
  }
  switch (name) {
    case 'searchProducts':
      return toolSearchProducts(ctx, args);
    case 'getProduct':
      return toolGetProduct(ctx, args);
    case 'compareProducts':
      return toolCompare(ctx, args);
    case 'checkAvailability':
      return toolAvailability(ctx, args);
    case 'getStorePolicies':
      return toolPolicies();
    case 'getShippingEstimate':
      return toolShipping(ctx, args);
    case 'getOrderStatus':
      return toolOrderStatus(ctx, args);
    case 'getCustomerOrders':
      return toolCustomerOrders(ctx);
    default:
      return { name, ok: false, code: 'UNKNOWN_TOOL', data: null };
  }
}

export function collectProducts(results: ToolResult[]): ChatProductHit[] {
  const out: ChatProductHit[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    const data = r.data as { products?: ChatProductHit[]; product?: ChatProductHit | null } | null;
    const list = [
      ...(data?.products || []),
      ...(data?.product ? [data.product] : []),
    ];
    for (const p of list) {
      if (!p?.slug || seen.has(p.slug)) continue;
      seen.add(p.slug);
      out.push(p);
    }
  }
  return out.slice(0, 6);
}
