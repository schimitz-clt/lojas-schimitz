/**
 * Importação por planilha contra Postgres real (CI / local). Nunca produção.
 * - dryRun não grava nada e devolve a pré-visualização linha a linha.
 * - Gravação cria e atualiza pelo SKU numa única transação.
 * - Falha no meio desfaz tudo (nenhum produto novo fica gravado).
 * - create_only não altera SKU existente; skipInvalid=false não grava nada com erro.
 * Só toca produtos/categoria criados aqui (prefixo TMP-IMP-) e apaga tudo no fim.
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { SellersService } from '../sellers/sellers.service';
import { AdminProductsService } from './admin-products.service';

function assertNotProductionDb(url: string) {
  if (/railway|rlwy|\.internal/i.test(url)) {
    throw new Error('RECUSADO: DATABASE_URL parece produção/Railway');
  }
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    console.log('catalog-import.db.spec SKIP (sem DATABASE_URL)');
    return;
  }
  assertNotProductionDb(url);

  const prisma = new PrismaService();
  const inventory = new InventoryService();
  const products = new AdminProductsService(prisma, new SellersService(prisma), inventory);

  await prisma.seller.upsert({
    where: { slug: 'lojas-schimitz' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Lojas Schimitz',
      slug: 'lojas-schimitz',
      status: 'active',
    },
  });

  const tag = randomUUID().slice(0, 8).toUpperCase();
  const P = `TMP-IMP-${tag}`;
  const catSlug = `tmp-imp-${tag.toLowerCase()}`;
  const category = await prisma.category.create({
    data: { slug: catSlug, name: `Categoria Import ${tag}` },
  });
  const header = 'sku;nome;descricao;categoria;preco;preco_de;estoque;ativo;peso_kg;largura_cm;altura_cm;comprimento_cm;fotos';

  const cleanup = async () => {
    await prisma.product.deleteMany({ where: { sku: { startsWith: P } } });
    await prisma.category.delete({ where: { id: category.id } }).catch(() => undefined);
  };

  try {
    // Produto existente (o import deve só atualizar o que a planilha traz).
    const seller = await prisma.seller.findUniqueOrThrow({ where: { slug: 'lojas-schimitz' } });
    await prisma.product.create({
      data: {
        sku: `${P}-OLD`,
        name: 'Produto antigo do teste',
        slug: `${catSlug}-old`,
        description: 'descrição original',
        price: 100,
        sellerId: seller.id,
        inventory: { create: { qtyOnHand: 1, qtyReserved: 0 } },
      },
    });

    const csv = [
      header,
      `${P}-A;Geladeira teste import;Frost free;${catSlug};2.999,90;3.499,90;5;sim;60;70;175;70;https://cdn.example/${tag}-a1.jpg|https://cdn.example/${tag}-a2.jpg`,
      `${P}-B;Ventilador teste import;;Categoria Import ${tag};199,90;;10;sim;;;;;`,
      `${P}-OLD;;;;89,90;;7;;;;;;`,
      `${P}-C;Sem preço;;;;;;;;;;;`,
      `${P}-D;Categoria errada;;nao-existe-${tag};10;;1;;;;;;`,
      `EXEMPLO-${tag};Linha de exemplo;;;10;;1;;;;;;`,
    ].join('\n');

    // 1) dryRun: nada gravado, pré-visualização completa e em ordem.
    const dry = await products.importCsv(csv, undefined, { dryRun: true });
    assert.equal(dry.dryRun, true);
    assert.equal(dry.applied, false);
    assert.equal(dry.toCreate, 2, JSON.stringify(dry.preview));
    assert.equal(dry.toUpdate, 1);
    assert.equal(dry.failed, 3);
    assert.deepEqual(dry.preview.map((r) => r.line), [2, 3, 4, 5, 6, 7]);
    assert.deepEqual(dry.preview.map((r) => r.action), ['create', 'create', 'update', 'error', 'error', 'error']);
    assert.equal(dry.preview[0].category, `Categoria Import ${tag}`);
    assert.equal(dry.preview[0].photos, 2);
    assert.deepEqual(dry.preview[0].warnings, []);
    assert.ok(dry.preview[1].warnings.some((w) => /peso ou medidas/.test(w)));
    assert.equal(dry.preview[2].name, 'Produto antigo do teste');
    assert.match(dry.preview[3].message || '', /Preço obrigatório/);
    assert.match(dry.preview[4].message || '', /Categoria não encontrada/);
    assert.match(dry.preview[5].message || '', /Linha de exemplo/);
    assert.equal(await prisma.product.count({ where: { sku: { startsWith: `${P}-A` } } }), 0, 'dryRun não grava');
    console.log('catalog-import.db: dryRun sem gravar — PASSOU');

    // 2) skipInvalid=false com erros: nada gravado.
    const blocked = await products.importCsv(csv, undefined, { skipInvalid: false });
    assert.equal(blocked.applied, false);
    assert.match(blocked.fileError || '', /Nada foi gravado/);
    assert.equal(await prisma.product.count({ where: { sku: { in: [`${P}-A`, `${P}-B`] } } }), 0);
    console.log('catalog-import.db: com erros e sem skipInvalid, nada gravado — PASSOU');

    // 3) Rollback: falha no meio desfaz a linha já criada antes dela.
    const original = inventory.setOnHandCas.bind(inventory);
    inventory.setOnHandCas = async () => {
      throw new Error('falha simulada no banco');
    };
    try {
      const failed = await products.importCsv(csv, undefined, { skipInvalid: true });
      assert.equal(failed.applied, false);
      assert.match(failed.fileError || '', /Linha 4/);
      assert.match(failed.fileError || '', /desfeita/);
    } finally {
      inventory.setOnHandCas = original;
    }
    assert.equal(
      await prisma.product.count({ where: { sku: { in: [`${P}-A`, `${P}-B`] } } }),
      0,
      'linhas criadas antes da falha foram desfeitas',
    );
    const oldAfterFail = await prisma.product.findUniqueOrThrow({
      where: { sku: `${P}-OLD` },
      include: { inventory: true },
    });
    assert.equal(Number(oldAfterFail.price), 100);
    console.log('catalog-import.db: transação desfaz tudo na falha — PASSOU');

    // 4) Gravação: cria A e B, atualiza OLD só nos campos preenchidos.
    const done = await products.importCsv(csv, 'tester', { skipInvalid: true });
    assert.equal(done.applied, true, done.fileError || '');
    assert.equal(done.created, 2);
    assert.equal(done.updated, 1);
    assert.equal(done.failed, 3);
    const a = await prisma.product.findUniqueOrThrow({
      where: { sku: `${P}-A` },
      include: { images: { orderBy: { position: 'asc' } }, inventory: true },
    });
    assert.equal(Number(a.price), 2999.9);
    assert.equal(Number(a.compareAtPrice), 3499.9);
    assert.equal(Number(a.weightKg), 60);
    assert.equal(Number(a.heightCm), 175);
    assert.equal(a.categoryId, category.id);
    assert.equal(a.isDemo, false);
    assert.equal(a.active, true);
    assert.equal(a.inventory?.qtyOnHand, 5);
    assert.deepEqual(a.images.map((i) => i.url), [`https://cdn.example/${tag}-a1.jpg`, `https://cdn.example/${tag}-a2.jpg`]);
    const old = await prisma.product.findUniqueOrThrow({ where: { sku: `${P}-OLD` }, include: { inventory: true } });
    assert.equal(Number(old.price), 89.9);
    assert.equal(old.name, 'Produto antigo do teste', 'célula vazia não apaga nome');
    assert.equal(old.description, 'descrição original');
    assert.equal(old.inventory?.qtyOnHand, 7);
    assert.equal(await prisma.product.count({ where: { sku: { startsWith: 'EXEMPLO-' + tag } } }), 0);
    console.log('catalog-import.db: cria e atualiza pelo SKU — PASSOU');

    // 5) create_only: SKU existente não muda; reimportar não duplica.
    const again = await products.importCsv(
      [header, `${P}-A;Nome novo;;;1,00;;1;;;;;;`].join('\n'),
      undefined,
      { mode: 'create_only', skipInvalid: true },
    );
    assert.equal(again.applied, false);
    assert.match(again.preview[0].message || '', /já cadastrado/);
    const aAfter = await prisma.product.findUniqueOrThrow({ where: { sku: `${P}-A` } });
    assert.equal(Number(aAfter.price), 2999.9);
    assert.equal(await prisma.product.count({ where: { sku: `${P}-A` } }), 1);
    console.log('catalog-import.db: create_only não altera nem duplica — PASSOU');

    console.log('catalog-import.db.spec ok');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
