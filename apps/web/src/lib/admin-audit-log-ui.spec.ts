import assert from 'assert';
import {
  auditActionLabel,
  auditActorLabel,
  auditChangesSummary,
  auditLogQueryString,
  auditOutcomeLabel,
} from './admin-audit-log-ui';

assert.equal(auditActionLabel('product.updated'), 'Alterou produto');
assert.equal(auditActionLabel('admin.http.PATCH /api/v1/admin/products/:id'), 'Alterou · products/:id');
assert.equal(auditActionLabel('admin.http.DELETE /api/v1/admin/banners/:id'), 'Removeu · banners/:id');
assert.equal(auditActionLabel('algo.desconhecido'), 'algo.desconhecido');

assert.equal(auditActorLabel(null), 'Sistema');
assert.equal(auditActorLabel({ id: 'abcdefghijk', name: 'Ana', email: 'a@b.c' }), 'Ana');
assert.equal(auditActorLabel({ id: 'abcdefghijk', name: null, email: 'a@b.c' }), 'a@b.c');
assert.equal(auditActorLabel({ id: 'abcdefghijk', name: null, email: null }), 'abcdefgh');

assert.equal(
  auditChangesSummary({ changes: { price: { from: 100, to: 79.9 }, stock: { from: 10, to: 3 }, active: { from: true, to: false } } }),
  'preço 100 → 79.9; estoque 10 → 3; ativo sim → não',
);
assert.equal(auditChangesSummary(null), '');
assert.equal(auditChangesSummary({ body: {} }), '');

assert.equal(auditOutcomeLabel({ outcome: 'error', status: 409 }), 'falhou (409)');
assert.equal(auditOutcomeLabel({ outcome: 'ok' }), '');

assert.equal(auditLogQueryString({ entity: '', action: '', skip: 0 }), 'take=50');
assert.equal(auditLogQueryString({ entity: 'products', action: ' refund ', skip: 50 }), 'entity=products&action=refund&take=50&skip=50');
console.log('admin-audit-log-ui tests ok');
