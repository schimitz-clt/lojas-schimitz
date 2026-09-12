/**
 * MEGA Phase 12 — matriz completa from→to da máquina de estados Order.
 * Unitário (sem DB): allowlist central + assertValidTransition + alinhamento refund.
 */
import assert from 'assert';
import {
  ADMIN_FULFILLMENT_TARGETS,
  ORDER_STATUS_HAPPY_PATH,
  ORDER_TRANSITIONS,
  allowedTransitions,
  assertValidTransition,
  canTransition,
  invalidTransitionPayload,
  isRefundAllowed,
  InvalidOrderTransitionError,
  nextFulfillmentStatus,
  REFUND_NO_RESTOCK_STATUSES,
  REFUND_RESTOCK_STATUSES,
  shouldRestockOnRefund,
} from './order-status';

const ALL_STATUSES = Object.keys(ORDER_TRANSITIONS);

// --- Happy path consecutivos ---
{
  for (let i = 0; i < ORDER_STATUS_HAPPY_PATH.length - 1; i++) {
    const from = ORDER_STATUS_HAPPY_PATH[i];
    const to = ORDER_STATUS_HAPPY_PATH[i + 1];
    assert.equal(canTransition(from, to), true, `happy ${from}→${to}`);
    assertValidTransition(from, to);
  }
  console.log('matrix: happy path draft→…→delivered — PASSOU');
}

// --- Saltos / regressões inválidos no happy path ---
{
  const invalidPairs: [string, string][] = [
    ['paid', 'packing'],
    ['paid', 'in_transit'],
    ['paid', 'delivered'],
    ['paid', 'awaiting_payment'],
    ['paid', 'cancelled'],
    ['organizing', 'ready_for_pickup'],
    ['organizing', 'in_transit'],
    ['organizing', 'delivered'],
    ['packing', 'in_transit'],
    ['packing', 'delivered'],
    ['packing', 'paid'],
    ['ready_for_pickup', 'delivered'],
    ['ready_for_pickup', 'organizing'],
    ['in_transit', 'packing'],
    ['delivered', 'in_transit'],
    ['delivered', 'cancelled'],
    ['delivered', 'refunded'],
    ['cancelled', 'paid'],
    ['cancelled', 'awaiting_payment'],
    ['refunded', 'paid'],
    ['awaiting_payment', 'organizing'],
    ['awaiting_payment', 'delivered'],
    ['draft', 'paid'],
  ];
  for (const [from, to] of invalidPairs) {
    assert.equal(canTransition(from, to), false, `invalid ${from}→${to}`);
    let threw = false;
    try {
      assertValidTransition(from, to);
    } catch (e) {
      threw = true;
      assert.ok(e instanceof InvalidOrderTransitionError);
      assert.equal(e.code, 'INVALID_TRANSITION');
      assert.equal(e.from, from);
      assert.equal(e.to, to);
      assert.deepEqual(e.allowed, allowedTransitions(from));
      assert.equal(e.payload.message, `Transição inválida: ${from} → ${to}`);
    }
    assert.ok(threw, `assertValidTransition deve lançar ${from}→${to}`);
  }
  console.log('matrix: saltos/regressões rejeitados — PASSOU');
}

// --- Exceções cancelled / refunded ---
{
  assert.equal(canTransition('draft', 'cancelled'), true);
  assert.equal(canTransition('awaiting_payment', 'cancelled'), true);
  assert.equal(canTransition('awaiting_payment', 'paid'), true);

  for (const s of REFUND_RESTOCK_STATUSES) {
    assert.equal(canTransition(s, 'refunded'), true, `refund restock from ${s}`);
    assert.equal(isRefundAllowed(s), true);
    assert.equal(shouldRestockOnRefund(s), true);
  }
  for (const s of REFUND_NO_RESTOCK_STATUSES) {
    assert.equal(canTransition(s, 'refunded'), true, `refund no-restock from ${s}`);
    assert.equal(isRefundAllowed(s), true);
    assert.equal(shouldRestockOnRefund(s), false);
  }
  assert.equal(isRefundAllowed('delivered'), false);
  assert.equal(isRefundAllowed('cancelled'), false);
  assert.equal(isRefundAllowed('awaiting_payment'), false);
  console.log('matrix: cancelled/refunded exceptions — PASSOU');
}

// --- Legado separating / shipped ---
{
  assert.equal(canTransition('separating', 'packing'), true);
  assert.equal(canTransition('separating', 'in_transit'), true);
  assert.equal(canTransition('separating', 'shipped'), true);
  assert.equal(canTransition('separating', 'refunded'), true);
  assert.equal(canTransition('separating', 'delivered'), false);
  assert.equal(canTransition('shipped', 'delivered'), true);
  assert.equal(canTransition('shipped', 'refunded'), true);
  assert.equal(canTransition('shipped', 'in_transit'), false);
  assert.equal(nextFulfillmentStatus('separating'), 'packing');
  assert.equal(nextFulfillmentStatus('shipped'), 'delivered');
  console.log('matrix: legado separating/shipped — PASSOU');
}

// --- Matriz exaustiva: só pares listados em ORDER_TRANSITIONS são true ---
{
  for (const from of ALL_STATUSES) {
    const allowed = new Set(ORDER_TRANSITIONS[from]);
    for (const to of ALL_STATUSES) {
      const expected = allowed.has(to);
      assert.equal(
        canTransition(from, to),
        expected,
        `exhaustive ${from}→${to} expected=${expected}`,
      );
    }
    // unknown target
    assert.equal(canTransition(from, 'bogus_status'), false);
  }
  assert.equal(canTransition('unknown_from', 'paid'), false);
  console.log('matrix: exhaustive allowlist — PASSOU');
}

// --- CAS paid × cancelled: um vencedor; pós-win sem transição cruzada ---
{
  type Order = { status: string };
  function cas(order: Order, from: string, to: string) {
    if (!canTransition(from, to)) return false;
    if (order.status !== from) return false;
    order.status = to;
    return true;
  }
  const order: Order = { status: 'awaiting_payment' };
  const paid = cas(order, 'awaiting_payment', 'paid');
  const cancelled = cas(order, 'awaiting_payment', 'cancelled');
  assert.equal(paid && cancelled, false);
  assert.ok(order.status === 'paid' || order.status === 'cancelled');
  assert.equal(canTransition('paid', 'cancelled'), false);
  assert.equal(canTransition('cancelled', 'paid'), false);
  console.log('matrix: CAS paid×cancelled — PASSOU (winner=', order.status + ')');
}

// --- Admin fulfillment: next step ok; skip rejeitado; DTO targets cobertos ---
{
  let s: string = 'paid';
  while (true) {
    const n = nextFulfillmentStatus(s);
    if (!n) break;
    assert.equal(canTransition(s, n), true, `admin next ${s}→${n}`);
    s = n;
  }
  assert.equal(s, 'delivered');

  for (const target of ADMIN_FULFILLMENT_TARGETS) {
    assert.ok(typeof target === 'string');
  }
  // paid não pode ir direto a delivered via admin allowlist
  const payload = invalidTransitionPayload('paid', 'delivered');
  assert.equal(payload.code, 'INVALID_TRANSITION');
  assert.deepEqual(payload.allowed, ['organizing', 'refunded']);
  console.log('matrix: admin one-step + DTO targets — PASSOU');
}

// --- Terminais sem saída ---
{
  for (const terminal of ['delivered', 'cancelled', 'refunded']) {
    assert.deepEqual(allowedTransitions(terminal), []);
  }
  console.log('matrix: terminais vazios — PASSOU');
}

console.log('order-status.matrix tests ok');
