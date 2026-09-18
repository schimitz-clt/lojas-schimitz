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
assert.ok(listFn.includes('serializeCustomerOrder'), 'list maps items with name + imageUrl');
assert.ok(listFn.includes('ORDER_ITEM_CUSTOMER_SELECT'), 'list selects product cover for photo fallback');

const getFn = svc.slice(svc.indexOf('async getByPublicId'), svc.indexOf('async cancel('));
assert.ok(getFn.includes('serializeCustomerOrder'), 'detail maps items with name + imageUrl');
assert.ok(getFn.includes('images'), 'detail includes ProductImage fallback');

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
assert.ok(pay.includes('RECONCILIATION_REQUIRED'), 'orphan path logs RECONCILIATION_REQUIRED');
assert.ok(pay.includes("reason: 'reconciliation_required'"), 'orphan 2xx reason is reconciliation_required');
assert.equal(pay.includes("return { ok: true, applied: false, reason: 'orphan' }"), false, 'orphan must not 2xx without durable reconciliation');


// --- MASTER LOTE 1: critical funnel source locks ---
assert.ok(svc.includes('inventory.reserve') || svc.includes('this.inventory.reserve'), 'create reserves stock');
assert.ok(svc.includes('commitSale'), 'pay path commits sale');
assert.ok(svc.includes("status = 'awaiting_payment'") || svc.includes('awaiting_payment'), 'CAS from awaiting_payment');
assert.ok(svc.includes('adminResendStorePaidNotify'), 'admin notify-paid exists');
assert.ok(svc.includes('POST_PAID_STATUSES'), 'notify-paid gated by POST_PAID_STATUSES');
assert.ok(svc.includes('ORDER_NOT_PAID'), 'notify-paid rejects non post-paid');

const fulfillStart = svc.indexOf('async adminUpdateFulfillmentStatus');
assert.ok(fulfillStart >= 0, 'fulfillment method exists');
const fulfillEnd = svc.indexOf('\n  private async notifyCustomerInApp', fulfillStart);
const fulfillBody = fulfillEnd > fulfillStart ? svc.slice(fulfillStart, fulfillEnd) : svc.slice(fulfillStart, fulfillStart + 3500);
assert.ok(fulfillBody.includes('Sem side-effects de estoque') || fulfillBody.includes('admin_fulfillment'), 'fulfillment documented');
assert.equal(fulfillBody.includes('commitSale'), false, 'fulfillment must NOT commitSale');
assert.equal(fulfillBody.includes('inventory.reserve'), false, 'fulfillment must NOT reserve');
assert.equal(fulfillBody.includes('inventory.release'), false, 'fulfillment must NOT release');
assert.equal(fulfillBody.includes('this.inventory.'), false, 'fulfillment must NOT touch inventory service');

assert.ok(pay.includes('WEBHOOK_APPLY_FAILED') || pay.includes('WEBHOOK_FETCH_FAILED'), 'webhook failure structured logs');
assert.ok(pay.includes("structuredLog('error'"), 'webhook errors use structuredLog error');

console.log('customer-visible list/get + expiry/webhook + funnel locks ok');
