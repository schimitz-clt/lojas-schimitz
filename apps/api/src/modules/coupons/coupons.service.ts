import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma.service';

export type CreateCouponInput = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses?: number | null;
  active?: boolean;
};

export type UpdateCouponInput = Partial<CreateCouponInput>;

function serializeCoupon(c: {
  id: string;
  code: string;
  type: string;
  value: Decimal | number;
  minSubtotal: Decimal | number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  reservedCount: number;
  active: boolean;
}) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: Number(c.value),
    minSubtotal: c.minSubtotal == null ? null : Number(c.minSubtotal),
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    reservedCount: c.reservedCount,
    active: c.active,
  };
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(code: string, subtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!coupon || !coupon.active) {
      throw new BadRequestException({ message: 'Cupom inválido', code: 'COUPON_INVALID' });
    }
    if (coupon.startsAt && coupon.startsAt > new Date()) {
      throw new BadRequestException({ message: 'Cupom ainda não válido', code: 'COUPON_NOT_STARTED' });
    }
    if (coupon.endsAt && coupon.endsAt < new Date()) {
      throw new BadRequestException({ message: 'Cupom expirado', code: 'COUPON_EXPIRED' });
    }
    if (coupon.maxUses != null && coupon.usedCount + coupon.reservedCount >= coupon.maxUses) {
      throw new BadRequestException({ message: 'Cupom esgotado', code: 'COUPON_EXHAUSTED' });
    }
    if (coupon.minSubtotal && subtotal < Number(coupon.minSubtotal)) {
      throw new BadRequestException({
        message: `Subtotal mínimo do cupom: R$ ${Number(coupon.minSubtotal).toFixed(2).replace('.', ',')}`,
        code: 'COUPON_MIN_SUBTOTAL',
      });
    }

    let discount = 0;
    if (coupon.type === 'percent') {
      discount = subtotal * (Number(coupon.value) / 100);
    } else {
      discount = Number(coupon.value);
    }
    discount = Math.min(discount, subtotal);
    discount = Math.round(discount * 100) / 100;

    return {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discount,
      finalSubtotal: Math.round((subtotal - discount) * 100) / 100,
      minSubtotal: coupon.minSubtotal == null ? null : Number(coupon.minSubtotal),
      endsAt: coupon.endsAt,
    };
  }

  async listAdmin() {
    const rows = await this.prisma.coupon.findMany({ orderBy: { code: 'asc' } });
    return rows.map(serializeCoupon);
  }

  async createAdmin(input: CreateCouponInput) {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      throw new BadRequestException('Código inválido. Use 3–40 caracteres (A-Z, 0-9, _ ou -).');
    }
    if (input.type !== 'percent' && input.type !== 'fixed') {
      throw new BadRequestException('Tipo deve ser percent ou fixed');
    }
    if (!(input.value > 0)) throw new BadRequestException('Valor do cupom deve ser maior que zero');
    if (input.type === 'percent' && input.value > 100) {
      throw new BadRequestException('Percentual máximo é 100');
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) throw new BadRequestException('Data de início inválida');
    if (endsAt && Number.isNaN(endsAt.getTime())) throw new BadRequestException('Data de validade inválida');
    if (startsAt && endsAt && endsAt < startsAt) {
      throw new BadRequestException('Validade deve ser posterior ao início');
    }

    try {
      const row = await this.prisma.coupon.create({
        data: {
          code,
          type: input.type,
          value: new Decimal(input.value),
          minSubtotal:
            input.minSubtotal == null || input.minSubtotal === undefined
              ? null
              : new Decimal(input.minSubtotal),
          startsAt,
          endsAt,
          maxUses: input.maxUses ?? null,
          active: input.active ?? true,
        },
      });
      return serializeCoupon(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um cupom com este código');
      }
      throw e;
    }
  }

  async updateAdmin(id: string, input: UpdateCouponInput) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Cupom não encontrado');

    const data: Prisma.CouponUpdateInput = {};
    if (input.code !== undefined) {
      const code = input.code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
        throw new BadRequestException('Código inválido. Use 3–40 caracteres (A-Z, 0-9, _ ou -).');
      }
      data.code = code;
    }
    if (input.type !== undefined) {
      if (input.type !== 'percent' && input.type !== 'fixed') {
        throw new BadRequestException('Tipo deve ser percent ou fixed');
      }
      data.type = input.type;
    }
    if (input.value !== undefined) {
      if (!(input.value > 0)) throw new BadRequestException('Valor do cupom deve ser maior que zero');
      const type = (input.type ?? existing.type) as string;
      if (type === 'percent' && input.value > 100) {
        throw new BadRequestException('Percentual máximo é 100');
      }
      data.value = new Decimal(input.value);
    }
    if (input.minSubtotal !== undefined) {
      data.minSubtotal = input.minSubtotal == null ? null : new Decimal(input.minSubtotal);
    }
    if (input.startsAt !== undefined) {
      if (input.startsAt == null || input.startsAt === '') data.startsAt = null;
      else {
        const d = new Date(input.startsAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Data de início inválida');
        data.startsAt = d;
      }
    }
    if (input.endsAt !== undefined) {
      if (input.endsAt == null || input.endsAt === '') data.endsAt = null;
      else {
        const d = new Date(input.endsAt);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('Data de validade inválida');
        data.endsAt = d;
      }
    }
    if (input.maxUses !== undefined) data.maxUses = input.maxUses;
    if (input.active !== undefined) data.active = input.active;

    try {
      const row = await this.prisma.coupon.update({ where: { id }, data });
      return serializeCoupon(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um cupom com este código');
      }
      throw e;
    }
  }
}
