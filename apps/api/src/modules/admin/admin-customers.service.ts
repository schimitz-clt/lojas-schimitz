import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { PAID_REVENUE_STATUSES } from './admin-sales-report';

const CUSTOMER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ADDRESS_SELECT = {
  id: true,
  label: true,
  cep: true,
  street: true,
  number: true,
  complement: true,
  district: true,
  city: true,
  uf: true,
  isDefault: true,
} as const;

const PAIDISH_PAYMENT = new Set(['approved', 'paid', 'authorized', 'captured']);

export type AdminCustomersQuery = {
  q?: string;
  take?: number;
  skip?: number;
};

export type CustomerSpendRow = {
  total: unknown;
  createdAt: Date | string;
  status: string;
};

export type CustomerPaymentLike = {
  method?: string | null;
  status?: string | null;
};

export type CustomerAddressLike = {
  id?: string | null;
  label?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  uf?: string | null;
  isDefault?: boolean;
};

/** Pure: monta filtro Prisma de busca (unit-tested). */
export function buildCustomerWhere(q?: string): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: 'customer' };
  const term = (q || '').trim();
  if (!term) return where;
  where.OR = [
    { email: { contains: term, mode: 'insensitive' } },
    { name: { contains: term, mode: 'insensitive' } },
    { phone: { contains: term, mode: 'insensitive' } },
  ];
  return where;
}

export function clampTake(take?: number, max = 100, fallback = 50): number {
  const n = Number(take);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function isPaidRevenueStatus(status: string): boolean {
  return (PAID_REVENUE_STATUSES as readonly string[]).includes(String(status || ''));
}

/** Pure: lifetime spend + last paid / last any order (newest-first). */
export function summarizeCustomerSpend(
  orders: CustomerSpendRow[],
  opts?: { assumeNewestFirst?: boolean },
): {
  paidTotal: number;
  paidOrdersCount: number;
  lastPaidAt: Date | string | null;
  lastOrderAt: Date | string | null;
} {
  const rows =
    opts?.assumeNewestFirst === false
      ? [...orders].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
      : orders;

  let paidTotal = 0;
  let paidOrdersCount = 0;
  let lastPaidAt: Date | string | null = null;
  let lastOrderAt: Date | string | null = null;

  for (const o of rows) {
    if (!lastOrderAt) lastOrderAt = o.createdAt ?? null;
    if (isPaidRevenueStatus(String(o.status))) {
      paidTotal += Number(o.total) || 0;
      paidOrdersCount += 1;
      if (!lastPaidAt) lastPaidAt = o.createdAt ?? null;
    }
  }

  return {
    paidTotal: roundMoney(paidTotal),
    paidOrdersCount,
    lastPaidAt,
    lastOrderAt,
  };
}

/** Prefer paid/approved payment with method, else first with method. */
export function pickPrimaryPayment(
  payments: CustomerPaymentLike[] | null | undefined,
): CustomerPaymentLike | null {
  const list = (payments || []).filter(Boolean);
  if (!list.length) return null;
  const paid = list.find(
    (p) => PAIDISH_PAYMENT.has(String(p.status || '').toLowerCase()) && p.method,
  );
  if (paid) return paid;
  return list.find((p) => p.method) || list[0];
}

export function serializeCustomerAddress(a: CustomerAddressLike) {
  return {
    id: a.id ?? null,
    label: a.label || 'Casa',
    cep: a.cep || '',
    street: a.street || '',
    number: a.number || '',
    complement: a.complement ?? null,
    district: a.district || '',
    city: a.city || '',
    uf: a.uf || '',
    isDefault: Boolean(a.isDefault),
  };
}

export function pickDefaultAddress<T>(addresses: T[] | null | undefined): T | null {
  const list = addresses || [];
  if (!list.length) return null;
  const flagged = list.find((a) => {
    if (a == null || typeof a !== 'object') return false;
    return Boolean((a as { isDefault?: boolean }).isDefault);
  });
  return flagged ?? list[0];
}

@Injectable()
export class AdminCustomersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: AdminCustomersQuery = {}) {
    const where = buildCustomerWhere(query.q);
    const take = clampTake(query.take);
    const skip = Math.max(0, Math.floor(Number(query.skip) || 0));

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          ...CUSTOMER_SELECT,
          _count: { select: { orders: true } },
          orders: {
            where: { status: { in: [...PAID_REVENUE_STATUSES] } },
            select: { total: true, createdAt: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
          addresses: {
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
            take: 1,
            select: { city: true, uf: true, label: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    const lastOrderAtByUser = new Map<string, Date>();
    if (rows.length) {
      const grouped = await this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: rows.map((u) => u.id) } },
        _max: { createdAt: true },
      });
      for (const g of grouped) {
        if (g.userId && g._max.createdAt) lastOrderAtByUser.set(g.userId, g._max.createdAt);
      }
    }

    const items = rows.map((u) => {
      const spend = summarizeCustomerSpend(u.orders);
      const addr = pickDefaultAddress(u.addresses);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        ordersCount: u._count.orders,
        paidOrdersCount: spend.paidOrdersCount,
        paidTotal: spend.paidTotal,
        lastPaidAt: spend.lastPaidAt,
        lastOrderAt: lastOrderAtByUser.get(u.id) ?? spend.lastOrderAt,
        city: addr?.city ?? null,
        uf: addr?.uf ?? null,
      };
    });

    return { items, total, take, skip };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'customer' },
      select: {
        ...CUSTOMER_SELECT,
        cashbackBalance: true,
        _count: { select: { orders: true, addresses: true } },
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
          select: ADDRESS_SELECT,
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            publicId: true,
            status: true,
            total: true,
            discount: true,
            freight: true,
            createdAt: true,
            items: { select: { name: true, qty: true, unitPrice: true } },
            payments: {
              orderBy: { createdAt: 'desc' },
              select: { method: true, status: true, amount: true },
            },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException({ message: 'Cliente não encontrado', code: 'CUSTOMER_NOT_FOUND' });
    }

    const paidAgg = await this.prisma.order.aggregate({
      where: { userId: user.id, status: { in: [...PAID_REVENUE_STATUSES] } },
      _sum: { total: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    const lastOrderAt = user.orders[0]?.createdAt ?? null;
    const addr = pickDefaultAddress(user.addresses);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      cashbackBalance: Number(user.cashbackBalance),
      ordersCount: user._count.orders,
      addressesCount: user._count.addresses,
      paidOrdersCount: paidAgg._count._all,
      paidTotal: roundMoney(Number(paidAgg._sum.total || 0)),
      lastPaidAt: paidAgg._max.createdAt,
      lastOrderAt,
      city: addr?.city ?? null,
      uf: addr?.uf ?? null,
      addresses: user.addresses.map(serializeCustomerAddress),
      orders: user.orders.map((o) => {
        const pay = pickPrimaryPayment(o.payments);
        return {
          id: o.id,
          publicId: o.publicId,
          status: o.status,
          total: Number(o.total),
          discount: Number(o.discount),
          freight: Number(o.freight),
          createdAt: o.createdAt,
          paymentMethod: pay?.method ?? null,
          paymentStatus: pay?.status ?? null,
          items: o.items.map((it) => ({
            name: it.name,
            qty: it.qty,
            unitPrice: Number(it.unitPrice),
          })),
        };
      }),
    };
  }
}
