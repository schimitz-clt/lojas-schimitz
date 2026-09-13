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
    { slug: 'eletro', name: 'TVs e Áudio', sort: 1 },
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


  // --- Catalog hygiene (idempotent, production-safe) ---
  // Roblox / zero stock → at least 50
  const roblox = await prisma.product.findFirst({
    where: { OR: [{ slug: 'roblox' }, { name: { equals: 'Roblox', mode: 'insensitive' } }] },
    include: { inventory: true },
  });
  if (roblox) {
    const onHand = roblox.inventory?.qtyOnHand ?? 0;
    if (onHand <= 0) {
      await prisma.inventory.upsert({
        where: { productId: roblox.id },
        update: { qtyOnHand: 50 },
        create: { productId: roblox.id, qtyOnHand: 50, qtyReserved: 0 },
      });
      console.log('Seed: Roblox stock set to 50');
    }
  }

  // Soft-disable empty Aiwa duplicate; keep photo copy in Eletrodomésticos
  {
    const aiwas = await prisma.product.findMany({
      where: {
        OR: [
          { slug: { startsWith: 'ar-condicionado-aiwa' } },
          { name: { equals: 'Ar-condicionado aiwa', mode: 'insensitive' } },
        ],
      },
      include: { images: true, orderItems: { select: { id: true }, take: 1 } },
    });
    const isRealPhoto = (url?: string | null) =>
      Boolean(url?.trim()) && !/placehold\.co|placehold\.it|via\.placeholder\.com/i.test(url!);
    const withPhoto = aiwas.filter((p) => p.images.some((i) => isRealPhoto(i.url)));
    // empty OR only placehold.co — worse copy
    const empty = aiwas.filter((p) => !p.images.some((i) => isRealPhoto(i.url)));
    const eletrodom = await prisma.category.findUnique({ where: { slug: 'eletrodomesticos' } });
    if (withPhoto.length && empty.length) {
      const keep = withPhoto.sort((a, b) => Number(b.active) - Number(a.active))[0];
      for (const bad of empty) {
        if (bad.id === keep.id) continue;
        // never hard-delete — soft-disable only (order history preserved if any)
        await prisma.product.update({
          where: { id: bad.id },
          data: { active: false },
        });
        console.log(`Seed: soft-disabled duplicate ${bad.slug}`);
      }
      if (eletrodom && keep.categoryId !== eletrodom.id) {
        await prisma.product.update({
          where: { id: keep.id },
          data: { categoryId: eletrodom.id, active: true },
        });
        console.log(`Seed: kept ${keep.slug} → eletrodomesticos`);
      } else if (!keep.active) {
        await prisma.product.update({ where: { id: keep.id }, data: { active: true } });
      }
      // Transfer promo badge from disabled empty copy if keep has none
      const disabledWithBadge = empty.find((p) => p.id !== keep.id && p.badge);
      if (disabledWithBadge?.badge && !keep.badge) {
        await prisma.product.update({
          where: { id: keep.id },
          data: { badge: disabledWithBadge.badge },
        });
        await prisma.product.update({
          where: { id: disabledWithBadge.id },
          data: { badge: null },
        });
      }
    }
  }

  // Clarify Eletro vs Eletrodomésticos (slug unchanged — no broken links)
  await prisma.category.updateMany({
    where: { slug: 'eletro' },
    data: { name: 'TVs e Áudio', active: true },
  });
  await prisma.category.updateMany({
    where: { slug: 'eletrodomesticos' },
    data: { name: 'Eletrodomésticos', active: true },
  });

  // Active products missing images → placehold.co
  const missingImg = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT p.id, p.name FROM "Product" p
    WHERE p.active = true
      AND NOT EXISTS (
        SELECT 1 FROM "ProductImage" pi
        WHERE pi."productId" = p.id AND pi.url IS NOT NULL AND btrim(pi.url) <> ''
      )
  `;
  for (const row of missingImg) {
    await prisma.productImage.create({
      data: {
        productId: row.id,
        url: `https://placehold.co/800x800/1a1a1a/f5c518?text=${encodeURIComponent(row.name)}`,
        alt: row.name,
        position: 0,
      },
    });
  }
  if (missingImg.length) {
    console.log(`Seed: added placeholders for ${missingImg.length} product(s)`);
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

  for (const d of [
    { cepPrefix: '90', label: 'Porto Alegre (90) — frete grátis' },
    { cepPrefix: '91', label: 'Porto Alegre (91) — frete grátis' },
  ] as const) {
    const exists = await prisma.shippingCepRule.findFirst({ where: { cepPrefix: d.cepPrefix } });
    if (!exists) {
      await prisma.shippingCepRule.create({
        data: {
          cepPrefix: d.cepPrefix,
          fee: 0,
          estimatedDays: 1,
          label: d.label,
          active: true,
          sortOrder: 10,
        },
      });
    }
  }


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
