import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  DEFAULT_SELLER_ID,
  DEFAULT_SELLER_NAME,
  DEFAULT_SELLER_SLUG,
  canSetSellerStatus,
  publicSellerShape,
  slugifySellerName,
  type SellerStatusValue,
} from './sellers.constants';

export type CreateSellerInput = {
  name: string;
  slug?: string;
  status?: SellerStatusValue;
  ownerUserId?: string | null;
  commissionPercent?: number | null;
};

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensure default seller exists (idempotent). Used by seed / runtime safety. */
  async ensureDefaultSeller() {
    return this.prisma.seller.upsert({
      where: { slug: DEFAULT_SELLER_SLUG },
      update: { name: DEFAULT_SELLER_NAME, status: 'active' },
      create: {
        id: DEFAULT_SELLER_ID,
        name: DEFAULT_SELLER_NAME,
        slug: DEFAULT_SELLER_SLUG,
        status: 'active',
      },
    });
  }

  /**
   * Assign default seller to any product still without sellerId.
   * After SCH-008 migration the column is NOT NULL — typically updates 0 rows.
   */
  async backfillProductsToDefaultSeller() {
    const def = await this.ensureDefaultSeller();
    const updated = await this.prisma.$executeRaw`
      UPDATE "Product"
      SET "sellerId" = ${def.id}
      WHERE "sellerId" IS NULL
    `;
    return { defaultSellerId: def.id, updated: Number(updated) };
  }

  list() {
    return this.prisma.seller.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async create(dto: CreateSellerInput) {
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Nome do vendedor inválido');
    const base = slugifySellerName(dto.slug?.trim() || name);
    const slug = await this.uniqueSlug(base);
    const status = dto.status ?? 'pending';
    if (dto.ownerUserId) {
      const owner = await this.prisma.user.findUnique({ where: { id: dto.ownerUserId } });
      if (!owner) throw new BadRequestException('Usuário dono inválido');
    }
    try {
      return await this.prisma.seller.create({
        data: {
          name,
          slug,
          status,
          ownerUserId: dto.ownerUserId || null,
          commissionPercent:
            dto.commissionPercent == null ? null : new Prisma.Decimal(dto.commissionPercent),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Slug de vendedor já existe');
      }
      throw e;
    }
  }

  async setStatus(id: string, status: SellerStatusValue) {
    const seller = await this.prisma.seller.findUnique({ where: { id } });
    if (!seller) throw new NotFoundException('Vendedor não encontrado');
    if (!canSetSellerStatus(seller.status, status)) {
      throw new BadRequestException(`Status inválido: ${seller.status} → ${status}`);
    }
    return this.prisma.seller.update({
      where: { id },
      data: { status },
    });
  }

  async resolveActiveSellerId(sellerId?: string | null) {
    if (sellerId) {
      const s = await this.prisma.seller.findUnique({ where: { id: sellerId } });
      if (!s) throw new BadRequestException('Vendedor inválido');
      if (s.status === 'suspended') {
        throw new BadRequestException('Vendedor suspenso — não é possível atribuir produtos');
      }
      return s.id;
    }
    const def = await this.ensureDefaultSeller();
    return def.id;
  }


  /**
   * Link owner user (by id or email). Sets User.role=seller when not admin.
   * Clears owner when ownerUserId/email is null/empty.
   */
  async setOwner(
    sellerId: string,
    opts: { ownerUserId?: string | null; ownerEmail?: string | null; commissionPercent?: number | null },
  ) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException('Vendedor não encontrado');

    const data: Prisma.SellerUpdateInput = {};
    const touchOwner = opts.ownerUserId !== undefined || opts.ownerEmail !== undefined;

    if (touchOwner) {
      let ownerUserId: string | null = null;
      const email = opts.ownerEmail?.trim().toLowerCase();
      if (opts.ownerUserId) {
        const owner = await this.prisma.user.findUnique({ where: { id: opts.ownerUserId } });
        if (!owner) throw new BadRequestException('Usuário dono inválido');
        ownerUserId = owner.id;
        if (owner.role === 'customer') {
          await this.prisma.user.update({ where: { id: owner.id }, data: { role: 'seller' } });
        }
      } else if (email) {
        const owner = await this.prisma.user.findUnique({ where: { email } });
        if (!owner) throw new BadRequestException('E-mail não encontrado');
        ownerUserId = owner.id;
        if (owner.role === 'customer') {
          await this.prisma.user.update({ where: { id: owner.id }, data: { role: 'seller' } });
        }
      }
      data.owner = ownerUserId ? { connect: { id: ownerUserId } } : { disconnect: true };
    }

    if (opts.commissionPercent !== undefined) {
      data.commissionPercent =
        opts.commissionPercent == null ? null : new Prisma.Decimal(opts.commissionPercent);
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException('Nada para atualizar');
    }

    return this.prisma.seller.update({
      where: { id: sellerId },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { products: true } },
      },
    });
  }

  toPublic(s: { id: string; name: string; slug: string }) {
    return publicSellerShape(s);
  }

  private async uniqueSlug(base: string) {
    let slug = base;
    let n = 2;
    for (;;) {
      const found = await this.prisma.seller.findUnique({ where: { slug } });
      if (!found) return slug;
      slug = `${base}-${n}`.slice(0, 90);
      n += 1;
    }
  }
}
