/**
 * MEGA Phase 14 — CarrierProvider selection + NOT_CONFIGURED (no live HTTP).
 */
import assert from 'assert';
import {
  CarrierLiveNotWiredError,
  CarrierNotConfiguredError,
  createCarrierProviderFromEnv,
  isMelhorEnvioConfigured,
  MelhorEnvioCarrierProvider,
  PropriaCarrierProvider,
  resolveCarrierProviderMode,
} from './index';

function withEnv(patch: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const keys = Object.keys(patch);
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    const v = patch[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve()
    .then(() => fn())
    .finally(() => {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    });
}

async function main() {
  // --- mode resolution ---
  assert.equal(resolveCarrierProviderMode({}), 'propria');
  assert.equal(resolveCarrierProviderMode({ CARRIER_PROVIDER: 'propria' }), 'propria');
  assert.equal(resolveCarrierProviderMode({ CARRIER_PROVIDER: 'MELHOR_ENVIO' }), 'melhor_envio');
  assert.equal(resolveCarrierProviderMode({ CARRIER_PROVIDER: 'me' }), 'melhor_envio');
  assert.equal(resolveCarrierProviderMode({ CARRIER_PROVIDER: 'unknown' }), 'propria');

  // --- factory default = propria ---
  await withEnv({ CARRIER_PROVIDER: undefined, MELHOR_ENVIO_TOKEN: undefined }, async () => {
    const p = createCarrierProviderFromEnv();
    assert.equal(p.name, 'propria');
    assert.ok(p instanceof PropriaCarrierProvider);
  });

  // --- propria createLabel / track (manual, no fake sync) ---
  {
    const propria = new PropriaCarrierProvider();
    const label = await propria.createLabel({
      orderId: 'o1',
      publicId: 'SCH-TEST',
      trackingCode: '  BR123  ',
    });
    assert.equal(label.carrier, 'propria');
    assert.equal(label.trackingCode, 'BR123');
    assert.equal(label.mode, 'manual');
    assert.equal(label.labelUrl, null);

    const empty = await propria.createLabel({
      orderId: 'o1',
      publicId: 'SCH-TEST',
      trackingCode: '   ',
    });
    assert.equal(empty.trackingCode, null);

    const track = await propria.track({ trackingCode: 'BR123' });
    assert.equal(track.status, 'unknown');
    assert.equal(track.carrier, 'propria');
    assert.ok(track.events.length >= 1);

    const quote = await propria.quote({ cep: '91160390', subtotal: 50 });
    assert.equal(quote.carrier, 'propria');
    assert.equal(quote.informational, true);
    assert.ok(quote.price >= 0);
  }

  // --- Melhor Envio NOT_CONFIGURED without token ---
  await withEnv(
    { CARRIER_PROVIDER: 'melhor_envio', MELHOR_ENVIO_TOKEN: undefined, MELHOR_ENVIO_ACCESS_TOKEN: undefined },
    async () => {
      assert.equal(isMelhorEnvioConfigured(), false);
      const me = createCarrierProviderFromEnv();
      assert.equal(me.name, 'melhor_envio');
      assert.ok(me instanceof MelhorEnvioCarrierProvider);

      await assert.rejects(
        () => me.createLabel({ orderId: 'o1', publicId: 'SCH-X' }),
        (err: unknown) => {
          assert.ok(err instanceof CarrierNotConfiguredError);
          assert.equal(err.code, 'NOT_CONFIGURED');
          return true;
        },
      );
      await assert.rejects(
        () => me.quote({ cep: '01001000', subtotal: 100 }),
        (err: unknown) => err instanceof CarrierNotConfiguredError && err.code === 'NOT_CONFIGURED',
      );
      await assert.rejects(
        () => me.track({ trackingCode: 'XX' }),
        (err: unknown) => err instanceof CarrierNotConfiguredError && err.code === 'NOT_CONFIGURED',
      );
    },
  );

  // --- Melhor Envio with token: never fake success (live not wired) ---
  await withEnv(
    { CARRIER_PROVIDER: 'melhor_envio', MELHOR_ENVIO_TOKEN: 'test-token-not-real' },
    async () => {
      assert.equal(isMelhorEnvioConfigured(), true);
      const me = new MelhorEnvioCarrierProvider();
      await assert.rejects(
        () => me.createLabel({ orderId: 'o1', publicId: 'SCH-X', trackingCode: 'FAKE' }),
        (err: unknown) => {
          assert.ok(err instanceof CarrierLiveNotWiredError);
          assert.equal(err.code, 'CARRIER_LIVE_NOT_WIRED');
          return true;
        },
      );
      await assert.rejects(
        () => me.track({ trackingCode: 'FAKE' }),
        (err: unknown) => err instanceof CarrierLiveNotWiredError,
      );
    },
  );

  // Presence helper ignores empty whitespace
  assert.equal(MelhorEnvioCarrierProvider.isConfigured({ MELHOR_ENVIO_TOKEN: '  ' }), false);
  assert.equal(
    MelhorEnvioCarrierProvider.isConfigured({ MELHOR_ENVIO_ACCESS_TOKEN: 'abc' }),
    true,
  );

  console.log('carrier.provider.spec ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
