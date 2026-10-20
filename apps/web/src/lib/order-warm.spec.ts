import assert from 'node:assert/strict';
import { ORDER_WARM_MAX_AGE_MS, takeOrderWarm, warmOrder } from './order-warm';

(async () => {
  let calls = 0;
  const load = () => { calls++; return Promise.resolve({ publicId: 'A' }); };
  warmOrder('A', load, 1000);
  assert.equal(calls, 1, 'GET começa na hora');
  assert.deepEqual(await takeOrderWarm('A', 1500), { publicId: 'A' });
  assert.equal(takeOrderWarm('A', 1600), null, 'uso único');
  warmOrder('A', load, 1000);
  assert.equal(takeOrderWarm('B', 1100), null, 'outro pedido não usa');
  assert.equal(takeOrderWarm('A', 1100), null, 'pedido trocado limpa a semente');
  warmOrder('A', load, 1000);
  assert.equal(takeOrderWarm('A', 1000 + ORDER_WARM_MAX_AGE_MS + 1), null, 'velho demais');
  warmOrder('A', () => Promise.reject(new Error('401')), 1000);
  await assert.rejects(takeOrderWarm('A', 1001)!, /401/, 'erro chega à página (ela trata 401 → login)');
  warmOrder('', load); assert.equal(takeOrderWarm('', 0), null);
  console.log('order-warm.spec OK');
})().catch((e) => { console.error(e); process.exit(1); });
