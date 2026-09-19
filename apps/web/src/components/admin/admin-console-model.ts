/** Types, form factories and local helpers for the Admin console. */
import { resolveOrderWhatsApp } from '@/lib/whatsapp';
import { ADMIN_ORDER_QUEUE_BUCKETS, adminQueueBucketLabel, orderStatusLabel } from '@/lib/order-status';
import { separarPrimaryLabel } from '@/lib/admin-ops-ui';

export type AdminOrder = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  freight?: number | string | null;
  trackingCode?: string | null;
  carrier?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items?: { name: string; qty: number }[];
  user?: { id: string; name: string; email: string; phone?: string | null } | null;
  addressSnap?: { city?: string; uf?: string; label?: string; phone?: string | null } | null;
  freightSnap?: { label?: string; fee?: number; estimatedDays?: number } | null;
  /** Present on GET /admin/orders include — payment evidence only (no invent). */
  payments?: Array<{
    id: string;
    status: string;
    method?: string;
    provider?: string;
    externalId?: string | null;
    amount?: number | string;
  }> | null;
  /** Status timeline from GET /admin/orders (capped). */
  statusHistory?: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    note?: string | null;
    createdAt: string;
    actorId?: string | null;
  }> | null;
};

export type AdminSeller = {
  id: string;
  name: string;
  slug: string;
  status: string;
  commissionPercent?: number | string | null;
  _count?: { products: number };
  owner?: { id: string; name: string; email: string } | null;
};

export type AdminCommission = {
  id: string;
  amount: number;
  percent: number;
  status: string;
  createdAt: string;
  payoutReference?: string | null;
  payoutNote?: string | null;
  source?: 'manual_pix' | 'mp_application_fee' | string | null;
  mpPaymentId?: string | null;
  mpApplicationFee?: number | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  seller: { id: string; name: string; slug: string };
  order: { id: string; publicId: string; status: string };
  orderItem: { id: string; name: string; qty: number; unitPrice: number };
};

export type AdminCustomerListItem = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  status: string;
  createdAt: string;
  ordersCount: number;
  paidOrdersCount: number;
  paidTotal: number;
  lastPaidAt?: string | null;
  lastOrderAt?: string | null;
  city?: string | null;
  uf?: string | null;
};

export type AdminCustomerAddress = {
  id?: string | null;
  label: string;
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  uf: string;
  isDefault: boolean;
};

export type AdminCustomerDetail = AdminCustomerListItem & {
  cashbackBalance: number;
  addressesCount: number;
  addresses?: AdminCustomerAddress[];
  orders: {
    id: string;
    publicId: string;
    status: string;
    total: number;
    discount: number;
    freight: number;
    createdAt: string;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    items: { name: string; qty: number; unitPrice: number }[];
  }[];
};

export type Category = { id: string; name: string; slug: string };

export type AdminProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  price: string | number;
  compareAtPrice?: string | number | null;
  active: boolean;
  badge?: string | null;
  categoryId?: string | null;
  category?: Category | null;
  inventory?: { qtyOnHand: number; qtyReserved: number } | null;
  images?: { id: string; url: string; position?: number; alt?: string }[];
  sellerId?: string | null;
  seller?: { id: string; name: string; slug: string; status?: string } | null;
};

export type FormImage = { id?: string; url: string; position: number };

export const MAX_PRODUCT_IMAGES = 10;

export type ProductForm = {
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  stock: string;
  categoryId: string;
  sellerId: string;
  active: boolean;
  imageUrl: string;
  badge: string;
};

export const emptyForm = (): ProductForm => ({
  name: '',
  description: '',
  price: '',
  compareAtPrice: '',
  sku: '',
  stock: '0',
  categoryId: '',
  sellerId: '',
  active: true,
  imageUrl: '',
  badge: '',
});


export type AdminCoupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  minSubtotal: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  reservedCount: number;
  active: boolean;
};

export type CouponForm = {
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  minSubtotal: string;
  endsAt: string;
  maxUses: string;
  active: boolean;
};


export type ShippingSettings = {
  id: string;
  freeAbove: number;
  defaultFee: number;
  defaultDays: number;
};

export type ShippingCepRule = {
  id: string;
  cepPrefix: string;
  fee: number;
  estimatedDays: number;
  label: string | null;
  active: boolean;
  sortOrder: number;
};

export type ShippingConfig = { settings: ShippingSettings; rules: ShippingCepRule[] };

export type SalesReport = {
  from: string;
  to: string;
  timezone: string;
  summary: { orderCount: number; revenue: number; averageTicket: number };
  byStatus: Record<string, number>;
  byDay?: { date: string; orderCount: number; revenue: number }[];
  bySeller?: {
    sellerId: string | null;
    sellerName: string;
    orderCount: number;
    itemQty: number;
    revenue: number;
  }[];
  topProducts: { productId: string; name: string; qty: number; revenue: number }[];
  byPaymentMethod?: { method: string; orderCount: number; revenue: number }[];
};



export type StoreSeoSettings = {
  id: string;
  siteTitle: string;
  siteDescription: string;
  ogImageUrl: string | null;
};

export type AdminBanner = {
  id: string;
  title: string;
  alt: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
};

export type BannerForm = {
  title: string;
  alt: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
};

export const emptyBannerForm = (): BannerForm => ({
  title: '',
  alt: '',
  imageUrl: '',
  linkUrl: '',
  active: true,
});

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type AdminUserForm = {
  name: string;
  email: string;
  password: string;
};

export const emptyAdminUserForm = (): AdminUserForm => ({
  name: '',
  email: '',
  password: '',
});


export type AdminReview = {
  id: string;
  rating: number;
  body: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  user: { id: string; name: string; email: string };
  product: { id: string; name: string; slug: string };
};


export function saoPauloYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function addDaysYmd(ymd: string, delta: number) {
  const d = new Date(`${ymd}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return saoPauloYmd(d);
}


export type ShippingSettingsForm = {
  freeAbove: string;
  defaultFee: string;
  defaultDays: string;
};

export type CepRuleForm = {
  cepPrefix: string;
  fee: string;
  estimatedDays: string;
  label: string;
  active: boolean;
};

export const emptyCepRuleForm = (): CepRuleForm => ({
  cepPrefix: '',
  fee: '',
  estimatedDays: '5',
  label: '',
  active: true,
});

export const emptyCouponForm = (): CouponForm => ({
  code: '',
  type: 'percent',
  value: '',
  minSubtotal: '',
  endsAt: '',
  maxUses: '',
  active: true,
});

export const DEFAULT_LOW_STOCK = 5;

export type AdminOpsSalesWindow = {
  from: string;
  to: string;
  orderCount: number;
  revenue: number;
};

export type AdminOpsAlert = {
  code: string;
  severity: 'info' | 'warn' | 'high' | 'critical';
  message: string;
  count: number;
  queueBucket?: string;
  section?: 'reconciliations' | 'orders' | 'inventory' | 'catalog' | 'mail';
  evidence?: {
    reason?: string;
    providerStatus?: string;
    externalReference?: string | null;
    ids?: string[];
  };
  recommendedAction?: string;
};

export type AdminOpsReconciliationRow = {
  id: string;
  reason: string;
  providerStatus: string;
  externalReference: string | null;
  createdAt: string;
  status: string;
};

export type AdminPaymentReconciliationItem = AdminOpsReconciliationRow & {
  provider?: string;
  externalId?: string;
  paymentEventId?: string | null;
  publicId?: string | null;
  amount?: number | null;
  updatedAt?: string;
  resolvedAt?: string | null;
};

export type AdminOpsSnapshot = {
  time: string;
  inventory: {
    lowStockThreshold: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  catalog?: {
    placeholderProductCount: number;
    placeholderProducts?: {
      id: string;
      name: string;
      imageUrl?: string;
      reason?: 'missing' | 'placeholder';
    }[];
  };
  payments?: { pendingCount: number };
  reconciliations?: {
    openCount: number;
    recent: AdminOpsReconciliationRow[];
  };
  mail?: {
    configured: boolean;
    storeNotifyConfigured?: boolean;
    providerOffWithStoreNotify?: boolean;
    lastStoreNotifyFailure?: {
      at: string;
      publicId: string;
      orderId: string | null;
      event: string;
      reason: string;
      mode: string | null;
    } | null;
    storeNotifyFailureCount?: number;
  };
  orders?: {
    byStatus: Record<string, number>;
    buckets: Record<string, number>;
    problemsStatuses?: string[];
    stuckStatuses?: string[];
    terminalHistoryStatuses?: string[];
    stuckCount?: number;
    terminalHistoryCount?: number;
    total: number;
  };
  paidAwaitingOrg?: {
    stuckHoursThreshold: number;
    paidAwaitingCount: number;
    stuckCount: number;
    stuckPublicIds: string[];
    stuckIds?: string[];
    oldestStuckHours: number | null;
  };
  sales?: {
    today: AdminOpsSalesWindow | null;
    last30d: AdminOpsSalesWindow | null;
  };
  alerts?: AdminOpsAlert[];
};


export const ORDER_STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'Todos' },
  ...ADMIN_ORDER_QUEUE_BUCKETS.map((key) => ({
    key,
    label:
      key === 'paid'
        ? 'Pagos aguardando org.'
        : key === 'organizing'
          ? 'Organizando (Separar)'
          : key === 'packing'
            ? 'Embalagem (Separar)'
            : adminQueueBucketLabel(key),
  })),
];

export function availableStock(p: AdminProduct) {
  const onHand = p.inventory?.qtyOnHand ?? 0;
  const reserved = p.inventory?.qtyReserved ?? 0;
  return Math.max(0, onHand - reserved);
}

export function customerHint(o: AdminOrder) {
  if (o.user?.name) return o.user.name;
  if (o.user?.email) return o.user.email;
  const city = o.addressSnap?.city;
  const uf = o.addressSnap?.uf;
  if (city && uf) return `${city}/${uf}`;
  if (city) return city;
  if (o.addressSnap?.label) return o.addressSnap.label;
  return 'Cliente';
}

export function customerPhone(o: AdminOrder) {
  return o.user?.phone || o.addressSnap?.phone || null;
}

/** Default matches API PAID_STUCK_HOURS — display only; server is source of truth. */
export const PAID_STUCK_HOURS_UI = 24;

export function paidSinceMs(o: AdminOrder): number | null {
  const paidHist = (o.statusHistory || [])
    .filter((h) => h.toStatus === 'paid')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const raw = paidHist[0]?.createdAt || o.createdAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

export function hoursSincePaid(o: AdminOrder, now = Date.now()): number | null {
  const t = paidSinceMs(o);
  if (t == null) return null;
  return Math.max(0, (now - t) / (1000 * 60 * 60));
}

export function isPaidStuckOrder(o: AdminOrder, threshold = PAID_STUCK_HOURS_UI): boolean {
  if (o.status !== 'paid') return false;
  const h = hoursSincePaid(o);
  return h != null && h >= threshold;
}

/** User "Separar" maps to organizing/packing labels only — no new enum. */
export function advanceButtonLabel(status: string, next: string): string {
  const primary = separarPrimaryLabel(status, next);
  if (primary) return primary;
  return `Marcar: ${orderStatusLabel(next)}`;
}

export function formatStuckHours(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${Math.floor(hours)}h`;
}

export function orderWa(o: AdminOrder, kind: 'generic' | 'paid' | 'shipped') {
  return resolveOrderWhatsApp({
    kind,
    publicId: o.publicId,
    total: o.total,
    status: o.status,
    customerName: o.user?.name,
    customerPhone: customerPhone(o),
    storePhone: process.env.NEXT_PUBLIC_WHATSAPP,
  });
}
