import assert from 'node:assert/strict';
import {
  countStalledByReason,
  formatStalledAge,
  stalledOrderHref,
  stalledReasonLabel,
  stalledReasonTone,
  stalledRulesLede,
  type StalledOrderItem,
} from './admin-stalled-orders';

const base: StalledOrderItem = {
  id: '11111111-2222-4333-8444-555555555555',
  publicId: 'LS-1',
  status: 'paid',
  reason: 'paid_awaiting_org',
  since: '2026-10-19T00:00:00Z',
  ageHours: 30,
  customerName: null,
  total: null,
};
assert.equal(stalledReasonLabel('paid_awaiting_org'), 'Pago, aguardando organizar');
assert.equal(stalledReasonLabel('prep_stuck'), 'Separação parada');
assert.equal(stalledReasonLabel('shipped_no_tracking'), 'Enviado sem rastreio');
assert.equal(stalledReasonLabel('xyz'), 'Atenção');
assert.equal(stalledReasonTone('paid_awaiting_org'), 'danger');
assert.equal(stalledReasonTone('prep_stuck'), 'warn');
assert.equal(formatStalledAge(5), '5 h');
assert.equal(formatStalledAge(47), '47 h');
assert.equal(formatStalledAge(48), '2 dias');
assert.equal(formatStalledAge(NaN), '0 h');
assert.equal(stalledOrderHref(base), `/admin/pedidos?order=${base.id}`);
assert.equal(stalledOrderHref({ id: 'not-a-uuid' }), '/admin/pedidos');
assert.deepEqual(countStalledByReason([]), { paid_awaiting_org: 0, prep_stuck: 0, shipped_no_tracking: 0 });
assert.deepEqual(countStalledByReason([base, { ...base, reason: 'prep_stuck' }, base]), {
  paid_awaiting_org: 2,
  prep_stuck: 1,
  shipped_no_tracking: 0,
});
assert.match(stalledRulesLede({ paidHours: 24, stuckDays: 3 }), /24 h.*3 dia/);
console.log('admin-stalled-orders.spec ok');
