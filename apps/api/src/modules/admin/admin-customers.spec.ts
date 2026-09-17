import assert from 'assert';
import {
  buildCustomerWhere,
  clampTake,
  isPaidRevenueStatus,
  pickDefaultAddress,
  pickPrimaryPayment,
  roundMoney,
  serializeCustomerAddress,
  summarizeCustomerSpend,
} from './admin-customers.service';

assert.deepEqual(buildCustomerWhere(undefined), { role: 'customer' });
assert.deepEqual(buildCustomerWhere('  '), { role: 'customer' });

const w = buildCustomerWhere('Ana');
assert.equal(w.role, 'customer');
assert.ok(Array.isArray(w.OR));
assert.equal((w.OR as any[]).length, 3);

assert.equal(clampTake(undefined), 50);
assert.equal(clampTake(0), 50);
assert.equal(clampTake(-1), 50);
assert.equal(clampTake(10), 10);
assert.equal(clampTake(999), 100);
assert.equal(clampTake(3.9), 3);

assert.equal(roundMoney(10.005), 10.01);
assert.equal(isPaidRevenueStatus('paid'), true);
assert.equal(isPaidRevenueStatus('organizing'), true);
assert.equal(isPaidRevenueStatus('awaiting_payment'), false);
assert.equal(isPaidRevenueStatus('cancelled'), false);

const spend = summarizeCustomerSpend([
  { total: 50, createdAt: '2026-09-10T12:00:00.000Z', status: 'awaiting_payment' },
  { total: 110, createdAt: '2026-09-01T12:00:00.000Z', status: 'paid' },
  { total: 40, createdAt: '2026-08-01T12:00:00.000Z', status: 'delivered' },
]);
assert.equal(spend.paidOrdersCount, 2);
assert.equal(spend.paidTotal, 150);
assert.equal(spend.lastOrderAt, '2026-09-10T12:00:00.000Z');
assert.equal(spend.lastPaidAt, '2026-09-01T12:00:00.000Z');

const unsorted = summarizeCustomerSpend(
  [
    { total: 40, createdAt: '2026-08-01T12:00:00.000Z', status: 'delivered' },
    { total: 50, createdAt: '2026-09-10T12:00:00.000Z', status: 'awaiting_payment' },
  ],
  { assumeNewestFirst: false },
);
assert.equal(unsorted.lastOrderAt, '2026-09-10T12:00:00.000Z');

const emptySpend = summarizeCustomerSpend([]);
assert.equal(emptySpend.paidOrdersCount, 0);
assert.equal(emptySpend.paidTotal, 0);
assert.equal(emptySpend.lastOrderAt, null);

assert.equal(pickPrimaryPayment([]), null);
assert.equal(pickPrimaryPayment([{ status: 'pending' }])?.status, 'pending');
assert.equal(
  pickPrimaryPayment([
    { method: 'card', status: 'pending' },
    { method: 'pix', status: 'approved' },
  ])?.method,
  'pix',
);
assert.equal(
  pickPrimaryPayment([{ method: 'boleto', status: 'pending' }])?.method,
  'boleto',
);

const addr = serializeCustomerAddress({
  id: 'a1',
  label: 'Casa',
  cep: '90000000',
  street: 'Rua A',
  number: '10',
  district: 'Centro',
  city: 'Porto Alegre',
  uf: 'RS',
  isDefault: true,
});
assert.equal(addr.city, 'Porto Alegre');
assert.equal(addr.isDefault, true);
assert.equal(serializeCustomerAddress({}).label, 'Casa');

const picked = pickDefaultAddress([
  { id: '1', isDefault: false },
  { id: '2', isDefault: true },
]);
assert.equal(picked?.id, '2');
assert.equal(pickDefaultAddress([{ id: 'x' }])?.id, 'x');
assert.equal(pickDefaultAddress([]), null);

console.log('admin-customers unit ok');
