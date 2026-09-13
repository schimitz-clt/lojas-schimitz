import assert from 'assert';
import { pixChargeAmount } from '../../common/pricing';
import { llmAllowed, llmKeyPresent, resolveChatAiMode } from './ai.flags';
import { planChatTurn } from './ai.router';
import {
  collectProducts,
  executeTool,
  gatePrivateOrder,
  isKnownTool,
  isPrivateTool,
  resolveOwnedOrder,
  toProductHit,
  toolsExposedToLlm,
  type ToolContext,
} from './ai.tools';
import { noLlmFallbackReply } from './chat.intent';

async function main() {
assert.equal(gatePrivateOrder(undefined).ok, false);
assert.deepEqual(gatePrivateOrder(null), { ok: false, code: 'LOGIN_REQUIRED' });
assert.deepEqual(gatePrivateOrder(''), { ok: false, code: 'LOGIN_REQUIRED' });
assert.deepEqual(gatePrivateOrder('user-a'), { ok: true, userId: 'user-a' });

const other = resolveOwnedOrder('user-a', { userId: 'user-b', publicId: 'SCH-B' });
assert.equal(other.ok, false);
if (!other.ok) assert.equal(other.code, 'ORDER_NOT_FOUND');

const missing = resolveOwnedOrder('user-a', null);
assert.equal(missing.ok, false);
if (!missing.ok) assert.equal(missing.code, 'ORDER_NOT_FOUND');

const mine = resolveOwnedOrder('user-a', { userId: 'user-a', publicId: 'SCH-A' });
assert.equal(mine.ok, true);

assert.equal(isKnownTool('searchProducts'), true);
assert.equal(isKnownTool('DROP TABLE'), false);
assert.equal(isPrivateTool('getOrderStatus'), true);
assert.equal(isPrivateTool('searchProducts'), false);

const llmNames = toolsExposedToLlm().map((t) => t.function.name);
assert.ok(llmNames.includes('searchProducts'));
assert.ok(!llmNames.includes('getOrderStatus'), 'private order tools must not be exposed to the LLM in Alfa');
assert.ok(!llmNames.includes('getCustomerOrders'));

const hit = toProductHit({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Notebook i5',
  slug: 'notebook-i5-16gb-512ssd',
  price: 2899,
  compareAtPrice: 3299,
  badge: 'Oferta',
  images: [{ url: 'https://lojasschimitz.com.br/api/v1/uploads/nb.png', position: 0 }],
  inventory: { qtyOnHand: 3, qtyReserved: 1 },
});
assert.equal(hit.price, 2899);
assert.equal(hit.pixPrice, pixChargeAmount(2899));
assert.equal(hit.inStock, true);
assert.equal(hit.image, 'https://lojasschimitz.com.br/api/v1/uploads/nb.png');
assert.ok(!Number.isNaN(hit.pixPrice as number));

type OrderRow = {
  publicId: string;
  status: string;
  total: number;
  trackingCode: string | null;
  carrier: string | null;
  createdAt: Date;
  userId: string;
};

function mockCtx(opts: {
  products?: unknown[];
  product?: unknown | null;
  order?: OrderRow | null;
  orders?: OrderRow[];
}): ToolContext {
  const products = opts.products || [];
  return {
    userId: undefined,
    prisma: {
      product: {
        findMany: async () => products,
        findFirst: async () => opts.product ?? null,
      },
      order: {
        findFirst: async (q: { where?: { publicId?: string; userId?: string } }) => {
          const row = opts.order;
          if (!row) return null;
          if (q.where?.userId && q.where.userId !== row.userId) return null;
          if (q.where?.publicId && q.where.publicId !== row.publicId) return null;
          return row;
        },
        findMany: async (q: { where?: { userId?: string } }) => {
          return (opts.orders || []).filter((o) => o.userId === q.where?.userId);
        },
      },
    } as unknown as ToolContext['prisma'],
    shipping: null,
  };
}

{
  const ctx = mockCtx({ product: null });
  const r = await executeTool('getProduct', { ref: 'iphone-99-inventado' }, ctx);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_FOUND');
  assert.equal((r.data as { product: null }).product, null);
}

{
  const ctx = mockCtx({});
  const r = await executeTool('searchProducts', { query: 'SELECT * FROM products' }, ctx);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NEED_QUERY');
}

{
  const guest = mockCtx({
    order: {
      publicId: 'SCH-SECRET',
      status: 'paid',
      total: 10,
      trackingCode: 'TRK',
      carrier: 'propria',
      createdAt: new Date(),
      userId: 'user-b',
    },
  });
  const denied = await executeTool('getOrderStatus', { publicId: 'SCH-SECRET' }, guest);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'LOGIN_REQUIRED');
  assert.equal((denied.data as { order: null }).order, null);
}

{
  const ctx = mockCtx({
    order: {
      publicId: 'SCH-B',
      status: 'paid',
      total: 199,
      trackingCode: 'LEAK',
      carrier: 'propria',
      createdAt: new Date(),
      userId: 'user-b',
    },
  });
  ctx.userId = 'user-a';
  const cross = await executeTool('getOrderStatus', { publicId: 'SCH-B' }, ctx);
  assert.equal(cross.ok, false);
  assert.equal(cross.code, 'ORDER_NOT_FOUND');
  assert.equal((cross.data as { order: null }).order, null);
  assert.ok(!JSON.stringify(cross).includes('LEAK'));
}

{
  const ctx = mockCtx({
    orders: [
      {
        publicId: 'SCH-A1',
        status: 'paid',
        total: 50,
        trackingCode: null,
        carrier: null,
        createdAt: new Date(),
        userId: 'user-a',
      },
    ],
  });
  const guestList = await executeTool('getCustomerOrders', {}, ctx);
  assert.equal(guestList.code, 'LOGIN_REQUIRED');
  ctx.userId = 'user-a';
  const mine = await executeTool('getCustomerOrders', {}, ctx);
  assert.equal(mine.ok, true);
  assert.equal((mine.data as { orders: { publicId: string }[] }).orders[0].publicId, 'SCH-A1');
  ctx.userId = 'user-b';
  const otherList = await executeTool('getCustomerOrders', {}, ctx);
  assert.equal((otherList.data as { orders: unknown[] }).orders.length, 0);
}

{
  const unknown = await executeTool('runSql', { sql: 'DROP TABLE orders' }, mockCtx({}));
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, 'UNKNOWN_TOOL');
}

{
  const ship = await executeTool('getShippingEstimate', {}, mockCtx({}));
  assert.equal(ship.code, 'NEED_CEP');
}

{
  const collected = collectProducts([
    {
      name: 'searchProducts',
      ok: true,
      code: 'OK',
      data: { products: [hit] },
    },
  ]);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].slug, 'notebook-i5-16gb-512ssd');
}

// No LLM key → tools + FAQ still planned; useLlm false
{
  const prev = { ...process.env };
  delete process.env.OPENAI_API_KEY;
  delete process.env.CHAT_API_KEY;
  process.env.CHAT_AI_MODE = 'alfa';
  process.env.SCHIMITZ_AI_ENABLED = 'true';
  assert.equal(llmKeyPresent(), false);
  assert.equal(resolveChatAiMode(), 'alfa');
  assert.equal(llmAllowed('alfa', false), false);
  const plan = planChatTurn({ message: 'voces tem notebook gamer?', mode: 'alfa', hasLlm: false });
  assert.equal(plan.useLlm, false);
  assert.equal(plan.tools[0]?.name, 'searchProducts');
  assert.ok(plan.level <= 1);
  const fallback = noLlmFallbackReply({ faq: null, hasProducts: true });
  assert.ok(/catálogo/i.test(fallback));
  process.env.OPENAI_API_KEY = prev.OPENAI_API_KEY;
  process.env.CHAT_API_KEY = prev.CHAT_API_KEY;
  process.env.CHAT_AI_MODE = prev.CHAT_AI_MODE;
  process.env.SCHIMITZ_AI_ENABLED = prev.SCHIMITZ_AI_ENABLED;
}

{
  const off = planChatTurn({ message: 'notebook', mode: 'off', hasLlm: true });
  assert.equal(off.useLlm, false);
  assert.equal(off.tools.length, 0);
}

console.log('ai.tools tests ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
