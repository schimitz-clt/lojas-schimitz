import assert from 'assert';
import { isMarketplaceSplitAllowLive, isMarketplaceSplitEnabled } from './marketplace-mp.flags';

assert.equal(isMarketplaceSplitEnabled({}), false);
assert.equal(isMarketplaceSplitEnabled({ MP_MARKETPLACE_SPLIT_ENABLED: 'false' }), false);
assert.equal(isMarketplaceSplitEnabled({ MP_MARKETPLACE_SPLIT_ENABLED: '' }), false);
assert.equal(isMarketplaceSplitEnabled({ MP_MARKETPLACE_SPLIT_ENABLED: 'true' }), true);
assert.equal(isMarketplaceSplitEnabled({ MP_MARKETPLACE_SPLIT_ENABLED: '1' }), true);

assert.equal(isMarketplaceSplitAllowLive({}), false);
assert.equal(isMarketplaceSplitAllowLive({ MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'true' }), true);
assert.equal(isMarketplaceSplitAllowLive({ MP_MARKETPLACE_SPLIT_ALLOW_LIVE: 'false' }), false);

console.log('marketplace-mp.flags.spec ok');
