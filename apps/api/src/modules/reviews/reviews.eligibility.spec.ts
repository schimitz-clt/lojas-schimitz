import assert from 'assert';
import { aggregatePublishedRatings, isReviewEligibleStatus } from './reviews.eligibility';

assert.equal(isReviewEligibleStatus('paid'), true);
assert.equal(isReviewEligibleStatus('separating'), true);
assert.equal(isReviewEligibleStatus('shipped'), true);
assert.equal(isReviewEligibleStatus('delivered'), true);
assert.equal(isReviewEligibleStatus('awaiting_payment'), false);
assert.equal(isReviewEligibleStatus('cancelled'), false);
assert.equal(isReviewEligibleStatus('draft'), false);
assert.equal(isReviewEligibleStatus('refunded'), false);

assert.deepEqual(aggregatePublishedRatings([]), { avg: 0, count: 0 });
assert.deepEqual(aggregatePublishedRatings([5]), { avg: 5, count: 1 });
assert.deepEqual(aggregatePublishedRatings([5, 4, 3]), { avg: 4, count: 3 });
assert.deepEqual(aggregatePublishedRatings([5, 4]), { avg: 4.5, count: 2 });
assert.deepEqual(aggregatePublishedRatings([1, 2, 3, 4, 5]), { avg: 3, count: 5 });

console.log('reviews eligibility tests ok');
