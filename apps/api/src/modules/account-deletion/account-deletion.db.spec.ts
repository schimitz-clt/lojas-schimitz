/**
 * Pedido + processamento de exclusão de conta — Postgres LOCAL only.
 * Apaga dados pessoais e mantém pedido/cashback/auditoria.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { ConflictException, INestApplicationContext, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { AccountDeletionService } from './account-deletion.service';
import { ANONYMIZED_NAME, DELETION_PROCESSED, DELETION_REQUESTED, anonymizedEmail } from './account-deletion.rules';

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
  console.log('DB_SAFE:', url.replace(/:[^:@]+@/, ':***@'));
}

async function rejects409(p: Promise<unknown>, code?: string) {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof ConflictException, `esperava 409, veio ${String(e)}`);
    if (code) assert.equal((e.getResponse() as { code?: string }).code, code);
    return;
  }
  assert.fail('esperava 409');
}

async function rejects404(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof NotFoundException, `esperava 404, veio ${String(e)}`);
    return;
  }
  assert.fail('esperava 404');
}

async function main() {
  assertLocalDb();
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'del-access-secret-local-xxxxxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'del-refresh-secret-local-xxxxxx';
  delete process.env.SMTP_HOST;
  delete process.env.MAIL_FROM;
  delete process.env.RESEND_API_KEY;
  delete process.env.STORE_NOTIFY_EMAIL;
  delete process.env.ADMIN_EMAIL;

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const svc = app.get(AccountDeletionService);
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const productIds: string[] = [];
  const orderIds: string[] = [];

  try {
    const seller = await prisma.seller.upsert({
      where: { slug: 'lojas-schimitz' },
      update: {},
      create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' },
    });
    const mkProduct = async (n: number) => {
      const p = await prisma.product.create({
        data: {
          name: `Produto exclusão ${tag} ${n}`,
          slug: `produto-exclusao-${tag}-${n}`,
          sku: `DEL-${tag}-${n}`,
          description: 't',
          price: 10,
          active: true,
          sellerId: seller.id,
        },
      });
      productIds.push(p.id);
      return p;
    };
    const p1 = await mkProduct(1);

    const mkUser = async (suffix: string, role: 'customer' | 'admin' = 'customer') => {
      const u = await prisma.user.create({
        data: {
          email: `del-${tag}-${suffix}@lojas-schimitz.test`,
          name: `Cliente ${suffix}`,
          passwordHash: 'not-used',
          role,
          status: 'active',
          phone: '51999990000',
          birthDate: new Date(Date.UTC(1990, 0, 1)),
          cashbackBalance: 7.5,
        },
      });
      userIds.push(u.id);
      return u;
    };
    const user = await mkUser('a');
    const other = await mkUser('b');
    const admin = await mkUser('adm', 'admin');

    // dados pessoais do cliente
    await prisma.address.create({
      data: { userId: user.id, cep: '90010000', street: 'Rua X', number: '1', district: 'Centro', city: 'Porto Alegre', uf: 'RS' },
    });
    await prisma.favorite.create({ data: { userId: user.id, productId: p1.id } });
    const cart = await prisma.cart.create({ data: { userId: user.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: p1.id, qty: 1 } });
    await prisma.notification.create({ data: { userId: user.id, type: 'test', title: 'Oi' } });
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: `h-${tag}`, expiresAt: new Date(Date.now() + 86400000) },
    });
    const device = await prisma.deviceFcmToken.create({ data: { token: `fcm-${tag}`, userId: user.id } });
    await prisma.productViewEvent.create({ data: { deviceId: device.id, productId: p1.id, lastViewedAt: new Date() } });
    await prisma.review.create({ data: { userId: user.id, productId: p1.id, rating: 1, status: 'published' } });
    await prisma.review.create({ data: { userId: other.id, productId: p1.id, rating: 5, status: 'published' } });
    await prisma.product.update({ where: { id: p1.id }, data: { ratingAvg: 3, ratingCount: 2 } });

    const order = await prisma.order.create({
      data: {
        publicId: `DEL${tag}`.toUpperCase(),
        userId: user.id,
        status: 'paid',
        subtotal: 10,
        total: 10,
        addressSnap: { name: 'Cliente a', cep: '90010000' },
      },
    });
    orderIds.push(order.id);

    // status inicial
    assert.equal((await svc.status(user.id)).status, 'none');

    // admin não usa o fluxo
    await rejects409(svc.request(admin.id));

    // pedido idempotente
    const r1 = await svc.request(user.id, '  não uso\nmais ');
    assert.equal(r1.status, 'pending');
    assert.equal(r1.created, true);
    const r2 = await svc.request(user.id);
    assert.equal(r2.created, false);
    assert.equal(
      await prisma.auditLog.count({ where: { entityId: user.id, action: DELETION_REQUESTED } }),
      1,
      'um pedido aberto por usuário',
    );
    // pedir NÃO apaga nada
    assert.equal(await prisma.address.count({ where: { userId: user.id } }), 1);

    // cancelar e pedir de novo
    assert.equal((await svc.cancel(user.id)).status, 'none');
    assert.equal((await svc.request(user.id, 'não uso mais')).status, 'pending');

    // pedido aberto pela loja em nome de outro cliente (WhatsApp)
    await rejects404(svc.requestOnBehalf(admin.id, 'ninguem-' + tag + '@lojas-schimitz.test'));
    const onBehalf = await svc.requestOnBehalf(admin.id, ` DEL-${tag}-B@lojas-schimitz.test `, 'pediu no WhatsApp');
    assert.equal(onBehalf.status, 'pending');
    const obLog = await prisma.auditLog.findFirstOrThrow({ where: { entityId: other.id, action: DELETION_REQUESTED } });
    assert.equal(obLog.actorId, admin.id);
    assert.equal((obLog.meta as { source?: string }).source, 'store_on_behalf');
    assert.equal((await svc.cancel(other.id)).status, 'none');

    // fila do admin
    const pending = await svc.listPending();
    const row = pending.find((p) => p.userId === user.id);
    assert.ok(row, 'pedido aparece para o admin');
    assert.equal(row!.reason, 'não uso mais');
    assert.equal(row!.openOrders, 1);
    assert.equal(row!.blocker, 'open_orders');

    // pedido em andamento bloqueia o processamento
    await rejects409(svc.process(admin.id, user.id), 'ACCOUNT_DELETION_OPEN_ORDERS');
    // sem pedido aberto também
    await rejects409(svc.process(admin.id, other.id), 'ACCOUNT_DELETION_NOT_REQUESTED');

    await prisma.order.update({ where: { id: order.id }, data: { status: 'delivered' } });
    const done = await svc.process(admin.id, user.id);
    assert.equal(done.status, 'processed');
    assert.equal(done.deleted.addresses, 1);
    assert.equal(done.deleted.reviews, 1);
    assert.equal(done.deleted.devices, 1);
    assert.equal(done.deleted.productViews, 1);

    const anon = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(anon.name, ANONYMIZED_NAME);
    assert.equal(anon.email, anonymizedEmail(user.id));
    assert.equal(anon.phone, null);
    assert.equal(anon.cpf, null);
    assert.equal(anon.birthDate, null);
    assert.equal(anon.status, 'blocked');
    assert.notEqual(anon.passwordHash, 'not-used');

    for (const [label, n] of [
      ['address', await prisma.address.count({ where: { userId: user.id } })],
      ['favorite', await prisma.favorite.count({ where: { userId: user.id } })],
      ['cart', await prisma.cart.count({ where: { userId: user.id } })],
      ['notification', await prisma.notification.count({ where: { userId: user.id } })],
      ['refresh', await prisma.refreshToken.count({ where: { userId: user.id } })],
      ['device', await prisma.deviceFcmToken.count({ where: { userId: user.id } })],
      ['view', await prisma.productViewEvent.count({ where: { deviceId: device.id } })],
      ['review', await prisma.review.count({ where: { userId: user.id } })],
    ] as const) {
      assert.equal(n, 0, `${label} deveria ter sido apagado`);
    }

    // mantido: pedido (com addressSnap), cashback, avaliação de outro cliente, auditoria
    const kept = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(kept.userId, user.id);
    assert.ok(kept.addressSnap);
    assert.equal(Number(anon.cashbackBalance), 7.5);
    assert.equal(await prisma.review.count({ where: { userId: other.id } }), 1);
    const prod = await prisma.product.findUniqueOrThrow({ where: { id: p1.id } });
    assert.equal(prod.ratingCount, 1, 'nota recalculada sem a avaliação apagada');
    assert.equal(Number(prod.ratingAvg), 5);
    const processedLog = await prisma.auditLog.findFirst({ where: { entityId: user.id, action: DELETION_PROCESSED } });
    assert.ok(processedLog);
    assert.ok(!JSON.stringify(processedLog!.meta).includes('@lojas-schimitz.test'), 'auditoria sem e-mail');

    assert.equal((await svc.status(user.id)).status, 'processed');
    assert.ok(!(await svc.listPending()).some((p) => p.userId === user.id));
    await rejects409(svc.process(admin.id, user.id), 'ACCOUNT_DELETION_ALREADY_PROCESSED');
    await rejects409(svc.request(user.id));

    console.log('account-deletion.db.spec ok');
  } finally {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.review.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.productViewEvent.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.deviceFcmToken.deleteMany({ where: { token: `fcm-${tag}` } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
