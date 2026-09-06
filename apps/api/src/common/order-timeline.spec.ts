/**
 * Timeline de logistics + ordenação dos passos (API + espelho web).
 */
import assert from 'assert';
import {
  FULFILLMENT_STATUSES,
  ORDER_TRANSITIONS,
  canTransition,
  nextFulfillmentStatus,
  orderStatusLabel,
} from './order-status';

const TIMELINE = ['paid', ...FULFILLMENT_STATUSES] as const;

// Cada passo consecutivo é uma transição válida (exceto paid→organizing já coberto)
{
  assert.equal(canTransition('paid', 'organizing'), true);
  assert.equal(canTransition('organizing', 'packing'), true);
  assert.equal(canTransition('packing', 'ready_for_pickup'), true);
  assert.equal(canTransition('ready_for_pickup', 'in_transit'), true);
  assert.equal(canTransition('in_transit', 'delivered'), true);
  console.log('timeline: cadeia de transições — PASSOU');
}

// nextFulfillmentStatus percorre a cadeia na ordem
{
  let s: string | null = 'paid';
  const walked: string[] = [];
  while (s) {
    const n = nextFulfillmentStatus(s);
    if (!n) break;
    walked.push(n);
    s = n;
  }
  assert.deepEqual(walked, [
    'organizing',
    'packing',
    'ready_for_pickup',
    'in_transit',
    'delivered',
  ]);
  console.log('timeline: nextFulfillment ordenado — PASSOU');
}

// Índice monotônico da timeline (espelha web fulfillmentStepIndex)
function stepIndex(status: string): number {
  const normalized = status === 'separating' ? 'organizing' : status === 'shipped' ? 'in_transit' : status;
  return (TIMELINE as readonly string[]).indexOf(normalized);
}

{
  const idxs = TIMELINE.map((s) => stepIndex(s));
  for (let i = 1; i < idxs.length; i++) {
    assert.ok(idxs[i] > idxs[i - 1], `índice deve crescer: ${TIMELINE[i - 1]} → ${TIMELINE[i]}`);
  }
  assert.equal(stepIndex('separating'), stepIndex('organizing'));
  assert.equal(stepIndex('shipped'), stepIndex('in_transit'));
  assert.equal(stepIndex('cancelled'), -1);
  console.log('timeline: índices monotônicos + legado — PASSOU');
}

// Labels PT presentes
{
  for (const s of TIMELINE) {
    const label = orderStatusLabel(s);
    assert.ok(label && label !== s, `label PT para ${s}`);
    assert.ok(!/[A-Z_]{3,}/.test(label) || label.includes(' '), `label não é snake_case: ${label}`);
  }
  assert.equal(orderStatusLabel('ready_for_pickup'), 'Pronto para coleta');
  assert.equal(orderStatusLabel('in_transit'), 'Em trânsito');
  assert.equal(orderStatusLabel('packing'), 'Em embalagem');
  console.log('timeline: labels PT — PASSOU');
}

// Não pula etapas
{
  assert.equal(canTransition('paid', 'packing'), false);
  assert.equal(canTransition('organizing', 'in_transit'), false);
  assert.equal(canTransition('packing', 'delivered'), false);
  console.log('timeline: sem pular etapas — PASSOU');
}

// ORDER_TRANSITIONS cobre todos os FULFILLMENT_STATUSES
{
  for (const s of FULFILLMENT_STATUSES) {
    assert.ok(ORDER_TRANSITIONS[s] !== undefined, `transitions para ${s}`);
  }
  console.log('timeline: mapa de transitions completo — PASSOU');
}

console.log('order-timeline tests ok');
