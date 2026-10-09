/**
 * Avaliações públicas mostram só "Primeiro S." — unit + Postgres LOCAL.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { publicReviewerName } from './reviews.public';
import { ReviewsService } from './reviews.service';
import { StorefrontService } from '../storefront/storefront.service';

assert.equal(publicReviewerName('Maria Aparecida da Silva'), 'Maria S.');
assert.equal(publicReviewerName('  joão   PEDRO  '), 'João P.');
assert.equal(publicReviewerName('ana'), 'Ana');
assert.equal(publicReviewerName(''), 'Cliente');
assert.equal(publicReviewerName(null), 'Cliente');
assert.equal(publicReviewerName('Élio Ávila'), 'Élio Á.');
assert.equal(publicReviewerName("D'Ávila O'Neil"), "D'ávila O.");
assert.equal(publicReviewerName('maria@exemplo.com'), 'Maria C.', 'nunca expõe e-mail inteiro');
assert.equal(publicReviewerName('Carlos 51999990000'), 'Carlos', 'sem números');

function assertLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL obrigatória');
  if (/railway|rlwy|\.internal/i.test(url)) throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('RECUSADO: DATABASE_URL deve ser localhost/127.0.0.1');
}

async function main() {
  assertLocalDb();
  const prisma = new PrismaClient();
  const tag = randomUUID().slice(0, 8);
  let productId = '';
  let userId = '';
  try {
    const seller = await prisma.seller.upsert({
      where: { slug: 'lojas-schimitz' },
      update: {},
      create: { id: '00000000-0000-4000-8000-000000000001', name: 'Lojas Schimitz', slug: 'lojas-schimitz', status: 'active' },
    });
    const p = await prisma.product.create({
      data: { name: `Rev ${tag}`, slug: `rev-${tag}`, sku: `REV-${tag}`, description: 't', price: 10, active: true, sellerId: seller.id },
    });
    productId = p.id;
    const u = await prisma.user.create({
      data: { email: `rev-${tag}@lojas-schimitz.test`, name: 'Fernanda Souza Lima', passwordHash: 'x', role: 'customer', status: 'active' },
    });
    userId = u.id;
    await prisma.review.create({ data: { productId, userId, rating: 4, body: 'Bom', status: 'published' } });

    const list = await new ReviewsService(prisma as never).listByProduct(productId);
    assert.equal(list.length, 1);
    assert.equal(list[0].user.name, 'Fernanda L.');
    const json = JSON.stringify(list);
    for (const leak of ['Souza Lima', 'Lima', userId, `rev-${tag}@`, '"userId"', '"productId"']) {
      assert.ok(!json.includes(leak), `vazou ${leak}`);
    }

    const home = await new StorefrontService(prisma as never).listPublicReviews(8);
    const mine = home.find((r) => r.productSlug === `rev-${tag}`);
    assert.ok(mine, 'avaliação aparece na home');
    assert.equal(mine!.authorName, 'Fernanda L.');
    assert.ok(!JSON.stringify(home).includes('Souza Lima'));
    console.log('reviews.public.db.spec ok');
  } finally {
    if (productId) await prisma.review.deleteMany({ where: { productId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
