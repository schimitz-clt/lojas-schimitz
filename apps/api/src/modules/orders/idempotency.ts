import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

export type HashItem = { productId: string; qty: number };

export function requireIdempotencyKey(raw?: string): string {
  const key = (raw || '').trim();
  if (!key) {
    throw new BadRequestException({
      message: 'Header Idempotency-Key é obrigatório',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  }
  if (!IDEMPOTENCY_KEY_RE.test(key)) {
    throw new BadRequestException({
      message: 'Idempotency-Key inválida (8–128 caracteres: A-Za-z0-9._:-)',
      code: 'IDEMPOTENCY_KEY_INVALID',
    });
  }
  return key;
}

export function canonicalOrderHash(input: {
  addressId: string;
  couponCode?: string | null;
  cashbackAmount?: number | null;
  items: HashItem[];
}) {
  const items = [...input.items]
    .map((i) => ({ productId: i.productId, qty: i.qty }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
  return createHash('sha256')
    .update(
      JSON.stringify({
        addressId: input.addressId,
        couponCode: input.couponCode || null,
        cashbackAmount: Number(input.cashbackAmount || 0),
        items,
      }),
    )
    .digest('hex');
}
