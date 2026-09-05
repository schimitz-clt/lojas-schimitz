import assert from 'assert';

/** Máquina documental #4 — validação estática das arestas permitidas. */
const ALLOWED: Record<string, string[]> = {
  pending: ['approved', 'refused', 'expired', 'cancelled'],
  approved: ['refunded'],
  refused: [],
  expired: [],
  cancelled: [],
  refunded: [],
};

function can(from: string, to: string) {
  return (ALLOWED[from] || []).includes(to);
}

assert.equal(can('pending', 'approved'), true);
assert.equal(can('pending', 'refused'), true);
assert.equal(can('pending', 'expired'), true);
assert.equal(can('pending', 'cancelled'), true);
assert.equal(can('approved', 'refunded'), true);
assert.equal(can('refused', 'approved'), false);
assert.equal(can('expired', 'pending'), false);
assert.equal(can('cancelled', 'refunded'), false);
assert.equal(can('refunded', 'approved'), false);

// Chargeback fora do enum (#13)
assert.equal(Object.prototype.hasOwnProperty.call(ALLOWED, 'chargeback'), false);

console.log('payment.status-machine tests ok');
