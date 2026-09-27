import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { refundableFromDetail, sortDiscrepancies, validateFinanceAction, parseRefundAmount, PAYMENT_STATE_LABEL_PT } from './admin-finance-ui';

assert.equal(validateFinanceAction('reprocess', { reason: 'curto', confirm: true }), 'Descreva o motivo (mínimo 10 caracteres).');
assert.equal(validateFinanceAction('reprocess', { reason: 'motivo suficiente', confirm: false }), 'Marque a confirmação para continuar.');
assert.equal(validateFinanceAction('reprocess', { reason: 'motivo suficiente', confirm: true }), null);
assert.ok(validateFinanceAction('resolve', { reason: 'motivo suficiente', confirm: true, severity: 'CRITICAL' }));
assert.equal(validateFinanceAction('resolve', { reason: 'motivo suficiente', confirm: true, severity: 'LOW' }), null);
assert.ok(validateFinanceAction('refund', { reason: 'motivo suficiente', confirm: true, amount: '0' }));
assert.ok(validateFinanceAction('refund', { reason: 'motivo suficiente', confirm: true, amount: '10,555' }));
assert.ok(validateFinanceAction('refund', { reason: 'motivo suficiente', confirm: true, amount: '101' }, { refundable: 100 }));
assert.equal(validateFinanceAction('refund', { reason: 'motivo suficiente', confirm: true, amount: '10,50' }, { refundable: 100 }), null);
assert.equal(parseRefundAmount('10,50'), 10.5);
assert.equal(parseRefundAmount(''), undefined);
assert.equal(refundableFromDetail({ payment: { amount: 100 }, refunds: [{ amount: 30, status: 'COMPLETED' }, { amount: 50, status: 'FAILED' }] }), 70);
assert.deepEqual(sortDiscrepancies([{ severity: 'LOW', lastSeenAt: '2' }, { severity: 'CRITICAL', lastSeenAt: '1' }]).map((d) => d.severity), ['CRITICAL', 'LOW']);
assert.equal(PAYMENT_STATE_LABEL_PT.CHARGEBACK_LOST, 'Chargeback perdido');

const src = readFileSync(join(__dirname, '../components/admin/sections/AdminFinanceiroSection.tsx'), 'utf8');
assert.ok(src.includes("'/admin/finance/dashboard'"), 'dashboard from API');
assert.ok(src.includes('Idempotency-Key'), 'refund sends Idempotency-Key');
assert.ok(src.includes('confirm: true') || src.includes('confirm: form.confirm'), 'actions send confirm');
assert.ok(!/Math\.random\(\)\s*\*\s*\d+/.test(src), 'no fabricated numbers');
assert.ok(!/cvv|cardNumber/i.test(src), 'no card data in admin UI');
console.log('admin-finance-ui.spec ok');
