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

export type AdminCustomersQuery = {
  q?: string;
  take?: number;
  skip?: number;
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
            select: { total: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    const items = rows.map((u) => {
      const paidOrders = u.orders;
      const paidTotal = paidOrders.reduce((s, o) => s + Number(o.total), 0);
      const lastPaidAt = paidOrders[0]?.createdAt ?? null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        ordersCount: u._count.orders,
        paidOrdersCount: paidOrders.length,
        paidTotal: Math.round((paidTotal + Number.EPSILON) * 100) / 100,
        lastPaidAt,
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
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException({ message: 'Cliente não encontrado', code: 'CUSTOMER_NOT_FOUND' });
    }

    const paidOrders = user.orders.filter((o) =>
      (PAID_REVENUE_STATUSES as readonly string[]).includes(o.status),
    );
    const paidTotal = paidOrders.reduce((s, o) => s + Number(o.total), 0);

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
      paidOrdersCount: paidOrders.length,
      paidTotal: Math.round((paidTotal + Number.EPSILON) * 100) / 100,
      orders: user.orders.map((o) => ({
        id: o.id,
        publicId: o.publicId,
        status: o.status,
        total: Number(o.total),
        discount: Number(o.discount),
        freight: Number(o.freight),
        createdAt: o.createdAt,
        items: o.items.map((it) => ({
          name: it.name,
          qty: it.qty,
          unitPrice: Number(it.unitPrice),
        })),
      })),
    };
  }
}
