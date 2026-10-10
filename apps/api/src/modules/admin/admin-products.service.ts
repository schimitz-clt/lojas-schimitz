import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit.service';
import { diffProductChanges } from './admin-product-changes';
import {
  AdminAddProductImageDto,
  AdminCreateProductDto,
  AdminProductBatchDto,
  AdminUpdateProductDto,
  MAX_PRODUCT_IMAGES,
} from './dto';
import {
  assertNoPlaceholderProductImageUrls,
  collectCreateImageUrls,
  coverUrlToApplyOnUpdate,
} from './admin-product-images';
import { SellersService } from '../sellers/sellers.service';
import { publicProductStory } from '../catalog/product-story';
import { InventoryService } from '../inventory/inventory.service';

type ProductStoryColumns = Pick<
  Prisma.ProductCreateInput,
  'highlights' | 'features' | 'boxContents' | 'faq'
>;

function productStoryColumns(dto: {
  highlights?: string[];
  features?: { label: string; value: string }[];
  boxContents?: string[];
  faq?: { question: string; answer: string }[];
}): ProductStoryColumns {
  const story = publicProductStory(dto);
  const data: ProductStoryColumns = {};
  if (dto.highlights !== undefined) data.highlights = story.highlights;
  if (dto.features !== undefined) data.features = story.features;
  if (dto.boxContents !== undefined) data.boxContents = story.boxContents;
  if (dto.faq !== undefined) data.faq = story.faq;
  return data;
}
import {
  capCatalogErrors,
  catalogRowWarnings,
  matchCategory,
  planCatalogUpserts,
  slugifyProductName,
  validateCatalogCsv,
  type CatalogImportMode,
  type CatalogRowError,
  type CatalogUpsertAction,
  type ValidatedCatalogRow,
} from './catalog-csv';

export type CatalogImportOptions = {
  dryRun?: boolean;
  mode?: CatalogImportMode;
  skipInvalid?: boolean;
};

/** Uma linha da pré-visualização (ordem da planilha). */
export type CatalogPreviewRow = {
  line: number;
  sku: string | null;
  action: 'create' | 'update' | 'error';
  name: string | null;
  price: number | null;
  compareAtPrice: number | null;
  stock: number | null;
  category: string | null;
  photos: number;
  active: boolean | null;
  message: string | null;
  warnings: string[];
};
import {
  adminProductListWindow,
  buildAdminProductSearchWhere,
  isLegacyAdminProductList,
  nextBatchPrice,
  nextBatchStock,
  planProductBatch,
  type AdminProductListInput,
} from './admin-products-query';

const productInclude = {
  inventory: true,
  images: { orderBy: { position: 'asc' as const } },
  category: true,
  seller: { select: { id: true, name: true, slug: true, status: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellers: SellersService,
    private readonly inventory: InventoryService,
    private readonly audit?: AuditService,
  ) {}

  /**
   * Totais do cadastro. sellable = active && !isDemo (mercadoria navegável para venda).
   * demo não entra nessa conta mesmo quando active.
   */
  async catalogCounts() {
    const [total, demo, real, sellable] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isDemo: true } }),
      this.prisma.product.count({ where: { isDemo: false } }),
      this.prisma.product.count({ where: { active: true, isDemo: false } }),
    ]);
    return { total, demo, real, sellable };
  }

  async get(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  list(opts?: AdminProductListInput) {
    const input = opts || {};
    if (isLegacyAdminProductList(input)) {
      return this.prisma.product.findMany({
        where:
          input.lowStock != null
            ? { isDemo: false, inventory: { qtyOnHand: { lte: input.lowStock } } }
            : undefined,
        include: productInclude,
        orderBy:
          input.lowStock != null
            ? [{ inventory: { qtyOnHand: 'asc' } }, { name: 'asc' }]
            : { createdAt: 'desc' },
      });
    }
    const listWindow = adminProductListWindow(input);
    const where = buildAdminProductSearchWhere(input);
    return this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: listWindow.skip,
        take: listWindow.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page: listWindow.page,
      pageSize: listWindow.pageSize,
    }));
  }

  /**
   * Upsert by SKU. Validates the whole file first.
   * A bad row is skipped; other rows continue in their own transaction.
   * Never deletes products or image rows. Empty cells do not clear stored values.
   */
  /**
   * Importação por planilha (CSV já convertido no navegador se veio de .xlsx).
   * - `dryRun`: só confere e devolve a pré-visualização linha a linha. Nada é gravado.
   * - `mode`: `upsert` (padrão) atualiza pelo SKU; `create_only` recusa SKU existente.
   * - `skipInvalid`: com erros, grava só as linhas válidas; sem ele, nada é gravado.
   * Todas as gravações ficam numa única transação: se uma linha falhar no banco,
   * a importação inteira é desfeita. Nunca apaga produto nem foto.
   */
  async importCsv(csv: string, actorId?: string, opts: CatalogImportOptions = {}) {
    const dryRun = opts.dryRun === true;
    const mode: CatalogImportMode = opts.mode === 'create_only' ? 'create_only' : 'upsert';
    const skipInvalid = opts.skipInvalid !== false;
    const base = {
      dryRun,
      mode,
      applied: false,
      created: 0,
      updated: 0,
      failed: 0,
      toCreate: 0,
      toUpdate: 0,
      errors: [] as CatalogRowError[],
      errorsTruncated: false,
      fileError: null as string | null,
      deleted: 0,
      preview: [] as CatalogPreviewRow[],
    };

    const validated = validateCatalogCsv(csv);
    if (validated.fileError) return { ...base, fileError: validated.fileError };

    const existing = await this.findSkus(validated.rows.map((r) => r.sku));
    const plan = planCatalogUpserts(validated.rows, new Set(existing.keys()), mode);
    const errors: CatalogRowError[] = [...validated.errors, ...plan.errors];

    const categories = await this.prisma.category.findMany({
      select: { id: true, slug: true, name: true },
    });
    const takenSlugs = await this.findTakenSlugs(
      plan.actions.filter((a) => a.kind === 'create' && a.row.slug).map((a) => a.row.slug!),
    );

    const actions: CatalogUpsertAction[] = [];
    const preview: CatalogPreviewRow[] = [];
    for (const action of plan.actions) {
      const row = action.row;
      const hit = existing.get(row.sku);
      const category = matchCategory(row.category, categories);
      let problem: string | null = null;
      if (category.kind === 'error') problem = category.message;
      else if (action.kind === 'create' && row.slug && takenSlugs.has(row.slug)) problem = 'Slug já cadastrado';
      else if (action.kind === 'update' && row.stock != null && hit && row.stock < hit.qtyReserved) {
        problem = `Estoque não pode ser menor que a reserva atual (${hit.qtyReserved})`;
      } else if (action.kind === 'update' && row.imageUrls?.length && hit) {
        const add = row.imageUrls.filter((u) => !hit.imageUrls.has(u)).length;
        if (hit.imageUrls.size + add > MAX_PRODUCT_IMAGES) {
          problem = `Limite de ${MAX_PRODUCT_IMAGES} fotos por produto`;
        }
      }
      if (problem) {
        errors.push({ line: row.line, sku: row.sku, message: problem });
        continue;
      }
      actions.push(action);
      preview.push({
        line: row.line,
        sku: row.sku,
        action: action.kind,
        name: row.name ?? hit?.name ?? null,
        price: row.price ?? null,
        compareAtPrice: row.compareAtPrice ?? null,
        stock: row.stock ?? null,
        category: category.kind === 'id' ? categories.find((c) => c.id === category.id)?.name ?? null : null,
        photos: row.imageUrls?.length ?? 0,
        active: row.active ?? (action.kind === 'create' ? true : null),
        message: null,
        warnings: catalogRowWarnings(row, action.kind),
      });
    }
    for (const err of errors) {
      preview.push({
        line: err.line,
        sku: err.sku ?? null,
        action: 'error',
        name: null,
        price: null,
        compareAtPrice: null,
        stock: null,
        category: null,
        photos: 0,
        active: null,
        message: err.message,
        warnings: [],
      });
    }
    preview.sort((a, b) => a.line - b.line);
    errors.sort((a, b) => a.line - b.line);
    const capped = capCatalogErrors(errors);
    const toCreate = actions.filter((a) => a.kind === 'create').length;
    const toUpdate = actions.length - toCreate;
    const summary = {
      ...base,
      failed: errors.length,
      toCreate,
      toUpdate,
      errors: capped.errors,
      errorsTruncated: capped.truncated,
      preview,
    };

    if (!actions.length) {
      return { ...summary, fileError: 'Nenhuma linha válida para gravar. Nada foi gravado.' };
    }
    if (dryRun) return summary;
    if (errors.length && !skipInvalid) {
      return {
        ...summary,
        fileError: `${errors.length} linha(s) com erro. Corrija a planilha ou escolha gravar só as linhas sem erro. Nada foi gravado.`,
      };
    }

    const sellerId = toCreate ? await this.sellers.resolveActiveSellerId(undefined) : null;
    let current: ValidatedCatalogRow | null = null;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const action of actions) {
            current = action.row;
            if (action.kind === 'create') await this.importCreate(tx, action.row, categories, sellerId!);
            else await this.importUpdate(tx, action.row, categories);
          }
        },
        { maxWait: 15_000, timeout: 120_000 },
      );
    } catch (e) {
      const row = current as ValidatedCatalogRow | null;
      const where = row ? `Linha ${row.line} (${row.sku}): ` : '';
      return {
        ...summary,
        fileError: `${where}${this.rowErrorMessage(e)}. A importação inteira foi desfeita. Nada foi gravado.`,
      };
    }

    await this.audit?.log('catalog.import', {
      actorId,
      entity: 'Product',
      meta: { created: toCreate, updated: toUpdate, failed: errors.length, deleted: 0, mode },
    });
    return { ...summary, applied: true, created: toCreate, updated: toUpdate };
  }

  /**
   * Scoped batch: only the SKUs in the request. Unknown SKUs fail that SKU.
   * Does not touch products outside the list and does not delete anything.
   */
  async applyBatch(dto: AdminProductBatchDto, actorId?: string) {
    const plan = planProductBatch(dto);
    if (!plan.ok) throw new BadRequestException(plan.error);
    const found = await this.findSkus(plan.skus);
    const errors: { sku: string; message: string }[] = [];
    let updated = 0;
    for (const sku of plan.skus) {
      const hit = found.get(sku);
      if (!hit) {
        errors.push({ sku, message: 'SKU não encontrado. Nada foi criado.' });
        continue;
      }
      try {
        await this.prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({
            where: { id: hit.id },
            include: { inventory: true },
          });
          if (!product) throw new NotFoundException('SKU não encontrado. Nada foi criado.');
          const data: Prisma.ProductUpdateInput = {};
          if (plan.active !== undefined) data.active = plan.active;
          if (plan.price) {
            const current = Number(product.price);
            const next = nextBatchPrice(current, plan.price.mode, plan.price.value);
            if (next == null) throw new BadRequestException('Preço resultante inválido.');
            data.price = new Prisma.Decimal(next.toFixed(2));
          }
          if (Object.keys(data).length) {
            await tx.product.update({ where: { id: product.id }, data });
          }
          if (plan.stock) {
            const onHand = product.inventory?.qtyOnHand ?? 0;
            const next = nextBatchStock(onHand, plan.stock.mode, plan.stock.value);
            if (next == null) throw new BadRequestException('Estoque resultante inválido.');
            await this.inventory.setOnHandCas(tx, product.id, next);
          }
        });
        updated += 1;
      } catch (e) {
        errors.push({ sku, message: this.rowErrorMessage(e) });
      }
    }
    const capped = capCatalogErrors(errors);
    await this.audit?.log('catalog.batch', {
      actorId,
      entity: 'Product',
      meta: {
        updated,
        failed: errors.length,
        skuCount: plan.skus.length,
        active: plan.active ?? null,
        price: plan.price ?? null,
        stock: plan.stock ?? null,
        deleted: 0,
      },
    });
    return {
      updated,
      failed: errors.length,
      errors: capped.errors,
      errorsTruncated: capped.truncated,
      deleted: 0,
    };
  }

  async create(dto: AdminCreateProductDto, actorId?: string) {
    const name = dto.name.trim();
    const sku = (dto.sku?.trim() || this.generateSku(name)).slice(0, 64);
    const slug = await this.uniqueSlug(this.slugify(name));
    const stock = dto.stock ?? 0;
    const active = dto.active ?? true;

    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new BadRequestException('Categoria inválida');
    }
    const sellerId = await this.sellers.resolveActiveSellerId(dto.sellerId);
    const imageUrls = collectCreateImageUrls(dto, MAX_PRODUCT_IMAGES);
    assertNoPlaceholderProductImageUrls(imageUrls);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku,
            name,
            slug,
            description: dto.description?.trim() ?? '',
            sellerId,
            categoryId: dto.categoryId || null,
            price: new Prisma.Decimal(dto.price),
            compareAtPrice:
              dto.compareAtPrice == null ? null : new Prisma.Decimal(dto.compareAtPrice),
            badge: dto.badge?.trim() || null,
            active,
            isDemo: false,
            ...productStoryColumns(dto),
            inventory: {
              create: { qtyOnHand: stock, qtyReserved: 0 },
            },
            ...(imageUrls.length
              ? {
                  images: {
                    create: imageUrls.map((url, position) => ({
                      url,
                      alt: position === 0 ? name : `${name} — foto ${position + 1}`,
                      position,
                    })),
                  },
                }
              : {}),
          },
          include: productInclude,
        });
        return product;
      });
      await this.audit?.log('product.created', {
        actorId,
        entity: 'Product',
        entityId: created.id,
        meta: { sku: created.sku, name: created.name, price: Number(created.price), stock, active },
      });
      return created;
    } catch (e) {
      this.rethrowUnique(e, 'SKU ou slug já cadastrado');
    }
  }

  async update(id: string, dto: AdminUpdateProductDto, actorId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true, images: { orderBy: { position: 'asc' } } },
    });
    if (!existing) throw new NotFoundException('Produto não encontrado');

    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new BadRequestException('Categoria inválida');
    }

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      data.name = name;
      if (name !== existing.name) {
        data.slug = await this.uniqueSlug(this.slugify(name), existing.id);
      }
    }
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.compareAtPrice !== undefined) {
      data.compareAtPrice =
        dto.compareAtPrice == null ? null : new Prisma.Decimal(dto.compareAtPrice);
    }
    if (dto.sku !== undefined) data.sku = dto.sku.trim();
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.badge !== undefined) data.badge = dto.badge?.trim() || null;
    Object.assign(data, productStoryColumns(dto));
    if (dto.sellerId !== undefined) {
      const sid = await this.sellers.resolveActiveSellerId(dto.sellerId);
      data.seller = { connect: { id: sid } };
    }

    const coverUrl = coverUrlToApplyOnUpdate(dto.imageUrl);
    assertNoPlaceholderProductImageUrls([coverUrl]);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.stock !== undefined) {
          // CAS: qtyOnHand only if qtyReserved <= stock (anti TOCTOU vs concurrent reserve)
          await this.inventory.setOnHandCas(tx, id, dto.stock);
        }

        // Never delete ProductImage rows because imageUrl is empty/null.
        // Clearing photos is DELETE /admin/products/:id/images/:imageId only.
        if (coverUrl) {
          const first = existing.images[0];
          if (first) {
            await tx.productImage.update({
              where: { id: first.id },
              data: { url: coverUrl, alt: (dto.name ?? existing.name).trim() },
            });
          } else {
            await tx.productImage.create({
              data: {
                productId: id,
                url: coverUrl,
                alt: (dto.name ?? existing.name).trim(),
                position: 0,
              },
            });
          }
        }

        return tx.product.update({
          where: { id },
          data,
          include: productInclude,
        });
      });
      const changes = diffProductChanges(existing, dto);
      if (Object.keys(changes).length > 0) {
        await this.audit?.log('product.updated', {
          actorId,
          entity: 'Product',
          entityId: id,
          meta: { sku: updated.sku, changes },
        });
      }
      return updated;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.rethrowUnique(e, 'SKU ou slug já cadastrado');
    }
  }


  /** Adiciona uma foto ao produto (position = próxima; máx. MAX_PRODUCT_IMAGES). */
  async addImage(productId: string, dto: AdminAddProductImageDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    if (product.images.length >= MAX_PRODUCT_IMAGES) {
      throw new BadRequestException(
        `Limite de ${MAX_PRODUCT_IMAGES} fotos por produto`,
      );
    }
    const url = dto.url.trim();
    if (!url) throw new BadRequestException('URL da imagem obrigatória');
    assertNoPlaceholderProductImageUrls([url]);
    const nextPos =
      product.images.length === 0
        ? 0
        : Math.max(...product.images.map((i) => i.position)) + 1;
    await this.prisma.productImage.create({
      data: {
        productId,
        url,
        alt: (dto.alt?.trim() || product.name).slice(0, 160),
        position: nextPos,
      },
    });
    return this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: productInclude,
    });
  }

  /** Remove uma foto e reindexa positions (0 = capa). */
  async deleteImage(productId: string, imageId: string) {
    const img = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!img) throw new NotFoundException('Imagem não encontrada');
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });
      const rest = await tx.productImage.findMany({
        where: { productId },
        orderBy: { position: 'asc' },
      });
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].position !== i) {
          await tx.productImage.update({
            where: { id: rest[i].id },
            data: { position: i },
          });
        }
      }
    });
    return this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: productInclude,
    });
  }

  /**
   * Reordena fotos: índice 0 = capa.
   * `orderedIds` deve listar todas as imagens do produto (sem duplicatas).
   */
  async reorderImages(productId: string, orderedIds: string[]) {
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      throw new BadRequestException('Informe a lista de IDs na ordem desejada');
    }
    const unique = [...new Set(orderedIds.map(String))];
    if (unique.length !== orderedIds.length) {
      throw new BadRequestException('IDs duplicados na reordenação');
    }
    if (unique.length > MAX_PRODUCT_IMAGES) {
      throw new BadRequestException(
        `Limite de ${MAX_PRODUCT_IMAGES} fotos por produto`,
      );
    }
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    const existingIds = new Set(product.images.map((i) => i.id));
    if (unique.length !== existingIds.size) {
      throw new BadRequestException(
        'A reordenação deve incluir todas as fotos do produto',
      );
    }
    for (const id of unique) {
      if (!existingIds.has(id)) {
        throw new NotFoundException(`Imagem não encontrada: ${id}`);
      }
    }
    await this.prisma.$transaction(
      unique.map((id, index) =>
        this.prisma.productImage.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    return this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: productInclude,
    });
  }

  private async importCreate(
    tx: Prisma.TransactionClient,
    row: ValidatedCatalogRow,
    categories: { id: string; slug: string; name: string }[],
    sellerId: string,
  ) {
    const category = matchCategory(row.category, categories);
    if (category.kind === 'error') throw new BadRequestException(category.message);
    const imageUrls = collectCreateImageUrls({ imageUrls: row.imageUrls }, MAX_PRODUCT_IMAGES);
    assertNoPlaceholderProductImageUrls(imageUrls);
    const base = row.slug || slugifyProductName(row.name || row.sku);
    if (row.slug) {
      const taken = await tx.product.findUnique({ where: { slug: row.slug } });
      if (taken) throw new ConflictException('Slug já cadastrado');
    }
    const slug = row.slug || (await this.uniqueSlug(base, undefined, tx));
    const name = row.name!.trim();
    try {
      await tx.product.create({
        data: {
          sku: row.sku,
          name,
          slug,
          description: row.description ?? '',
          sellerId,
          categoryId: category.kind === 'id' ? category.id : null,
          price: new Prisma.Decimal(row.price!.toFixed(2)),
          compareAtPrice:
            row.compareAtPrice == null ? null : new Prisma.Decimal(row.compareAtPrice.toFixed(2)),
          active: row.active ?? true,
          isDemo: false,
          weightKg: row.weightKg == null ? null : new Prisma.Decimal(row.weightKg.toFixed(3)),
          widthCm: row.widthCm == null ? null : new Prisma.Decimal(row.widthCm.toFixed(2)),
          heightCm: row.heightCm == null ? null : new Prisma.Decimal(row.heightCm.toFixed(2)),
          lengthCm: row.lengthCm == null ? null : new Prisma.Decimal(row.lengthCm.toFixed(2)),
          inventory: { create: { qtyOnHand: row.stock ?? 0, qtyReserved: 0 } },
          ...(imageUrls.length
            ? {
                images: {
                  create: imageUrls.map((url, position) => ({
                    url,
                    alt: position === 0 ? name : `${name} — foto ${position + 1}`,
                    position,
                  })),
                },
              }
            : {}),
        },
      });
    } catch (e) {
      this.rethrowUnique(e, 'SKU ou slug já cadastrado');
    }
  }

  private async importUpdate(
    tx: Prisma.TransactionClient,
    row: ValidatedCatalogRow,
    categories: { id: string; slug: string; name: string }[],
  ) {
    const category = matchCategory(row.category, categories);
    if (category.kind === 'error') throw new BadRequestException(category.message);
    const imageUrls = row.imageUrls?.length
      ? collectCreateImageUrls({ imageUrls: row.imageUrls }, MAX_PRODUCT_IMAGES)
      : [];
    assertNoPlaceholderProductImageUrls(imageUrls);

    const existing = await tx.product.findUnique({
      where: { sku: row.sku },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    if (!existing) throw new NotFoundException('SKU não encontrado');
    const data: Prisma.ProductUpdateInput = {};
    if (row.name !== undefined) data.name = row.name;
    if (row.description !== undefined) data.description = row.description;
    if (row.price !== undefined) data.price = new Prisma.Decimal(row.price.toFixed(2));
    if (row.compareAtPrice !== undefined) {
      data.compareAtPrice = new Prisma.Decimal(row.compareAtPrice.toFixed(2));
    }
    if (row.active !== undefined) data.active = row.active;
    if (row.weightKg !== undefined) data.weightKg = new Prisma.Decimal(row.weightKg.toFixed(3));
    if (row.widthCm !== undefined) data.widthCm = new Prisma.Decimal(row.widthCm.toFixed(2));
    if (row.heightCm !== undefined) data.heightCm = new Prisma.Decimal(row.heightCm.toFixed(2));
    if (row.lengthCm !== undefined) data.lengthCm = new Prisma.Decimal(row.lengthCm.toFixed(2));
    if (category.kind === 'id') data.category = { connect: { id: category.id } };
    // Slug stays. Renaming must not invent a new PDP URL.

    if (imageUrls.length) {
      const have = new Set(existing.images.map((img) => img.url));
      const toAdd = imageUrls.filter((url) => !have.has(url));
      if (existing.images.length + toAdd.length > MAX_PRODUCT_IMAGES) {
        throw new BadRequestException(`Limite de ${MAX_PRODUCT_IMAGES} fotos por produto`);
      }
      let position =
        existing.images.length === 0
          ? 0
          : Math.max(...existing.images.map((img) => img.position)) + 1;
      for (const url of toAdd) {
        await tx.productImage.create({
          data: {
            productId: existing.id,
            url,
            alt: `${(row.name ?? existing.name).trim()} — foto ${position + 1}`.slice(0, 160),
            position,
          },
        });
        position += 1;
      }
    }

    if (row.stock !== undefined) {
      await this.inventory.setOnHandCas(tx, existing.id, row.stock);
    }
    if (Object.keys(data).length) {
      await tx.product.update({ where: { id: existing.id }, data });
    }
  }

  private async findTakenSlugs(slugs: string[]): Promise<Set<string>> {
    if (!slugs.length) return new Set();
    const rows = await this.prisma.product.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true },
    });
    return new Set(rows.map((r) => r.slug));
  }

  private async findSkus(skus: string[]) {
    const map = new Map<
      string,
      { id: string; sku: string; name: string; qtyReserved: number; imageUrls: Set<string> }
    >();
    const size = 200;
    for (let i = 0; i < skus.length; i += size) {
      const chunk = skus.slice(i, i + size);
      if (!chunk.length) continue;
      const rows = await this.prisma.product.findMany({
        where: { sku: { in: chunk } },
        select: {
          id: true,
          sku: true,
          name: true,
          inventory: { select: { qtyReserved: true } },
          images: { select: { url: true } },
        },
      });
      for (const row of rows) {
        map.set(row.sku, {
          id: row.id,
          sku: row.sku,
          name: row.name,
          qtyReserved: row.inventory?.qtyReserved ?? 0,
          imageUrls: new Set(row.images.map((img) => img.url)),
        });
      }
    }
    return map;
  }

  private rowErrorMessage(e: unknown): string {
    if (
      e instanceof BadRequestException ||
      e instanceof ConflictException ||
      e instanceof NotFoundException
    ) {
      const res = e.getResponse();
      if (typeof res === 'string') return res;
      if (res && typeof res === 'object' && 'message' in res) {
        const message = (res as { message?: unknown }).message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.map(String).join('; ');
      }
    }
    return 'Falha ao gravar esta linha';
  }

  private slugify(name: string) {
    return slugifyProductName(name);
  }

  private async uniqueSlug(base: string, excludeId?: string, db: Prisma.TransactionClient = this.prisma) {
    let slug = base;
    let n = 2;
    for (;;) {
      const found = await db.product.findUnique({ where: { slug } });
      if (!found || found.id === excludeId) return slug;
      slug = `${base}-${n}`.slice(0, 90);
      n += 1;
    }
  }

  private generateSku(name: string) {
    const prefix = this.slugify(name).replace(/-/g, '').slice(0, 8).toUpperCase() || 'SKU';
    const suffix = Date.now().toString(36).toUpperCase().slice(-6);
    return `${prefix}-${suffix}`;
  }

  private rethrowUnique(e: unknown, message: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw e;
  }
}
