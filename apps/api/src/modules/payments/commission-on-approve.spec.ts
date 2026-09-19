import assert from 'assert';
import { shouldRecordCommissionOnApprove } from './commission-on-approve';

assert.equal(shouldRecordCommissionOnApprove({ casWon: true }), true);
assert.equal(shouldRecordCommissionOnApprove({ casWon: true, orderStatus: 'paid' }), true);
assert.equal(shouldRecordCommissionOnApprove({ casWon: false, orderStatus: 'paid' }), true);
assert.equal(shouldRecordCommissionOnApprove({ casWon: false, orderStatus: 'awaiting_payment' }), false);
assert.equal(shouldRecordCommissionOnApprove({ casWon: false, orderStatus: 'cancelled' }), false);
assert.equal(shouldRecordCommissionOnApprove({ casWon: false, orderStatus: null }), false);
assert.equal(shouldRecordCommissionOnApprove({ casWon: false }), false);

console.log('commission-on-approve.spec ok');
