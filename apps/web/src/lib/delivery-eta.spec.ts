import assert from 'assert';
import {
  formatDaysAfterDispatch,
  formatPrazoDays,
  formatReceiveInDays,
  findDispatchAt,
  etaAfterDispatch,
  formatEtaPt,
  resolveEstimatedDays,
  deliveryEtaCopy,
  findDeliveredAt,
} from './delivery-eta';

assert.equal(formatDaysAfterDispatch(1), '1 dia após o despacho');
assert.equal(formatDaysAfterDispatch(2), '2 dias após o despacho');
assert.equal(formatDaysAfterDispatch(5), '5 dias após o despacho');
assert.equal(formatDaysAfterDispatch(1.9), '1 dia após o despacho');

assert.equal(formatReceiveInDays(1), 'em 1 dia');
assert.equal(formatReceiveInDays(1.9), 'em 1 dia');
assert.equal(formatReceiveInDays(4), 'em 4 dias');
assert.equal(formatPrazoDays(1), 'Prazo: 1 dia');
assert.equal(formatPrazoDays(3), 'Prazo: 3 dias');
assert.ok(!/após o despacho/.test(formatReceiveInDays(1)));
assert.ok(!/após o despacho/.test(formatPrazoDays(1)));

assert.equal(resolveEstimatedDays({ days: 3 }), 3);
assert.equal(resolveEstimatedDays({ estimatedDays: 2 }), 2);
assert.equal(resolveEstimatedDays({ estimatedDays: 4, days: 9 }), 4);
assert.equal(resolveEstimatedDays({ days: '2' }), 2);
assert.equal(resolveEstimatedDays(null), null);
assert.equal(resolveEstimatedDays({ days: 0 }), null);
assert.equal(resolveEstimatedDays({}), null);

const hist = [
  { toStatus: 'paid', createdAt: '2026-09-10T12:00:00.000Z' },
  { toStatus: 'organizing', createdAt: '2026-09-10T14:00:00.000Z' },
  { toStatus: 'in_transit', createdAt: '2026-09-11T15:00:00.000Z' },
  { toStatus: 'delivered', createdAt: '2026-09-12T18:00:00.000Z' },
];
const dispatch = findDispatchAt(hist);
assert.ok(dispatch);
assert.equal(dispatch!.toISOString(), '2026-09-11T15:00:00.000Z');

const legacy = [
  { toStatus: 'shipped', createdAt: '2026-09-11T10:00:00.000Z' },
  { toStatus: 'in_transit', createdAt: '2026-09-11T12:00:00.000Z' },
];
assert.equal(findDispatchAt(legacy)!.toISOString(), '2026-09-11T10:00:00.000Z');

assert.equal(findDispatchAt([]), null);
assert.equal(findDispatchAt([{ toStatus: 'paid', createdAt: '2026-09-11T10:00:00.000Z' }]), null);

const start = new Date('2026-09-11T15:00:00.000Z');
const eta1 = etaAfterDispatch(start, 1);
assert.equal(eta1.toISOString(), '2026-09-12T15:00:00.000Z');
const eta2 = etaAfterDispatch(start, 2);
assert.equal(eta2.getTime() - start.getTime(), 2 * 24 * 60 * 60 * 1000);

const formatted = formatEtaPt(eta1);
assert.ok(typeof formatted === 'string' && formatted.length > 0);
// America/Sao_Paulo = UTC-3 → 12/09/2026 12:00
assert.ok(formatted.includes('12/09/2026') || formatted.includes('12/9/2026'));

assert.ok(
  deliveryEtaCopy({
    status: 'paid',
    freightSnap: { days: 1 },
  }) === 'Prazo: 1 dia',
);
assert.ok(
  deliveryEtaCopy({
    status: 'organizing',
    freightSnap: { estimatedDays: 3 },
  }) === 'Prazo: 3 dias',
);
assert.ok(!/após o despacho/.test(deliveryEtaCopy({ status: 'paid', freightSnap: { days: 1 } }) || ''));

const afterDispatch = deliveryEtaCopy({
  status: 'in_transit',
  statusHistory: hist,
  freightSnap: { days: 1 },
});
assert.ok(afterDispatch?.startsWith('Previsão de entrega:'));
assert.ok(afterDispatch?.includes(formatEtaPt(etaAfterDispatch(dispatch!, 1))));

const deliveredAt = findDeliveredAt(hist);
assert.equal(deliveredAt!.toISOString(), '2026-09-12T18:00:00.000Z');
const deliveredCopy = deliveryEtaCopy({
  status: 'delivered',
  statusHistory: hist,
  freightSnap: { days: 1 },
  deliveredAt,
});
assert.ok(deliveredCopy?.startsWith('Entregue'));
assert.ok(deliveredCopy?.includes('prazo'));

console.log('delivery-eta helpers ok');
