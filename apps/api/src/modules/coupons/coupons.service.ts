import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(code: string, subtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon || !coupon.active) throw new BadRequestException('Cupom inválido');
    if (coupon.startsAt && coupon.startsAt > new Date()) throw new BadRequestException('Cupom ainda não válido');
    if (coupon.endsAt && coupon.endsAt < new Date()) throw new BadRequestException('Cupom expirado');
    if (coupon.maxUses != null && coupon.usedCount + coupon.reservedCount >= coupon.maxUses) {
      throw new BadRequestException('Cupom esgotado');
    }
    if (coupon.minSubtotal && subtotal < Number(coupon.minSubtotal)) {
      throw new BadRequestException('Subtotal abaixo do mínimo do cupom');
    }

    let discount = 0;
    if (coupon.type === 'percent') {
      discount = subtotal * (Number(coupon.value) / 100);
    } else {
      discount = Number(coupon.value);
    }
    discount = Math.min(discount, subtotal);

    return {
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discount,
      finalSubtotal: subtotal - discount,
    };
  }
}
