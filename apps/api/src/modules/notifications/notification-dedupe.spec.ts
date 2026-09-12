/**
 * Phase 15 — in-app dedupe helpers (pure).
 */
import assert from 'assert';
import {
  buildInAppDedupeWhere,
  inAppDedupeKey,
  isInAppDedupeType,
  IN_APP_DEDUPE_TYPES,
} from './notification-dedupe';

{
  assert.ok(isInAppDedupeType('order_paid'));
  assert.ok(isInAppDedupeType('payment_refused'));
  assert.ok(isInAppDedupeType('order_created'));
  assert.ok(isInAppDedupeType('welcome'));
  assert.ok(isInAppDedupeType('order_status'));
  assert.ok(isInAppDedupeType('order_cancelled'));
  assert.equal(isInAppDedupeType('chat_message'), false);
  assert.ok(IN_APP_DEDUPE_TYPES.includes('order_paid'));
  console.log('notification-dedupe: type allowlist — PASSOU');
}

{
  const paid = buildInAppDedupeWhere({
    userId: 'u1',
    type: 'order_paid',
    orderId: 'ord-1',
    title: 'Pedido pago',
  });
  assert.deepEqual(paid, { userId: 'u1', type: 'order_paid', orderId: 'ord-1' });

  const refused = buildInAppDedupeWhere({
    userId: 'u1',
    type: 'payment_refused',
    orderId: 'ord-1',
  });
  assert.deepEqual(refused, { userId: 'u1', type: 'payment_refused', orderId: 'ord-1' });

  const created = buildInAppDedupeWhere({
    userId: 'u1',
    type: 'order_created',
    orderId: 'ord-2',
  });
  assert.deepEqual(created, { userId: 'u1', type: 'order_created', orderId: 'ord-2' });

  const welcome = buildInAppDedupeWhere({
    userId: 'u1',
    type: 'welcome',
    title: 'Bem-vindo(a)',
  });
  assert.deepEqual(welcome, { userId: 'u1', type: 'welcome' });

  // order_status needs title so organizing ≠ packing
  const org = buildInAppDedupeWhere({
    userId: 'u1',
    type: 'order_status',
    orderId: 'ord-1',
    title: 'Pedido: Organizando',
  });
  const pack = buildInAppDedupeWhere({
    userId: 'u1',
    type: 'order_status',
    orderId: 'ord-1',
    title: 'Pedido: Em embalagem',
  });
  assert.ok(org && pack);
  assert.notEqual(inAppDedupeKey(org!), inAppDedupeKey(pack!));
  assert.equal(org!.title, 'Pedido: Organizando');
  assert.equal(pack!.title, 'Pedido: Em embalagem');

  // Missing orderId → no dedupe (except welcome)
  assert.equal(
    buildInAppDedupeWhere({ userId: 'u1', type: 'order_paid', orderId: null }),
    null,
  );
  assert.equal(
    buildInAppDedupeWhere({ userId: 'u1', type: 'order_status', orderId: 'ord-1', title: '' }),
    null,
  );
  assert.equal(buildInAppDedupeWhere({ userId: 'u1', type: 'other', orderId: 'ord-1' }), null);

  console.log('notification-dedupe: where + status title keys — PASSOU');
}

{
  // Simulate createSafe skip map
  const seen = new Set<string>();
  function tryCreate(input: {
    userId: string;
    type: string;
    title: string;
    orderId?: string | null;
  }) {
    const where = buildInAppDedupeWhere(input);
    if (where) {
      const key = inAppDedupeKey(where);
      if (seen.has(key)) return { skipped: true };
      seen.add(key);
    }
    return { skipped: false };
  }

  assert.equal(tryCreate({ userId: 'u', type: 'order_paid', title: 'Pago', orderId: 'o1' }).skipped, false);
  assert.equal(tryCreate({ userId: 'u', type: 'order_paid', title: 'Pago', orderId: 'o1' }).skipped, true);
  assert.equal(
    tryCreate({ userId: 'u', type: 'payment_refused', title: 'Recusado', orderId: 'o1' }).skipped,
    false,
  );
  assert.equal(
    tryCreate({ userId: 'u', type: 'payment_refused', title: 'Recusado', orderId: 'o1' }).skipped,
    true,
  );
  assert.equal(tryCreate({ userId: 'u', type: 'welcome', title: 'Bem-vindo(a)' }).skipped, false);
  assert.equal(tryCreate({ userId: 'u', type: 'welcome', title: 'Bem-vindo(a)' }).skipped, true);
  assert.equal(
    tryCreate({
      userId: 'u',
      type: 'order_status',
      title: 'Pedido: Em trânsito',
      orderId: 'o1',
    }).skipped,
    false,
  );
  assert.equal(
    tryCreate({
      userId: 'u',
      type: 'order_status',
      title: 'Pedido: Em trânsito',
      orderId: 'o1',
    }).skipped,
    true,
  );
  assert.equal(
    tryCreate({
      userId: 'u',
      type: 'order_status',
      title: 'Pedido: Entregue',
      orderId: 'o1',
    }).skipped,
    false,
    'different status title must not collide',
  );
  console.log('notification-dedupe: simulated createSafe skip — PASSOU');
}

console.log('notification-dedupe tests ok');
