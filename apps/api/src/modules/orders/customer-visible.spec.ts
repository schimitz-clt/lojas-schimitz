/**
 * Customer list/get: pending + paid visible; no soft-hide; IDOR stays userId-scoped.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const svc = readFileSync(join(__dirname, 'orders.service.ts'), 'utf8');
const ctrl = readFileSync(join(__dirname, 'orders.controller.ts'), 'utf8');
const expiry = readFileSync(join(__dirname, 'reservation-expiry-policy.ts'), 'utf8');
const pay = readFileSync(join(__dirname, '../payments/payments.service.ts'), 'utf8');

const listFn = svc.slice(svc.indexOf('async list(userId'), svc.indexOf('async getByPublicId'));
assert.ok(listFn.includes('where: { userId }'), 'list scopes owner');
assert.equal(listFn.includes("status: 'paid'"), false, 'list must not filter only paid');
assert.equal(listFn.includes('awaiting_payment'), false, 'list has no status allowlist that could drop pending');

assert.ok(svc.includes('where: { publicId, userId }'), 'get/cancel IDOR');
assert.ok(svc.includes("status: 'awaiting_payment'"), 'create persists awaiting_payment');
assert.ok(svc.includes('ORDER_CREATED'), 'ORDER_CREATED log');
assert.ok(svc.includes('shouldSkipReservationExpiry'), 'expiry respects pending PIX');

assert.ok(ctrl.includes('JwtAuthGuard'), 'auth required');
assert.ok(ctrl.includes("CurrentUser('sub')"), 'owner from JWT');

assert.ok(expiry.includes('PENDING_PAYMENT_EXPIRY_GRACE_MS'), 'grace while paying');

assert.ok(pay.includes('resolveWebhookPayment'), 'deterministic webhook resolve');
assert.ok(pay.includes('WEBHOOK_'), 'WEBHOOK_* logs');
assert.ok(pay.includes('PAYMENT_INTENT_CREATED') || pay.includes('PAYMENT_'), 'PAYMENT_* logs');

console.log('customer-visible list/get + expiry/webhook source tests ok');
