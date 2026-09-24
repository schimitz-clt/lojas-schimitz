/**
 * Cotação híbrida: POA grátis com prazo calculado; fora de POA cobra a cotação;
 * sem token, erro — nunca a taxa padrão como se fosse exata.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { CarrierNotConfiguredError } from './carriers/carrier.types';
import { MelhorEnvioCarrierProvider } from './carriers/melhor-envio.carrier';
import { MelhorEnvioQuoteError } from './carriers/melhor-envio.quote';
import { ShippingService } from './shipping.service';
import {
  SHIPPING_QUOTE_NOT_CONFIGURED_MESSAGE,
  ShippingQuoteUnavailableError,
  composeHybridQuote,
  quoteHybridFreight,
} from './shipping.hybrid';

const settings = { freeAbove: 299, defaultFee: 29.9, defaultDays: 5 };
const poaRules = [
  { cepPrefix: '90', fee: 0, estimatedDays: 1, label: 'Porto Alegre (90) — frete grátis', sortOrder: 10 },
  { cepPrefix: '91', fee: 0, estimatedDays: 1, label: 'Porto Alegre (91) — frete grátis', sortOrder: 10 },
];

function carrier(price: number, days: number) {
  return async () => ({
    price,
    days,
    carrier: 'Correios',
    service: 'PAC',
    modality: 'PAC',
    assumedPackage: false,
  });
}

function fakePrisma(rules: typeof poaRules) {
  return {
    shippingSettings: {
      findUnique: async () => ({
        id: 'default',
        freeAbove: settings.freeAbove,
        defaultFee: settings.defaultFee,
        defaultDays: settings.defaultDays,
        updatedAt: new Date(),
      }),
    },
    shippingCepRule: {
      findFirst: async () => ({ id: 'seeded' }),
      findMany: async () => rules,
    },
  };
}

async function main() {
  const poa = await quoteHybridFreight({
    cep: '91160-390',
    subtotal: 50,
    items: [],
    settings,
    rules: poaRules,
    quoteCarrier: carrier(27.8, 4),
  });
  assert.equal(poa.price, 0, 'POA customer price is free');
  assert.equal(poa.days, 4, 'POA prazo comes from the calculation, not the zone 1-day seed');
  assert.equal(poa.carrierPrice, 27.8);
  assert.equal(poa.matchedPrefix, '91');
  assert.equal(poa.subsidized, true);
  assert.match(poa.label || '', /Porto Alegre \(91\)/);
  assert.notEqual(poa.price, settings.defaultFee);

  const poaOneDay = composeHybridQuote({
    cep: '90010000',
    subtotal: 40,
    settings,
    rules: poaRules,
    carrier: { price: 12.5, days: 1, carrier: 'Correios', service: 'PAC', modality: 'PAC' },
  });
  assert.equal(poaOneDay.price, 0);
  assert.equal(poaOneDay.days, 1);
  assert.equal(poaOneDay.carrierPrice, 12.5);

  const sp = await quoteHybridFreight({
    cep: '01310-100',
    subtotal: 80,
    items: [{ qty: 1, weightKg: 0.4 }],
    settings,
    rules: poaRules,
    quoteCarrier: carrier(42.5, 7),
  });
  assert.equal(sp.price, 42.5);
  assert.equal(sp.days, 7);
  assert.equal(sp.matchedPrefix, null);
  assert.equal(sp.subsidized, false);
  assert.notEqual(sp.price, settings.defaultFee);
  assert.notEqual(sp.days, settings.defaultDays);

  const caxias = await quoteHybridFreight({
    cep: '95010000',
    subtotal: 40,
    settings,
    rules: poaRules,
    quoteCarrier: carrier(33, 6),
  });
  assert.equal(caxias.price, 33, 'RS outside 90/91 is charged');
  assert.equal(caxias.days, 6);

  const paidZoneIgnored = await quoteHybridFreight({
    cep: '01310100',
    subtotal: 40,
    settings,
    rules: [{ cepPrefix: '01', fee: 15, estimatedDays: 2, label: 'Centro SP', sortOrder: 1 }],
    quoteCarrier: carrier(40, 6),
  });
  assert.equal(paidZoneIgnored.price, 40, 'paid zone fee does not replace the calculation');
  assert.equal(paidZoneIgnored.days, 6);
  assert.equal(paidZoneIgnored.matchedPrefix, null);

  const threshold = await quoteHybridFreight({
    cep: '01310100',
    subtotal: 299,
    settings,
    rules: poaRules,
    quoteCarrier: carrier(40, 6),
  });
  assert.equal(threshold.price, 0);
  assert.equal(threshold.days, 6, 'free-above still uses calculated days');
  assert.match(threshold.label || '', /Frete grátis/);

  let called = false;
  await assert.rejects(
    () =>
      quoteHybridFreight({
        cep: '9116039',
        subtotal: 10,
        settings,
        rules: poaRules,
        quoteCarrier: async () => {
          called = true;
          return { price: 10, days: 2, carrier: 'x' };
        },
      }),
    (err: unknown) => err instanceof BadRequestException,
  );
  assert.equal(called, false);

  await assert.rejects(
    () =>
      quoteHybridFreight({
        cep: '01310100',
        subtotal: 10,
        settings,
        rules: poaRules,
        quoteCarrier: async () => {
          throw new CarrierNotConfiguredError('melhor_envio');
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ShippingQuoteUnavailableError);
      assert.equal(err.reason, 'NOT_CONFIGURED');
      assert.equal(err.message, SHIPPING_QUOTE_NOT_CONFIGURED_MESSAGE);
      assert.ok(!/29[,.]90|19[,.]90/.test(err.message));
      return true;
    },
  );

  await assert.rejects(
    () =>
      quoteHybridFreight({
        cep: '01310100',
        subtotal: 10,
        settings,
        rules: poaRules,
        quoteCarrier: async () => {
          throw new MelhorEnvioQuoteError('NO_OPTION', 'NO_OPTION', 200);
        },
      }),
    (err: unknown) => err instanceof ShippingQuoteUnavailableError && err.reason === 'NO_OPTION',
  );

  const svc = new ShippingService(fakePrisma(poaRules) as never);
  (svc as unknown as { melhorEnvio: { quote: ReturnType<typeof carrier> } }).melhorEnvio = {
    quote: carrier(18.4, 3),
  };
  const viaService = await svc.quoteDetailed({ cep: '90010-000', subtotal: 25, items: [] });
  assert.equal(viaService.price, 0);
  assert.equal(viaService.days, 3);
  assert.equal(viaService.carrierPrice, 18.4);

  const viaSp = await svc.quote({ cep: '01310100', subtotal: 25, items: [{ qty: 1, weightKg: 1 }] });
  assert.equal(viaSp.price, 18.4);
  assert.equal(viaSp.days, 3);

  const bare = new ShippingService(fakePrisma(poaRules) as never);
  const prevToken = process.env.MELHOR_ENVIO_TOKEN;
  const prevAccess = process.env.MELHOR_ENVIO_ACCESS_TOKEN;
  delete process.env.MELHOR_ENVIO_TOKEN;
  delete process.env.MELHOR_ENVIO_ACCESS_TOKEN;
  try {
    await assert.rejects(
      () => bare.quoteDetailed({ cep: '01310100', subtotal: 25, items: [] }),
      (err: unknown) => {
        assert.ok(err instanceof UnprocessableEntityException);
        assert.equal(err.getStatus(), 422);
        const body = err.getResponse() as { code?: string; message?: string };
        assert.equal(body.code, 'SHIPPING_QUOTE_UNAVAILABLE');
        assert.match(body.message || '', /MELHOR_ENVIO_TOKEN/);
        assert.ok(!/29[,.]90|19[,.]90/.test(body.message || ''));
        return true;
      },
    );
  } finally {
    if (prevToken === undefined) delete process.env.MELHOR_ENVIO_TOKEN;
    else process.env.MELHOR_ENVIO_TOKEN = prevToken;
    if (prevAccess === undefined) delete process.env.MELHOR_ENVIO_ACCESS_TOKEN;
    else process.env.MELHOR_ENVIO_ACCESS_TOKEN = prevAccess;
  }

  const src = readFileSync(join(__dirname, 'shipping.service.ts'), 'utf8');
  assert.ok(src.includes('quoteHybridFreight'));
  assert.ok(!src.includes('computeShippingQuote'));
  assert.match(src, /cepPrefix: '90'/);
  assert.match(src, /cepPrefix: '91'/);
  assert.match(src, /estimatedDays: 1/);
  const seed = readFileSync(join(__dirname, '../../../../../prisma/seed.ts'), 'utf8');
  assert.match(seed, /cepPrefix: '90'/);
  assert.match(seed, /cepPrefix: '91'/);

  console.log('shipping.hybrid.spec.ts OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
