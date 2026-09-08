/**
 * SCH-003 — createIntent PIX REAL (Mercado Pago) + persistência em Postgres LOCAL.
 * Valor controlado R$2. NÃO marca paid (PIX fica pending até transferência).
 * NÃO usa Railway DATABASE_URL.
 *
 * Requer env: MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_WEBHOOK_SECRET, DATABASE_URL local.
 */
import assert from 'assert';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { PaymentsService } from './payments.service';
import { MercadoPagoPaymentProvider } from './payment.provider';
import { randomUUID, createHmac } from 'crypto';
import * as argon2 from 'argon2';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) throw new Error('RECUSADO: DATABASE_URL produção');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: host não local');
  console.log('DB_SAFE', url.replace(/:[^:@]+@/, ':***@'));
}

async function main() {
  assertLocalDb();
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) throw new Error('MERCADO_PAGO_ACCESS_TOKEN ausente');
  if (!process.env.MERCADO_PAGO_WEBHOOK_SECRET) throw new Error('MERCADO_PAGO_WEBHOOK_SECRET ausente');

  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.PAYMENTS_PROVIDER = 'mercadopago';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'sch003-live-access-secret-xxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sch003-live-refresh-secret-xxx';
  process.env.PUBLIC_API_URL = process.env.PUBLIC_API_URL || 'https://lojas-schimitz-production.up.railway.app/api/v1';

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const payments = app.get(PaymentsService);

  const email = `sch003-live-${randomUUID().slice(0, 8)}@gmail.com`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash('Test1234ab'),
      name: 'SCH003 Live',
      role: 'customer',
    },
  });

  // Produto R$2 dedicado (precisa sellerId + sku)
  const seller = await prisma.seller.findFirst();
  if (!seller) throw new Error('Sem Seller seed');
  const slug = `sch003-pix-2-${randomUUID().slice(0, 6)}`;
  const product = await prisma.product.create({
    data: {
      sku: `SCH003-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: 'SCH-003 PIX Proof R$2',
      slug,
      description: 'Produto de prova controlada — não vender',
      sellerId: seller.id,
      price: 2,
      active: true,
      inventory: { create: { qtyOnHand: 5, qtyReserved: 0 } },
    },
  });

  await prisma.$executeRaw`
    UPDATE "Inventory" SET "qtyReserved" = "qtyReserved" + 1
    WHERE "productId" = ${product.id} AND ("qtyOnHand" - "qtyReserved") >= 1
  `;

  const order = await prisma.order.create({
    data: {
      publicId: `SCH-LP-${randomUUID().slice(0, 6).toUpperCase()}`,
      userId: user.id,
      status: 'awaiting_payment',
      subtotal: 2,
      discount: 0,
      freight: 0,
      total: 2,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      addressSnap: { cep: '91250000', city: 'Porto Alegre', uf: 'RS' },
      items: {
        create: [{ productId: product.id, name: product.name, qty: 1, unitPrice: 2 }],
      },
    },
  });

  const intent = (await payments.createIntent(
    user.id,
    { orderId: order.id, method: 'pix' },
    `sch003-live-intent-${randomUUID()}`,
  )) as any;

  assert.equal(intent.payment.status, 'pending');
  assert.ok(intent.payment.externalId);
  assert.equal(intent.payment.provider, 'mercadopago');
  assert.ok(intent.payment.payload?.qrCode || intent.payment.payload?.ticketUrl);

  const payRow = await prisma.payment.findUniqueOrThrow({ where: { id: intent.payment.id } });
  assert.equal(payRow.provider, 'mercadopago');
  assert.equal(Number(payRow.amount), 2);
  assert.equal(payRow.status, 'pending');

  console.log('LIVE_INTENT_OK', {
    orderPublicId: order.publicId,
    paymentId: payRow.id,
    mpExternalId: payRow.externalId,
    amount: Number(payRow.amount),
    hasQr: !!(payRow.payload as any)?.qrCode,
  });

  // HMAC real + handleWebhook: fetch MP ainda pending → order NÃO paid (body≠truth)
  const mp = new MercadoPagoPaymentProvider();
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;
  const ext = String(payRow.externalId);
  const requestId = randomUUID();
  const ts = String(Math.floor(Date.now() / 1000));
  const manifest = `id:${ext};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  const eventId = `live-evt-${randomUUID()}`;

  const wh = await payments.handleWebhook(
    { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
    {
      id: eventId,
      type: 'payment',
      data: { id: ext },
      // body tenta approved — verdade vem do fetch MP (ainda pending)
      status: 'approved',
      amount: 2,
    },
  );
  console.log('LIVE_WEBHOOK_RESULT', wh);

  const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(orderAfter.status, 'awaiting_payment', 'não pode paid enquanto MP pending');
  const payAfter = await prisma.payment.findUniqueOrThrow({ where: { id: payRow.id } });
  assert.equal(payAfter.status, 'pending');

  const ev = await prisma.paymentEvent.findFirst({
    where: { provider: 'mercadopago', providerEventId: requestId },
  });
  assert.ok(ev, 'PaymentEvent persistido');
  assert.equal(ev!.applied, true);

  // fetch direto
  const fetched = await mp.fetchPayment(ext);
  assert.equal(fetched.status, 'pending');
  assert.equal(fetched.amount, 2);

  console.log('LIVE_BODY_NE_TRUTH_OK order=awaiting_payment payment=pending mp=pending');
  console.log('SCH003_LIVE_PIX_DB_PASS', {
    orderPublicId: order.publicId,
    mpExternalId: ext,
    paymentEventId: ev!.id,
  });

  // Cleanup: cancelar intent PIX pendente R$2 (não é estorno; evita cobrança órfã)
  await mp.cancelIntent(ext).catch((e) => console.warn('cancelIntent best-effort', String(e?.message || e)));
  console.log('LIVE_CANCEL_BEST_EFFORT_DONE');

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
