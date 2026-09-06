import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@lojas-schimitz.test').toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || 'change-me-admin-password';
  const passwordHash = await argon2.hash(adminPass);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin', status: 'active' },
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Admin Schimitz',
      role: 'admin',
    },
  });

  const categories = [
    { slug: 'eletro', name: 'Eletro', sort: 1 },
    { slug: 'celulares', name: 'Celulares', sort: 2 },
    { slug: 'informatica', name: 'Informática', sort: 3 },
    { slug: 'eletrodomesticos', name: 'Eletrodomésticos', sort: 4 },
    { slug: 'casa', name: 'Casa', sort: 5 },
    { slug: 'esporte', name: 'Esporte', sort: 6 },
    { slug: 'ofertas', name: 'Ofertas', sort: 7 },
  ];

  const defaultSeller = await prisma.seller.upsert({
    where: { slug: 'lojas-schimitz' },
    update: { name: 'Lojas Schimitz', status: 'active' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Lojas Schimitz',
      slug: 'lojas-schimitz',
      status: 'active',
    },
  });

  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sort: c.sort, active: true },
      create: c,
    });
    catIds[c.slug] = row.id;
  }

  const products = [
    {
      sku: 'TV-55-4K-001',
      name: 'Smart TV 55" 4K',
      slug: 'smart-tv-55-4k',
      description: 'Tela 4K, apps de streaming e som potente. Ideal para a sala.',
      category: 'eletro',
      price: 2299.9,
      compareAtPrice: 2799.9,
      badge: 'Oferta relâmpago',
      qty: 12,
    },
    {
      sku: 'NB-I5-16-001',
      name: 'Notebook i5 16GB 512SSD',
      slug: 'notebook-i5-16gb-512ssd',
      description: 'Desempenho para estudo, trabalho e o dia a dia.',
      category: 'informatica',
      price: 3199.0,
      compareAtPrice: 3699.0,
      badge: 'Semana Tech',
      qty: 8,
    },
    {
      sku: 'SM-128-001',
      name: 'Smartphone 128GB',
      slug: 'smartphone-128gb',
      description: 'Câmera dupla, tela fluida e bateria para o dia inteiro.',
      category: 'celulares',
      price: 1499.0,
      compareAtPrice: 1799.0,
      badge: 'Mais vendido',
      qty: 20,
    },
    {
      sku: 'GEL-FROST-001',
      name: 'Geladeira Frost Free 400L',
      slug: 'geladeira-frost-free-400l',
      description: 'Mais espaço e menos gelo. Economia no consumo.',
      category: 'eletrodomesticos',
      price: 2899.0,
      compareAtPrice: 3299.0,
      badge: 'Casa renovada',
      qty: 5,
    },
    {
      sku: 'ASP-ROBO-001',
      name: 'Aspirador robô',
      slug: 'aspirador-robo',
      description: 'Limpeza automática para o lar.',
      category: 'casa',
      price: 899.0,
      compareAtPrice: 1199.0,
      badge: null,
      qty: 15,
    },
    {
      sku: 'TENIS-RUN-001',
      name: 'Tênis running',
      slug: 'tenis-running',
      description: 'Amortecimento para treinos e caminhada.',
      category: 'esporte',
      price: 249.9,
      compareAtPrice: 329.9,
      badge: 'Esporte',
      qty: 30,
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId: catIds[p.category],
        sellerId: defaultSeller.id,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        badge: p.badge,
        active: true,
      },
      create: {
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId: catIds[p.category],
        sellerId: defaultSeller.id,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        badge: p.badge,
        active: true,
      },
    });

    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: { qtyOnHand: p.qty },
      create: { productId: product.id, qtyOnHand: p.qty, qtyReserved: 0 },
    });

    const hasImg = await prisma.productImage.findFirst({ where: { productId: product.id } });
    if (!hasImg) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: `https://placehold.co/800x800/1a1a1a/f5c518?text=${encodeURIComponent(p.name)}`,
          alt: p.name,
          position: 0,
        },
      });
    }
  }

  await prisma.coupon.upsert({
    where: { code: 'PIX5' },
    update: { active: true, type: 'percent', value: 5 },
    create: {
      code: 'PIX5',
      type: 'percent',
      value: 5,
      minSubtotal: 0,
      active: true,
    },
  });


  await prisma.shippingSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      freeAbove: 299,
      defaultFee: 19.9,
      defaultDays: 5,
    },
  });

  console.log('Seed SCH-001 concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
