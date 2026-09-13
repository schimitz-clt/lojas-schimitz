import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CUSTOMER_VISIBLE_ORDER_STATUSES,
  isCustomerVisibleOrderStatus,
  LAST_ORDER_PUBLIC_ID_KEY,
  loginNextPath,
  orderRecoveryPaths,
  persistLastOrderPublicId,
  PIX_LEAVE_COPY,
  readLastOrderPublicId,
} from './order-recovery';

assert.equal(isCustomerVisibleOrderStatus('awaiting_payment'), true);
assert.equal(isCustomerVisibleOrderStatus('paid'), true);
assert.equal(isCustomerVisibleOrderStatus('cancelled'), true);
assert.ok(CUSTOMER_VISIBLE_ORDER_STATUSES.includes('awaiting_payment'));

const paths = orderRecoveryPaths('SCH-ABC');
assert.equal(paths.verMeuPedido, '/pedidos/SCH-ABC');
assert.equal(paths.meusPedidos, '/pedidos');
assert.notEqual(paths.meusPedidos, '/conta');

assert.equal(loginNextPath('/pedidos/SCH-ABC'), '/entrar?next=%2Fpedidos%2FSCH-ABC');
assert.equal(loginNextPath('https://evil.example'), '/entrar?next=%2Fpedidos');

const mem: Record<string, string> = {};
const storage = {
  setItem: (k: string, v: string) => {
    mem[k] = v;
  },
  getItem: (k: string) => mem[k] ?? null,
};
persistLastOrderPublicId('SCH-XYZ', storage);
assert.equal(readLastOrderPublicId(storage), 'SCH-XYZ');
assert.equal(mem[LAST_ORDER_PUBLIC_ID_KEY], 'SCH-XYZ');

assert.ok(PIX_LEAVE_COPY.includes('Pode sair'));
assert.ok(PIX_LEAVE_COPY.includes('Meus pedidos'));

const checkout = readFileSync(join(__dirname, '../app/checkout/page.tsx'), 'utf8');
assert.ok(checkout.includes("api<{ publicId: string }>('/orders'"), 'checkout POSTs /orders');
assert.ok(checkout.includes('router.push(`/pedidos/${order.publicId}`)'), 'navigate only after publicId');
assert.ok(checkout.includes('persistLastOrderPublicId'), 'persist publicId before leave');

const pedido = readFileSync(join(__dirname, '../app/pedidos/[publicId]/page.tsx'), 'utf8');
assert.ok(pedido.includes('PIX_LEAVE_COPY') || pedido.includes('Pode sair'), 'leave-page copy on PIX');
assert.ok(pedido.includes('href="/pedidos"'), 'CTA Meus pedidos → /pedidos');
assert.ok(!pedido.includes('href="/conta"') || pedido.includes('href="/pedidos"'), 'recovery not only /conta');
assert.ok(pedido.includes('persistLastOrderPublicId'), 'detail persists publicId');
assert.ok(pedido.includes('Ver meu pedido') || pedido.includes('verMeuPedido'), 'CTA Ver meu pedido');
assert.ok(pedido.includes('WhatsApp'), 'WhatsApp CTA');

const list = readFileSync(join(__dirname, '../app/pedidos/page.tsx'), 'utf8');
assert.ok(list.includes("api<any[]>('/orders')") || list.includes("api<"), 'lists /orders');
assert.ok(list.includes('currentUser') || list.includes('loginNextPath'), 'auth gate');
assert.ok(list.includes('readLastOrderPublicId'), 'abandon recovery banner');
assert.ok(!/status\s*===\s*['"]paid['"]/.test(list) || list.includes('awaiting_payment'), 'must not hide pending');

console.log('order-recovery unit + abandon-page source tests ok');
