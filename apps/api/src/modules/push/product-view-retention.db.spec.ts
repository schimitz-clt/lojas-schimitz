/**
 * Retenção de produtos vistos (90 dias) — Postgres LOCAL only.
 * Apaga só o que passou do prazo; idempotente; não toca no aparelho nem em visitas recentes.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  PRODUCT_VIEW_RETENTION_EVERY_MS,
  productViewRetentionCutoff,
  productViewRetentionDue,
  purgeExpiredProductViews,
} from './product-view-retention';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
}

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  // regras puras
  const now = new Date('2026-10-09T12:00:00.000Z');
  assert.equal(productViewRetentionCutoff(now).toISOString(), '2026-07-11T12:00:00.000Z');
  assert.equal(productViewRetentionDue(null, 0), true);
  assert.equal(productViewRetentionDue(1000, 1000 + PRODUCT_VIEW_RETENTION_EVERY_MS - 1), false);
  assert.equal(productViewRetentionDue(1000, 1000 + PRODUCT_VIEW_RETENTION_EVERY_MS), true);

  assertLocalDb();
  const prisma = new PrismaClient();
  const tag = randomUUID().slice(0, 8);
  const productIds: string[] = [];
  try {
    const seller = await prisma.seller.upsert({
      where: { slug: 'lojas-schimitz' },
      update: {},
      create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' },
    });
    for (const n of [1, 2, 3]) {
      const p = await prisma.product.create({
        data: { name: `Ret ${tag} ${n}`, slug: `ret-${tag}-${n}`, sku: `RET-${tag}-${n}`, description: 't', price: 10, active: true, sellerId: seller.id },
      });
      productIds.push(p.id);
    }
    const device = await prisma.deviceFcmToken.create({ data: { token: `ret-fcm-${tag}` } });
    const at = (days: number) => new Date(now.getTime() - days * DAY);
    await prisma.productViewEvent.createMany({
      data: [
        { deviceId: device.id, productId: productIds[0], lastViewedAt: at(120) }, // apaga
        { deviceId: device.id, productId: productIds[1], lastViewedAt: at(90.01) }, // apaga (passou do prazo)
        { deviceId: device.id, productId: productIds[2], lastViewedAt: at(89) }, // mantém
      ],
    });
    await prisma.abandonedViewPush.createMany({
      data: [
        { deviceId: device.id, productId: productIds[0], status: 'sent', tokenFingerprint: 'fp', sentAt: at(200) },
        { deviceId: device.id, productId: productIds[2], status: 'sent', tokenFingerprint: 'fp', sentAt: at(3) },
      ],
    });

    const first = await purgeExpiredProductViews(prisma, now);
    assert.ok(first.views >= 2, `apagou views antigas: ${first.views}`);
    assert.ok(first.pushes >= 1, `apagou pushes antigos: ${first.pushes}`);
    const left = await prisma.productViewEvent.findMany({ where: { deviceId: device.id }, select: { productId: true } });
    assert.deepEqual(left.map((r) => r.productId), [productIds[2]], 'só a visita recente fica');
    assert.equal(await prisma.abandonedViewPush.count({ where: { deviceId: device.id } }), 1);
    assert.ok(await prisma.deviceFcmToken.findUnique({ where: { id: device.id } }), 'aparelho não é apagado');

    const second = await purgeExpiredProductViews(prisma, now);
    assert.equal(second.views, 0, 'idempotente');
    assert.equal(second.pushes, 0, 'idempotente');
    assert.equal(await prisma.productViewEvent.count({ where: { deviceId: device.id } }), 1);

    await prisma.deviceFcmToken.delete({ where: { id: device.id } });
    console.log('product-view-retention.db.spec ok');
  } finally {
    await prisma.productViewEvent.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.abandonedViewPush.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.deviceFcmToken.deleteMany({ where: { token: `ret-fcm-${tag}` } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
