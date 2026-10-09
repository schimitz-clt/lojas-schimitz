/**
 * Rastreio manual + aviso ao cliente — unit + Postgres LOCAL (AppModule, e-mail desligado e espionado).
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma.service';
import { MailService } from '../mail/mail.service';
import { orderShippedEmail, orderTrackingEmail } from '../mail/mail.templates';
import { buildMailIdempotencyKey } from '../mail/mail.config';
import { OrdersService } from './orders.service';
import { carrierLabel, normalizeCarrier, normalizeTrackingCode, trackingSentence } from './tracking-code';

// ---- unit
assert.equal(normalizeTrackingCode(' aa 123456789 br '), 'AA123456789BR');
assert.equal(normalizeTrackingCode('ME-2026-0001'), 'ME-2026-0001');
assert.equal(normalizeTrackingCode('abc'), null);
assert.equal(normalizeTrackingCode('<script>'), null);
assert.equal(normalizeTrackingCode(''), null);
assert.equal(normalizeTrackingCode('X'.repeat(41)), null);
assert.equal(normalizeCarrier(' Correios '), 'correios');
assert.equal(normalizeCarrier('Melhor Envio'), 'melhor_envio');
assert.equal(carrierLabel('jadlog'), 'Jadlog');
assert.equal(carrierLabel('nova_transp'), 'Nova transp');
assert.equal(carrierLabel(null), null);
assert.equal(trackingSentence('AA1BR', 'correios'), 'Código de rastreio (Correios): AA1BR.');
assert.equal(trackingSentence('AA1BR', 'propria'), 'Código de rastreio: AA1BR.');
{
  const m = orderShippedEmail({ publicId: 'SCH-1', total: 10, trackingCode: 'AA123BR', carrierLabel: 'Correios' });
  assert.match(m.text, /Código de rastreio \(Correios\): AA123BR/);
  assert.match(m.html, /AA123BR/);
  const none = orderShippedEmail({ publicId: 'SCH-1', total: 10 });
  assert.ok(!/rastreio/i.test(none.text), 'sem código, sem linha de rastreio');
  const t = orderTrackingEmail({ publicId: 'SCH-1', total: 10, trackingCode: 'AA123BR', carrierLabel: '<b>X</b>' });
  assert.match(t.subject, /Código de rastreio — SCH-1/);
  assert.ok(t.html.includes('&lt;b&gt;X&lt;/b&gt;'), 'HTML escapado');
  assert.equal(
    buildMailIdempotencyKey({ kind: 'order_tracking', to: 'A@B.com', publicId: 'SCH-1', statusLabel: 'AA1BR' }),
    'order_tracking:SCH-1:AA1BR:a@b.com',
  );
}

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
}

async function expectErr(p: Promise<unknown>, cls: new (...a: any[]) => Error, code?: string) {
  try {
    await p;
  } catch (e: any) {
    assert.ok(e instanceof cls, `esperava ${cls.name}, veio ${e}`);
    if (code) assert.equal((e as any).getResponse().code, code);
    return;
  }
  assert.fail(`esperava ${cls.name}`);
}

async function main() {
  assertLocalDb();
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'trk-access-secret-local-xxxxxxx';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'trk-refresh-secret-local-xxxxxx';
  delete process.env.SMTP_HOST;
  delete process.env.MAIL_FROM;
  delete process.env.RESEND_API_KEY;

  const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const orders = app.get(OrdersService);
  const mail = app.get(MailService);
  const sent: { kind: string; to: string; ctx: any }[] = [];
  (mail as any).notifyOrderTracking = async (to: string, ctx: any) => {
    sent.push({ kind: 'tracking', to, ctx });
    return { sent: false };
  };
  (mail as any).notifyOrderShipped = async (to: string, ctx: any) => {
    sent.push({ kind: 'shipped', to, ctx });
    return { sent: false };
  };

  const tag = randomUUID().slice(0, 8).toUpperCase();
  const ids = { user: '', admin: '', orders: [] as string[] };
  try {
    const user = await prisma.user.create({
      data: { email: `trk-${tag.toLowerCase()}@lojas-schimitz.test`, name: 'Cliente Rastreio', passwordHash: 'x', role: 'customer', status: 'active' },
    });
    const admin = await prisma.user.create({
      data: { email: `trk-adm-${tag.toLowerCase()}@lojas-schimitz.test`, name: 'Admin', passwordHash: 'x', role: 'admin', status: 'active' },
    });
    ids.user = user.id;
    ids.admin = admin.id;
    const mk = async (status: 'paid' | 'ready_for_pickup' | 'in_transit') => {
      const o = await prisma.order.create({
        data: { publicId: `SCH-TRK-${tag}-${status}`, userId: user.id, status, subtotal: 10, total: 10 },
      });
      ids.orders.push(o.id);
      return o;
    };
    const paid = await mk('paid');
    const ready = await mk('ready_for_pickup');
    const transit = await mk('in_transit');

    await expectErr(orders.adminUpdateTracking(admin.id, paid.id, { trackingCode: 'AA123456789BR' }), ConflictException, 'TRACKING_NOT_EDITABLE');
    await expectErr(orders.adminUpdateTracking(admin.id, transit.id, { trackingCode: 'x' }), BadRequestException, 'TRACKING_CODE_INVALID');

    const r1 = await orders.adminUpdateTracking(admin.id, transit.id, { trackingCode: 'aa123456789br', carrier: 'Correios' });
    assert.equal(r1.changed, true);
    assert.equal(r1.notified, true);
    const row = await prisma.order.findUniqueOrThrow({ where: { id: transit.id } });
    assert.equal(row.trackingCode, 'AA123456789BR');
    assert.equal(row.carrier, 'correios');
    const notes = await prisma.notification.findMany({ where: { orderId: transit.id, type: 'order_tracking' } });
    assert.equal(notes.length, 1);
    assert.match(notes[0].body, /Correios\): AA123456789BR/);
    assert.equal(sent.filter((s) => s.kind === 'tracking').length, 1);
    assert.equal(sent[0].ctx.trackingCode, 'AA123456789BR');
    assert.equal(sent[0].ctx.carrierLabel, 'Correios');
    assert.ok(await prisma.auditLog.findFirst({ where: { entityId: transit.id, action: 'order.tracking_updated' } }));

    // mesmo código de novo: nada muda, ninguém é avisado de novo
    const r2 = await orders.adminUpdateTracking(admin.id, transit.id, { trackingCode: 'AA123456789BR' });
    assert.equal(r2.changed, false);
    assert.equal(r2.notified, false);
    assert.equal(await prisma.notification.count({ where: { orderId: transit.id, type: 'order_tracking' } }), 1);
    assert.equal(sent.filter((s) => s.kind === 'tracking').length, 1);

    // só a transportadora muda: salva, sem novo aviso
    const r3 = await orders.adminUpdateTracking(admin.id, transit.id, { trackingCode: 'AA123456789BR', carrier: 'jadlog' });
    assert.equal(r3.changed, true);
    assert.equal(r3.notified, false);

    // código corrigido: avisa de novo
    const r4 = await orders.adminUpdateTracking(admin.id, transit.id, { trackingCode: 'AA999999999BR' });
    assert.equal(r4.notified, true);
    assert.equal(await prisma.notification.count({ where: { orderId: transit.id, type: 'order_tracking' } }), 2);

    // avançar para em trânsito com código: in-app e e-mail de envio levam o código
    await orders.adminUpdateFulfillmentStatus(admin.id, ready.id, 'in_transit', { trackingCode: 'ME-2026-77', carrier: 'melhor_envio' });
    const shippedNote = await prisma.notification.findFirst({ where: { orderId: ready.id, userId: ids.user }, orderBy: { createdAt: 'desc' } });
    assert.ok(shippedNote?.body.includes('ME-2026-77'), `in-app com código: ${shippedNote?.body}`);
    const shippedMail = sent.find((s) => s.kind === 'shipped');
    assert.equal(shippedMail?.ctx.trackingCode, 'ME-2026-77');
    assert.equal(shippedMail?.ctx.carrierLabel, 'Melhor Envio');

    console.log('tracking-manual.db.spec ok');
  } finally {
    await prisma.notification.deleteMany({ where: { orderId: { in: ids.orders } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids.orders } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: ids.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
    await prisma.notification.deleteMany({ where: { userId: { in: [ids.user, ids.admin].filter(Boolean) } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.user, ids.admin].filter(Boolean) } } });
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
