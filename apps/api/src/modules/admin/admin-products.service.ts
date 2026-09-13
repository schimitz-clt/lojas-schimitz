import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  AdminAddProductImageDto,
  AdminCreateProductDto,
  AdminUpdateProductDto,
  MAX_PRODUCT_IMAGES,
} from './dto';
import { SellersService } from '../sellers/sellers.service';
import { InventoryService } from '../inventory/inventory.service';

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
  ) {}

  list(opts?: { lowStock?: number }) {
    return this.prisma.product.findMany({
      where:
        opts?.lowStock != null
          ? { inventory: { qtyOnHand: { lte: opts.lowStock } } }
          : undefined,
      include: productInclude,
      orderBy:
        opts?.lowStock != null
          ? [{ inventory: { qtyOnHand: 'asc' } }, { name: 'asc' }]
          : { createdAt: 'desc' },
    });
  }

  async create(dto: AdminCreateProductDto) {
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

    try {
      return await this.prisma.$transaction(async (tx) => {
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
            inventory: {
              create: { qtyOnHand: stock, qtyReserved: 0 },
            },
            ...(dto.imageUrl
              ? {
                  images: {
                    create: {
                      url: dto.imageUrl.trim(),
                      alt: name,
                      position: 0,
                    },
                  },
                }
              : {}),
          },
          include: productInclude,
        });
        return product;
      });
    } catch (e) {
      this.rethrowUnique(e, 'SKU ou slug já cadastrado');
    }
  }

  async update(id: string, dto: AdminUpdateProductDto) {
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
    if (dto.sellerId !== undefined) {
      const sid = await this.sellers.resolveActiveSellerId(dto.sellerId);
      data.seller = { connect: { id: sid } };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.stock !== undefined) {
          // CAS: qtyOnHand only if qtyReserved <= stock (anti TOCTOU vs concurrent reserve)
          await this.inventory.setOnHandCas(tx, id, dto.stock);
        }

        if (dto.imageUrl !== undefined) {
          const url = dto.imageUrl?.trim() || '';
          const first = existing.images[0];
          if (!url) {
            if (first) await tx.productImage.delete({ where: { id: first.id } });
          } else if (first) {
            await tx.productImage.update({
              where: { id: first.id },
              data: { url, alt: (dto.name ?? existing.name).trim() },
            });
          } else {
            await tx.productImage.create({
              data: {
                productId: id,
                url,
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

  private slugify(name: string) {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'produto';
  }

  private async uniqueSlug(base: string, excludeId?: string) {
    let slug = base;
    let n = 2;
    for (;;) {
      const found = await this.prisma.product.findUnique({ where: { slug } });
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
