/**
 * Melhor Envio calculate: HTTP fixture, cheapest viable option, no live charge.
 * Label/track stay NOT_WIRED.
 */
import assert from 'node:assert/strict';
import { CarrierLiveNotWiredError, CarrierNotConfiguredError } from './carrier.types';
import { MelhorEnvioCarrierProvider } from './melhor-envio.carrier';
import {
  DEFAULT_MELHOR_ENVIO_USER_AGENT,
  DEFAULT_ORIGIN_CEP,
  DEFAULT_PARCEL_HEIGHT_CM,
  DEFAULT_PARCEL_LENGTH_CM,
  DEFAULT_PARCEL_WEIGHT_KG,
  DEFAULT_PARCEL_WIDTH_CM,
  MELHOR_ENVIO_CALCULATE_PATH,
  MELHOR_ENVIO_CALCULATE_SERVICES,
  MELHOR_ENVIO_PRODUCTION_BASE,
  MELHOR_ENVIO_SANDBOX_BASE,
  MelhorEnvioQuoteError,
  buildMelhorEnvioProducts,
  calculateMelhorEnvioFreight,
  pickCheapestMelhorEnvioService,
  resolveMelhorEnvioUserAgent,
} from './melhor-envio.quote';
import { quoteHybridFreight } from '../shipping.hybrid';

const TOKEN = 'test-token-not-real';

const fixture = [
  {
    id: 1,
    name: 'PAC',
    price: '40.00',
    custom_price: '38.50',
    delivery_time: 8,
    custom_delivery_time: 7,
    company: { name: 'Correios' },
    error: null,
  },
  {
    id: 2,
    name: 'SEDEX',
    price: '54.00',
    custom_price: '22.10',
    delivery_time: 3,
    custom_delivery_time: 2,
    company: { name: 'Correios' },
  },
  { id: 3, name: 'Jadlog', error: 'Trecho não atendido' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function main() {
  const picked = pickCheapestMelhorEnvioService(fixture);
  assert.equal(picked?.service, 'SEDEX');
  assert.equal(picked?.price, 22.1);
  assert.equal(picked?.days, 2);
  assert.equal(pickCheapestMelhorEnvioService([{ id: 1, name: 'PAC', error: 'x' }]), null);
  assert.equal(pickCheapestMelhorEnvioService({ message: 'nope' }), null);
  assert.equal(pickCheapestMelhorEnvioService([]), null);

  const singleService = {
    id: 3,
    name: '.Package',
    price: '22.40',
    custom_price: '20.15',
    delivery_time: 4,
    company: { name: 'Jadlog' },
  };
  const pickedSingle = pickCheapestMelhorEnvioService(singleService);
  assert.equal(pickedSingle?.service, '.Package');
  assert.equal(pickedSingle?.serviceId, '3');
  assert.equal(pickedSingle?.price, 20.15);
  assert.equal(pickedSingle?.days, 4);
  assert.equal(pickedSingle?.company, 'Jadlog');

  assert.equal(
    pickCheapestMelhorEnvioService({
      id: 3,
      name: '.Package',
      price: '20.00',
      delivery_time: 4,
      company: { name: 'Jadlog' },
      error: 'Trecho não atendido',
    }),
    null,
  );
  assert.equal(
    pickCheapestMelhorEnvioService({
      id: 3,
      name: '.Package',
      price: '20.00',
      delivery_time: 4,
      company: { name: 'Jadlog' },
      error: { message: 'Serviço indisponível para este trecho' },
    }),
    null,
  );
  assert.equal(
    pickCheapestMelhorEnvioService({
      message: 'The given data was invalid.',
      errors: { 'to.postal_code': ['O CEP de destino é inválido.'] },
    }),
    null,
  );

  const ranged = pickCheapestMelhorEnvioService({
    id: 3,
    name: '.Package',
    price: '19.90',
    company: { name: 'Jadlog' },
    delivery_range: { min: 4, max: 6 },
  });
  assert.equal(ranged?.days, 4);
  assert.equal(ranged?.price, 19.9);

  const customRange = pickCheapestMelhorEnvioService([
    {
      id: 1,
      name: 'PAC',
      price: '12.00',
      company: { name: 'Correios' },
      custom_delivery_range: { min: 3, max: 5 },
      delivery_range: { min: 8, max: 10 },
    },
  ]);
  assert.equal(customRange?.days, 3);

  const timeWinsRange = pickCheapestMelhorEnvioService([
    {
      id: 1,
      name: 'PAC',
      price: '12.00',
      delivery_time: 5,
      delivery_range: { min: 2, max: 3 },
      company: { name: 'Correios' },
    },
  ]);
  assert.equal(timeWinsRange?.days, 5);

  const objectErrorSkipped = pickCheapestMelhorEnvioService([
    {
      id: 2,
      name: 'SEDEX',
      price: '30.00',
      delivery_time: 2,
      company: { name: 'Correios' },
      error: { code: 'unavailable' },
    },
    { id: 3, name: '.Package', price: '18.00', delivery_time: 4, company: { name: 'Jadlog' } },
  ]);
  assert.equal(objectErrorSkipped?.service, '.Package');
  assert.equal(objectErrorSkipped?.price, 18);

  assert.equal(
    pickCheapestMelhorEnvioService({
      id: 1,
      name: 'PAC',
      price: '0.00',
      custom_price: 0,
      delivery_time: 3,
      company: { name: 'Correios' },
    }),
    null,
  );

  assert.equal(DEFAULT_MELHOR_ENVIO_USER_AGENT, 'Lojas Schimitz (schimitzclaiton@gmail.com)');
  assert.equal(resolveMelhorEnvioUserAgent({}), DEFAULT_MELHOR_ENVIO_USER_AGENT);
  assert.equal(resolveMelhorEnvioUserAgent({ MELHOR_ENVIO_USER_AGENT: 'Loja Custom' }), 'Loja Custom');
  assert.equal(MELHOR_ENVIO_CALCULATE_SERVICES, '1,2,3,4,17');

  const tie = pickCheapestMelhorEnvioService([
    { id: 1, name: 'A', price: '10.00', delivery_time: 5, company: { name: 'Correios' } },
    { id: 2, name: 'B', price: '10.00', delivery_time: 2, company: { name: 'Correios' } },
  ]);
  assert.equal(tie?.service, 'B');

  const fallbackPrice = pickCheapestMelhorEnvioService([
    { id: 1, name: 'PAC', custom_price: '0.00', price: '15.50', delivery_time: 4, company: { name: 'Correios' } },
  ]);
  assert.equal(fallbackPrice?.price, 15.5);
  assert.equal(fallbackPrice?.days, 4);

  const bare = buildMelhorEnvioProducts({ subtotal: 100, items: [] });
  assert.equal(bare.assumedPackage, true);
  assert.equal(bare.products[0].weight, DEFAULT_PARCEL_WEIGHT_KG);
  assert.equal(bare.products[0].width, DEFAULT_PARCEL_WIDTH_CM);
  assert.equal(bare.products[0].height, DEFAULT_PARCEL_HEIGHT_CM);
  assert.equal(bare.products[0].length, DEFAULT_PARCEL_LENGTH_CM);

  const weighed = buildMelhorEnvioProducts({
    subtotal: 80,
    items: [{ id: 'sku-1', qty: 2, weightKg: 1.25, widthCm: 20, heightCm: 10, lengthCm: 30, insuranceValue: 40 }],
  });
  assert.equal(weighed.assumedPackage, false);
  assert.equal(weighed.products[0].weight, 1.25);
  assert.equal(weighed.products[0].quantity, 2);
  assert.equal(weighed.products[0].insurance_value, 40);

  const seen: { url?: string; init?: RequestInit } = {};
  const env = {
    MELHOR_ENVIO_TOKEN: TOKEN,
    MELHOR_ENVIO_SANDBOX: 'true',
    MELHOR_ENVIO_ORIGIN_CEP: '90010000',
  };
  const quote = await calculateMelhorEnvioFreight({
    token: TOKEN,
    toCep: '01310100',
    subtotal: 120,
    items: [{ qty: 1, weightKg: 0.8, widthCm: 16, heightCm: 11, lengthCm: 11, insuranceValue: 120 }],
    env,
    fetchImpl: async (url, init) => {
      seen.url = url;
      seen.init = init || {};
      return jsonResponse(fixture);
    },
  });
  assert.ok(seen.url);
  assert.ok(seen.init);
  assert.equal(seen.url, `${MELHOR_ENVIO_SANDBOX_BASE}${MELHOR_ENVIO_CALCULATE_PATH}`);
  assert.ok(!seen.url.includes(TOKEN));
  const headers = seen.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(headers['User-Agent'], DEFAULT_MELHOR_ENVIO_USER_AGENT);
  const body = JSON.parse(String(seen.init?.body));
  assert.equal(body.from.postal_code, '90010000');
  assert.equal(body.to.postal_code, '01310100');
  assert.equal(body.services, MELHOR_ENVIO_CALCULATE_SERVICES);
  assert.equal(body.products[0].weight, 0.8);
  assert.ok(!JSON.stringify(body).includes(TOKEN));
  assert.equal(quote.price, 22.1);
  assert.equal(quote.days, 2);
  assert.equal(quote.service, 'SEDEX');
  assert.equal(quote.company, 'Correios');
  assert.equal(quote.assumedPackage, false);

  const prod = await calculateMelhorEnvioFreight({
    token: TOKEN,
    toCep: '91160390',
    subtotal: 50,
    env: { MELHOR_ENVIO_TOKEN: TOKEN },
    fetchImpl: async (url) => {
      assert.equal(url, `${MELHOR_ENVIO_PRODUCTION_BASE}${MELHOR_ENVIO_CALCULATE_PATH}`);
      return jsonResponse([
        { id: 1, name: 'PAC', price: '9.90', delivery_time: 1, company: { name: 'Correios' } },
      ]);
    },
  });
  assert.equal(prod.originCep, DEFAULT_ORIGIN_CEP);
  assert.equal(prod.assumedPackage, true);
  assert.equal(prod.days, 1);
  assert.equal(prod.price, 9.9);

  const provider = new MelhorEnvioCarrierProvider(async () => jsonResponse(fixture), env);
  const carrierQuote = await provider.quote({ cep: '01310100', subtotal: 10, items: [] });
  assert.equal(carrierQuote.price, 22.1);
  assert.equal(carrierQuote.days, 2);
  assert.equal(carrierQuote.informational, false);
  await assert.rejects(
    () => provider.createLabel({ orderId: 'o1', publicId: 'SCH-X' }),
    (err: unknown) => err instanceof CarrierLiveNotWiredError,
  );
  await assert.rejects(
    () => provider.track({ trackingCode: 'X' }),
    (err: unknown) => err instanceof CarrierLiveNotWiredError,
  );

  let fetched = false;
  const unconfigured = new MelhorEnvioCarrierProvider(async () => {
    fetched = true;
    return jsonResponse(fixture);
  }, {});
  await assert.rejects(
    () => unconfigured.quote({ cep: '01310100', subtotal: 10 }),
    (err: unknown) => err instanceof CarrierNotConfiguredError,
  );
  assert.equal(fetched, false);

  await assert.rejects(
    () =>
      calculateMelhorEnvioFreight({
        token: TOKEN,
        toCep: '01310100',
        subtotal: 10,
        env: {},
        fetchImpl: async () => jsonResponse({ message: 'Unauthenticated' }, 401),
      }),
    (err: unknown) => {
      assert.ok(err instanceof MelhorEnvioQuoteError);
      assert.equal(err.code, 'HTTP');
      assert.equal(err.status, 401);
      assert.ok(!err.message.includes(TOKEN));
      return true;
    },
  );

  const singleQuote = await calculateMelhorEnvioFreight({
    token: TOKEN,
    toCep: '01310100',
    subtotal: 80,
    env: { MELHOR_ENVIO_USER_AGENT: 'Override UA' },
    fetchImpl: async (_url, init) => {
      const sent = init?.headers as Record<string, string>;
      assert.equal(sent['User-Agent'], 'Override UA');
      return jsonResponse(singleService);
    },
  });
  assert.equal(singleQuote.price, 20.15);
  assert.equal(singleQuote.days, 4);
  assert.equal(singleQuote.service, '.Package');
  assert.equal(singleQuote.company, 'Jadlog');

  await assert.rejects(
    () =>
      calculateMelhorEnvioFreight({
        token: TOKEN,
        toCep: '01310100',
        subtotal: 10,
        env: {},
        fetchImpl: async () => jsonResponse([]),
      }),
    (err: unknown) => err instanceof MelhorEnvioQuoteError && err.code === 'NO_OPTION',
  );

  await assert.rejects(
    () =>
      calculateMelhorEnvioFreight({
        token: TOKEN,
        toCep: '01310100',
        subtotal: 10,
        env: {},
        fetchImpl: async () =>
          jsonResponse({
            id: 1,
            name: 'PAC',
            price: '18.00',
            delivery_time: 6,
            company: { name: 'Correios' },
            error: { message: 'indisponível' },
          }),
      }),
    (err: unknown) => err instanceof MelhorEnvioQuoteError && err.code === 'NO_OPTION',
  );

  await assert.rejects(
    () =>
      calculateMelhorEnvioFreight({
        token: TOKEN,
        toCep: '01310100',
        subtotal: 10,
        env: {},
        fetchImpl: async () =>
          jsonResponse({
            message: 'The given data was invalid.',
            errors: { from: ['origem inválida'] },
          }),
      }),
    (err: unknown) => err instanceof MelhorEnvioQuoteError && err.code === 'NO_OPTION',
  );

  const poa = await quoteHybridFreight({
    cep: '91160-390',
    subtotal: 70,
    settings: { freeAbove: 299, defaultFee: 29.9, defaultDays: 5 },
    rules: [
      { cepPrefix: '91', fee: 0, estimatedDays: 1, label: 'Porto Alegre (91) — frete grátis', sortOrder: 10 },
    ],
    quoteCarrier: (input) => provider.quote(input),
  });
  assert.equal(poa.price, 0);
  assert.equal(poa.days, 2);
  assert.equal(poa.carrierPrice, 22.1);
  assert.notEqual(poa.days, 1);

  const sp = await quoteHybridFreight({
    cep: '01310100',
    subtotal: 70,
    settings: { freeAbove: 299, defaultFee: 29.9, defaultDays: 5 },
    rules: [
      { cepPrefix: '91', fee: 0, estimatedDays: 1, label: 'Porto Alegre (91) — frete grátis', sortOrder: 10 },
    ],
    quoteCarrier: (input) => provider.quote(input),
  });
  assert.equal(sp.price, 22.1);
  assert.equal(sp.days, 2);

  console.log('melhor-envio.quote.spec.ts OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
