'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiUpload, brl, clearSession, currentUser, isUnauthorizedError } from '@/lib/api';
import {
  nextFulfillmentStatus,
  orderStatusLabel,
  adminQueueBucketLabel,
  POST_PAYMENT_OPS_HINT,
  ADMIN_ORDER_QUEUE_BUCKETS,
  isPostPaidStatus,
} from '@/lib/order-status';
import { resolveOrderWhatsApp } from '@/lib/whatsapp';
import { isPlaceholderImageUrl } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import {
  buildAdminOrdersQueryPath,
  shouldServerOrderSearch,
} from '@/lib/admin-order-search';
import {
  advanceSuccessMessage,
  copySuccessMessage,
  copyTextToClipboard,
  emptyOrdersQueueMessage,
  paymentMethodBadge,
  separarPrimaryLabel,
  whatsAppOpsButtonLabel,
} from '@/lib/admin-ops-ui';
import {
  type AdminSectionId,
  buildAdminSectionHref,
  sectionFromSearch,
} from '@/lib/admin-sections';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminAttentionStrip } from '@/components/admin/AdminAttentionStrip';
import {
  AdminOrderStatusChip,
  AdminProductActiveChip,
  AdminProductStockChip,
  AdminStatusChip,
} from '@/components/admin/AdminStatusChip';
import {
  adminUserStatusLabel,
  adminUserStatusTone,
  bannerActiveLabel,
  commissionStatusLabel,
  commissionStatusTone,
  couponIsExhausted,
  couponIsExpired,
  couponListStats,
  customerAccountLabel,
  customerAccountTone,
  paidQueueBannerClass,
  paidQueueBannerTone,
  productPhotoBadgeKind,
  productPhotoBadgeLabel,
  reviewStars,
  reviewStatusLabel,
  reviewStatusTone,
  salesPresetActive,
  sellerStatusLabel,
  sellerStatusTone,
  shippingZoneActiveLabel,
  shouldStickyOrderActions,
} from '@/lib/admin-pro-ui';
import {
  type BulkAdvanceResult,
  type CatalogPhotoFilter,
  bulkConfirmMessage,
  bulkProgressLabel,
  catalogPhotoQueueCount,
  emptyPhotoQueueMessage,
  filterCatalogProducts,
  formatBulkAdvanceFeedback,
  isBulkAdvanceEligible,
  isBulkSepararEligible,
  listPhotoUploadSuccessMessage,
  nextOneClickFulfillmentStatus,
  orderedIdsWithNewCover,
  partitionBulkAdvance,
  partitionBulkSeparar,
  photoQueueAlignmentNote,
  productCoverUrl,
  productNeedsStorePhoto,
  pruneSelectedIds,
  selectVisibleEligibleIds,
  shouldPromoteUploadedImageToCover,
  toggleIdInList,
  validateProductPhotoFile,
} from '@/lib/admin-daily-ops';

type AdminOrder = {
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

type AdminSeller = {
  id: string;
  name: string;
  slug: string;
  status: string;
  commissionPercent?: number | string | null;
  _count?: { products: number };
  owner?: { id: string; name: string; email: string } | null;
};

type AdminCommission = {
  id: string;
  amount: number;
  percent: number;
  status: string;
  createdAt: string;
  payoutReference?: string | null;
  payoutNote?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  seller: { id: string; name: string; slug: string };
  order: { id: string; publicId: string; status: string };
  orderItem: { id: string; name: string; qty: number; unitPrice: number };
};

type AdminCustomerListItem = {
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
};

type AdminCustomerDetail = AdminCustomerListItem & {
  cashbackBalance: number;
  addressesCount: number;
  orders: {
    id: string;
    publicId: string;
    status: string;
    total: number;
    discount: number;
    freight: number;
    createdAt: string;
    items: { name: string; qty: number; unitPrice: number }[];
  }[];
};

type Category = { id: string; name: string; slug: string };

type AdminProduct = {
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

type FormImage = { id?: string; url: string; position: number };

const MAX_PRODUCT_IMAGES = 10;

type ProductForm = {
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

const emptyForm = (): ProductForm => ({
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


type AdminCoupon = {
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

type CouponForm = {
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  minSubtotal: string;
  endsAt: string;
  maxUses: string;
  active: boolean;
};


type ShippingSettings = {
  id: string;
  freeAbove: number;
  defaultFee: number;
  defaultDays: number;
};

type ShippingCepRule = {
  id: string;
  cepPrefix: string;
  fee: number;
  estimatedDays: number;
  label: string | null;
  active: boolean;
  sortOrder: number;
};

type ShippingConfig = { settings: ShippingSettings; rules: ShippingCepRule[] };

type SalesReport = {
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
};



type StoreSeoSettings = {
  id: string;
  siteTitle: string;
  siteDescription: string;
  ogImageUrl: string | null;
};

type AdminBanner = {
  id: string;
  title: string;
  alt: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
};

type BannerForm = {
  title: string;
  alt: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
};

const emptyBannerForm = (): BannerForm => ({
  title: '',
  alt: '',
  imageUrl: '',
  linkUrl: '',
  active: true,
});

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

type AdminUserForm = {
  name: string;
  email: string;
  password: string;
};

const emptyAdminUserForm = (): AdminUserForm => ({
  name: '',
  email: '',
  password: '',
});


type AdminReview = {
  id: string;
  rating: number;
  body: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  user: { id: string; name: string; email: string };
  product: { id: string; name: string; slug: string };
};


function saoPauloYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addDaysYmd(ymd: string, delta: number) {
  const d = new Date(`${ymd}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return saoPauloYmd(d);
}


type ShippingSettingsForm = {
  freeAbove: string;
  defaultFee: string;
  defaultDays: string;
};

type CepRuleForm = {
  cepPrefix: string;
  fee: string;
  estimatedDays: string;
  label: string;
  active: boolean;
};

const emptyCepRuleForm = (): CepRuleForm => ({
  cepPrefix: '',
  fee: '',
  estimatedDays: '5',
  label: '',
  active: true,
});

const emptyCouponForm = (): CouponForm => ({
  code: '',
  type: 'percent',
  value: '',
  minSubtotal: '',
  endsAt: '',
  maxUses: '',
  active: true,
});

const DEFAULT_LOW_STOCK = 5;

type AdminOpsSalesWindow = {
  from: string;
  to: string;
  orderCount: number;
  revenue: number;
};

type AdminOpsAlert = {
  code: string;
  severity: 'info' | 'warn' | 'high' | 'critical';
  message: string;
  count: number;
  queueBucket?: string;
  section?: 'reconciliations' | 'orders' | 'inventory' | 'catalog';
  evidence?: {
    reason?: string;
    providerStatus?: string;
    externalReference?: string | null;
    ids?: string[];
  };
  recommendedAction?: string;
};

type AdminOpsReconciliationRow = {
  id: string;
  reason: string;
  providerStatus: string;
  externalReference: string | null;
  createdAt: string;
  status: string;
};

type AdminPaymentReconciliationItem = AdminOpsReconciliationRow & {
  provider?: string;
  externalId?: string;
  paymentEventId?: string | null;
  publicId?: string | null;
  amount?: number | null;
  updatedAt?: string;
  resolvedAt?: string | null;
};

type AdminOpsSnapshot = {
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
  mail?: { configured: boolean };
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


const ORDER_STATUS_TABS: { key: string; label: string }[] = [
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

function availableStock(p: AdminProduct) {
  const onHand = p.inventory?.qtyOnHand ?? 0;
  const reserved = p.inventory?.qtyReserved ?? 0;
  return Math.max(0, onHand - reserved);
}

function customerHint(o: AdminOrder) {
  if (o.user?.name) return o.user.name;
  if (o.user?.email) return o.user.email;
  const city = o.addressSnap?.city;
  const uf = o.addressSnap?.uf;
  if (city && uf) return `${city}/${uf}`;
  if (city) return city;
  if (o.addressSnap?.label) return o.addressSnap.label;
  return 'Cliente';
}

function customerPhone(o: AdminOrder) {
  return o.user?.phone || o.addressSnap?.phone || null;
}

/** Default matches API PAID_STUCK_HOURS — display only; server is source of truth. */
const PAID_STUCK_HOURS_UI = 24;

function paidSinceMs(o: AdminOrder): number | null {
  const paidHist = (o.statusHistory || [])
    .filter((h) => h.toStatus === 'paid')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const raw = paidHist[0]?.createdAt || o.createdAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

function hoursSincePaid(o: AdminOrder, now = Date.now()): number | null {
  const t = paidSinceMs(o);
  if (t == null) return null;
  return Math.max(0, (now - t) / (1000 * 60 * 60));
}

function isPaidStuckOrder(o: AdminOrder, threshold = PAID_STUCK_HOURS_UI): boolean {
  if (o.status !== 'paid') return false;
  const h = hoursSincePaid(o);
  return h != null && h >= threshold;
}

/** User "Separar" maps to organizing/packing labels only — no new enum. */
function advanceButtonLabel(status: string, next: string): string {
  const primary = separarPrimaryLabel(status, next);
  if (primary) return primary;
  return `Marcar: ${orderStatusLabel(next)}`;
}

function formatStuckHours(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${Math.floor(hours)}h`;
}

function orderWa(o: AdminOrder, kind: 'generic' | 'paid' | 'shipped') {
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

export default function AdminPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formImages, setFormImages] = useState<FormImage[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(DEFAULT_LOW_STOCK);
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [couponForm, setCouponForm] = useState<CouponForm>(emptyCouponForm);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings | null>(null);
  const [shippingRules, setShippingRules] = useState<ShippingCepRule[]>([]);
  const [shippingForm, setShippingForm] = useState<ShippingSettingsForm>({
    freeAbove: '299',
    defaultFee: '19,90',
    defaultDays: '5',
  });
  const [cepRuleForm, setCepRuleForm] = useState<CepRuleForm>(emptyCepRuleForm());
  const [savingShipping, setSavingShipping] = useState(false);
  const [savingCepRule, setSavingCepRule] = useState(false);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [salesFrom, setSalesFrom] = useState(() => addDaysYmd(saoPauloYmd(), -29));
  const [salesTo, setSalesTo] = useState(() => saoPauloYmd());
  const [salesBusy, setSalesBusy] = useState(false);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [seoForm, setSeoForm] = useState({ siteTitle: 'Lojas Schimitz', siteDescription: '', ogImageUrl: '' });
  const [savingSeo, setSavingSeo] = useState(false);
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBannerForm());
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerBusyId, setBannerBusyId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminForm, setAdminForm] = useState<AdminUserForm>(emptyAdminUserForm());
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [sellers, setSellers] = useState<AdminSeller[]>([]);
  const [commissions, setCommissions] = useState<AdminCommission[]>([]);
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<'pending' | 'approved' | 'paid' | 'all'>('pending');
  const [commissionSellerFilter, setCommissionSellerFilter] = useState('');
  const [commissionBusyId, setCommissionBusyId] = useState<string | null>(null);
  const [payoutDraft, setPayoutDraft] = useState<Record<string, string>>({});
  const [ownerDraft, setOwnerDraft] = useState<Record<string, string>>({});
  const [ownerBusyId, setOwnerBusyId] = useState<string | null>(null);
  const [sellerForm, setSellerForm] = useState({ name: '', slug: '', status: 'pending' as 'pending' | 'active' | 'suspended' });
  const [savingSeller, setSavingSeller] = useState(false);
  const [sellerBusyId, setSellerBusyId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customerQ, setCustomerQ] = useState('');
  const [customerBusy, setCustomerBusy] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<AdminCustomerDetail | null>(null);
  const [customerDetailBusy, setCustomerDetailBusy] = useState(false);
  const [ops, setOps] = useState<AdminOpsSnapshot | null>(null);
  const [opsBusy, setOpsBusy] = useState(false);
  const [reconciliations, setReconciliations] = useState<AdminPaymentReconciliationItem[]>([]);
  const [reconBusy, setReconBusy] = useState(false);
  const [orderJumpQ, setOrderJumpQ] = useState('');
  const [orderSearchBusy, setOrderSearchBusy] = useState(false);
  /** True while last orders fetch used server ?q= (beyond take:100 window). */
  const [orderServerSearchActive, setOrderServerSearchActive] = useState(false);
  const orderServerSearchRef = useRef(false);
  /** ROI filters on loaded list only — no new public search. */
  const [orderRoiFilter, setOrderRoiFilter] = useState<'all' | 'stuck_paid' | 'no_shipping'>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');
  const [catalogPhotoFilter, setCatalogPhotoFilter] = useState<CatalogPhotoFilter>('all');
  const [listPhotoBusyId, setListPhotoBusyId] = useState<string | null>(null);
  const listPhotoInputRef = useRef<HTMLInputElement>(null);
  const listPhotoProductIdRef = useRef<string | null>(null);
  const [adminSection, setAdminSection] = useState<AdminSectionId>(() => {
    if (typeof window === 'undefined') return 'ops';
    return sectionFromSearch(window.location.search);
  });

  const goAdminSection = useCallback((next: AdminSectionId) => {
    setAdminSection(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', buildAdminSectionHref(next));
    }
  }, []);

  const load = useCallback(() => {
    const u = currentUser();
    if (!u || u.role !== 'admin') {
      setErr('Acesso restrito a admin. Entre com a conta administrativa.');
      return Promise.resolve();
    }
    const ordersPath = buildAdminOrdersQueryPath({
      status: orderStatusFilter || undefined,
      // Full reload keeps status bucket; server q handled by dedicated search effect.
    });
    setOrderServerSearchActive(false);
    orderServerSearchRef.current = false;
    return Promise.all([
      api<AdminProduct[]>('/admin/products'),
      api<AdminOrder[]>(ordersPath),
      api<Category[]>('/admin/categories'),
      api<AdminCoupon[]>('/admin/coupons'),
      api<ShippingConfig>('/admin/shipping'),
      api<AdminReview[]>('/admin/reviews'),
      api<StoreSeoSettings>('/admin/store/settings'),
      api<AdminBanner[]>('/admin/banners'),
      api<AdminUser[]>('/admin/admins'),
      api<AdminSeller[]>('/admin/sellers'),
      api<AdminCommission[]>(`/admin/commissions?status=${encodeURIComponent(commissionStatusFilter)}${commissionSellerFilter ? `&sellerId=${encodeURIComponent(commissionSellerFilter)}` : ''}`).catch(() => [] as AdminCommission[]),
    ])
      .then(([p, o, c, couponsList, shipping, reviewsList, seo, bannersList, adminsList, sellersList, commissionsList]) => {
        setProducts(p);
        setOrders(o);
        setCategories(c);
        setCoupons(couponsList);
        setShippingSettings(shipping.settings);
        setShippingRules(shipping.rules);
        setShippingForm({
          freeAbove: String(shipping.settings.freeAbove).replace('.', ','),
          defaultFee: String(shipping.settings.defaultFee).replace('.', ','),
          defaultDays: String(shipping.settings.defaultDays),
        });
        setReviews(reviewsList);
        setSeoForm({
          siteTitle: seo.siteTitle || 'Lojas Schimitz',
          siteDescription: seo.siteDescription || '',
          ogImageUrl: seo.ogImageUrl || '',
        });
        setBanners(bannersList);
        setAdmins(adminsList);
        setSellers(sellersList);
        setCommissions(commissionsList || []);
        setErr('');
      })
      .catch((e) => {
        if (isUnauthorizedError(e)) {
          clearSession();
          window.location.href = '/entrar?next=/admin';
          return;
        }
        setErr(e.message);
      });
  }, [orderStatusFilter, commissionStatusFilter, commissionSellerFilter]);

  const loadCustomers = useCallback(async (q = customerQ) => {
    const u = currentUser();
    if (!u || u.role !== 'admin') return;
    setCustomerBusy(true);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      qs.set('take', '50');
      const data = await api<{ items: AdminCustomerListItem[]; total: number }>(
        `/admin/customers?${qs.toString()}`,
      );
      setCustomers(data.items || []);
      setCustomersTotal(data.total || 0);
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        clearSession();
        window.location.href = '/entrar?next=/admin';
        return;
      }
      setErr(e.message || 'Falha ao carregar clientes');
    } finally {
      setCustomerBusy(false);
    }
  }, [customerQ]);

  const loadOps = useCallback(async () => {
    const u = currentUser();
    if (!u || u.role !== 'admin') return;
    setOpsBusy(true);
    try {
      const data = await api<AdminOpsSnapshot>('/admin/ops');
      setOps(data);
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        clearSession();
        window.location.href = '/entrar?next=/admin';
        return;
      }
      // Non-blocking: existing sections still work if ops fails
      console.warn('admin ops', e?.message || e);
    } finally {
      setOpsBusy(false);
    }
  }, []);

  /** Click ops bucket/alert → filter orders queue and scroll into view. */
  const selectOpsBucket = useCallback((bucket: string) => {
    setOrderStatusFilter(bucket);
    setAdminSection('pedidos');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', buildAdminSectionHref('pedidos'));
    }
    requestAnimationFrame(() => {
      const el = document.getElementById('admin-orders-queue');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const loadReconciliations = useCallback(async () => {
    const u = currentUser();
    if (!u || u.role !== 'admin') return;
    setReconBusy(true);
    try {
      const data = await api<{ items: AdminPaymentReconciliationItem[] }>(
        '/admin/payments/reconciliations?limit=50',
      );
      setReconciliations(data?.items || []);
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        clearSession();
        window.location.href = '/entrar?next=/admin';
        return;
      }
      console.warn('admin reconciliations', e?.message || e);
    } finally {
      setReconBusy(false);
    }
  }, []);

  const openCatalogPhotoQueue = useCallback(() => {
    setCatalogPhotoFilter('needs_photo');
    setAdminSection('catalogo');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', buildAdminSectionHref('catalogo'));
    }
    requestAnimationFrame(() => {
      const el = document.getElementById('admin-photo-queue');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  /** Deep-link alert → section or order queue (review only). */
  const selectOpsAlert = useCallback(
    (a: AdminOpsAlert) => {
      if (a.section === 'reconciliations') {
        setAdminSection('ops');
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', buildAdminSectionHref('ops'));
        }
        requestAnimationFrame(() => {
          const el = document.getElementById('admin-reconciliations');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        void loadReconciliations();
        return;
      }
      if (a.section === 'catalog' || a.code === 'placeholder_photos') {
        openCatalogPhotoQueue();
        return;
      }
      if (a.queueBucket) selectOpsBucket(a.queueBucket);
    },
    [loadReconciliations, selectOpsBucket, openCatalogPhotoQueue],
  );


  async function downloadProductsNeedingPhotosCsv() {
    setErr('');
    setMsg('');
    try {
      const data = await api<{ filename: string; csv: string }>(
        '/admin/ops/products-needing-photos',
      );
      const blob = new Blob([data.csv || ''], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'products-needing-photos.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(`CSV baixado: ${a.download} (só produtos que precisam de foto real — sem imagens inventadas).`);
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        clearSession();
        window.location.href = '/entrar?next=/admin';
        return;
      }
      setErr(e.message || 'Falha ao baixar CSV de fotos');
    }
  }

  async function openCustomer(id: string) {
    setCustomerDetailBusy(true);
    setErr('');
    try {
      const data = await api<AdminCustomerDetail>(`/admin/customers/${id}`);
      setCustomerDetail(data);
    } catch (e: any) {
      setErr(e.message || 'Falha ao abrir cliente');
    } finally {
      setCustomerDetailBusy(false);
    }
  }


  const loadSalesReport = useCallback(async (from = salesFrom, to = salesTo) => {
    const u = currentUser();
    if (!u || u.role !== 'admin') return;
    setSalesBusy(true);
    try {
      const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const data = await api<SalesReport>(`/admin/reports/sales?${q}`);
      setSalesReport(data);
      setSalesFrom(data.from);
      setSalesTo(data.to);
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        clearSession();
        window.location.href = '/entrar?next=/admin';
        return;
      }
      setErr(e.message || 'Falha ao carregar relatório de vendas');
    } finally {
      setSalesBusy(false);
    }
  }, [salesFrom, salesTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void loadSalesReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  /** Server order search when q ≥ 3 or SCH-…; clears back to status window. */
  useEffect(() => {
    const u = currentUser();
    if (!u || u.role !== 'admin') return;
    const q = orderJumpQ.trim();
    if (!shouldServerOrderSearch(q)) {
      if (orderServerSearchRef.current) {
        orderServerSearchRef.current = false;
        setOrderServerSearchActive(false);
        const path = buildAdminOrdersQueryPath({
          status: orderStatusFilter || undefined,
        });
        setOrderSearchBusy(true);
        void api<AdminOrder[]>(path)
          .then((o) => setOrders(o))
          .catch((e: any) => {
            if (isUnauthorizedError(e)) {
              clearSession();
              window.location.href = '/entrar?next=/admin';
              return;
            }
            console.warn('admin orders reload', e?.message || e);
          })
          .finally(() => setOrderSearchBusy(false));
      }
      return;
    }
    const handle = window.setTimeout(() => {
      const path = buildAdminOrdersQueryPath({
        status: orderStatusFilter || undefined,
        q,
      });
      setOrderSearchBusy(true);
      void api<AdminOrder[]>(path)
        .then((o) => {
          orderServerSearchRef.current = true;
          setOrders(o);
          setOrderServerSearchActive(true);
        })
        .catch((e: any) => {
          if (isUnauthorizedError(e)) {
            clearSession();
            window.location.href = '/entrar?next=/admin';
            return;
          }
          setErr(e?.message || 'Falha na busca de pedidos');
        })
        .finally(() => setOrderSearchBusy(false));
    }, 320);
    return () => window.clearTimeout(handle);
  }, [orderJumpQ, orderStatusFilter]);




  useEffect(() => {
    void loadOps();
    void loadReconciliations();
  }, [loadOps, loadReconciliations]);

  const editingLabel = useMemo(
    () => (editingId ? 'Editar produto' : 'Cadastrar produto'),
    [editingId],
  );

  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => (p.inventory?.qtyOnHand ?? 0) <= lowStockThreshold)
      .sort((a, b) => (a.inventory?.qtyOnHand ?? 0) - (b.inventory?.qtyOnHand ?? 0));
  }, [products, lowStockThreshold]);

  /** ROI filters always client-side; text: server when active, else loaded-list jump. */
  const filteredOrders = useMemo(() => {
    const q = orderJumpQ.trim().toLowerCase();
    const serverQ = orderServerSearchActive && shouldServerOrderSearch(orderJumpQ);
    return orders.filter((o) => {
      if (orderRoiFilter === 'stuck_paid') {
        if (!isPaidStuckOrder(o)) return false;
      } else if (orderRoiFilter === 'no_shipping') {
        const hasShip =
          Boolean(o.trackingCode?.trim()) ||
          Boolean(o.carrier?.trim()) ||
          Boolean(o.freightSnap?.label?.trim());
        // Paid/fulfillment without shipping evidence — conversion ops focus.
        const inOps =
          o.status === 'paid' ||
          o.status === 'organizing' ||
          o.status === 'packing' ||
          o.status === 'ready_for_pickup';
        if (!inOps || hasShip) return false;
      }
      if (!q || serverQ) return true;
      return (
        o.publicId?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q) ||
        o.user?.email?.toLowerCase().includes(q) ||
        o.user?.name?.toLowerCase().includes(q) ||
        (o.trackingCode || '').toLowerCase().includes(q)
      );
    });
  }, [orders, orderJumpQ, orderRoiFilter, orderServerSearchActive]);

  const selectedVisibleOrders = useMemo(
    () => filteredOrders.filter((o) => selectedOrderIds.includes(o.id)),
    [filteredOrders, selectedOrderIds],
  );

  const bulkSepararEligibleCount = useMemo(
    () => selectedVisibleOrders.filter((o) => isBulkSepararEligible(o.status)).length,
    [selectedVisibleOrders],
  );

  const bulkAdvanceEligibleCount = useMemo(
    () => selectedVisibleOrders.filter((o) => isBulkAdvanceEligible(o.status)).length,
    [selectedVisibleOrders],
  );

  const photoQueueCount = useMemo(() => catalogPhotoQueueCount(products), [products]);

  const visibleCatalogProducts = useMemo(
    () => filterCatalogProducts(products, catalogPhotoFilter),
    [products, catalogPhotoFilter],
  );

  useEffect(() => {
    setSelectedOrderIds((prev) => {
      const next = pruneSelectedIds(prev, filteredOrders.map((o) => o.id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [filteredOrders]);

  const attentionAlerts = useMemo(() => {
    const list = ops?.alerts || [];
    return list.filter((a) => a.severity === 'critical' || a.severity === 'high' || a.severity === 'warn');
  }, [ops?.alerts]);

  function mapProductImages(images?: AdminProduct['images']): FormImage[] {
    const list = (images || [])
      .map((img, i) => ({
        id: img.id,
        url: rewritePublicUploadUrl(img.url) || img.url || '',
        position: img.position ?? i,
      }))
      .filter((img) => Boolean(img.url))
      .sort((a, b) => a.position - b.position);
    return list.map((img, i) => ({ ...img, position: i }));
  }

  function syncCoverUrl(images: FormImage[]) {
    setForm((f) => ({ ...f, imageUrl: images[0]?.url || '' }));
  }

  function startEdit(p: AdminProduct) {
    setEditingId(p.id);
    setMsg('');
    setErr('');
    const imgs = mapProductImages(p.images);
    setFormImages(imgs);
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price ?? ''),
      compareAtPrice: p.compareAtPrice != null && p.compareAtPrice !== '' ? String(p.compareAtPrice) : '',
      sku: p.sku,
      stock: String(p.inventory?.qtyOnHand ?? 0),
      categoryId: p.categoryId || p.category?.id || '',
      sellerId: p.sellerId || p.seller?.id || '',
      active: !!p.active,
      imageUrl: imgs[0]?.url || '',
      badge: p.badge || '',
    });
    setAdminSection('catalogo');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', buildAdminSectionHref('catalogo'));
    }
    window.requestAnimationFrame(() => {
      const el = document.getElementById('admin-product-form');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function startEditById(productId: string) {
    const found = products.find((p) => p.id === productId);
    if (!found) {
      setErr('Produto não encontrado na lista carregada. Atualize a página e tente de novo.');
      return;
    }
    startEdit(found);
    setMsg(`Editando “${found.name}” — envie fotos reais abaixo (até 10).`);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setFormImages([]);
    setMsg('');
  }

  async function persistNewImages(productId: string, urls: string[]) {
    let last: AdminProduct | null = null;
    for (const url of urls) {
      last = await api<AdminProduct>(`/admin/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    }
    return last;
  }

  async function uploadOnePhoto(file: File, currentCount: number): Promise<boolean> {
    const invalid = validateProductPhotoFile(file, currentCount, MAX_PRODUCT_IMAGES);
    if (invalid) {
      setErr(invalid);
      return false;
    }
    const fd = new FormData();
    fd.append('file', file);
    const data = await apiUpload<{ url: string }>('/admin/uploads', fd);
    const url = data.url;
    if (editingId) {
      const updated = await api<AdminProduct>(`/admin/products/${editingId}/images`, {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      const imgs = mapProductImages(updated.images);
      setFormImages(imgs);
      syncCoverUrl(imgs);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      setMsg('Foto adicionada ao produto.');
    } else {
      setFormImages((prev) => {
        if (prev.length >= MAX_PRODUCT_IMAGES) return prev;
        const next = [...prev, { url, position: prev.length }];
        setForm((f) => ({ ...f, imageUrl: next[0]?.url || '' }));
        return next;
      });
      setMsg('Foto enviada. Salve o produto para publicar.');
    }
    return true;
  }

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    setUploading(true);
    setErr('');
    setMsg('');
    try {
      await uploadOnePhoto(file, formImages.length);
    } catch (e: any) {
      setErr(e.message || 'Falha ao enviar foto');
    } finally {
      setUploading(false);
    }
  }

  async function uploadPhotos(files: FileList | File[] | null) {
    if (!files || !files.length) return;
    const list = Array.from(files);
    setUploading(true);
    setErr('');
    setMsg('');
    let count = formImages.length;
    try {
      for (const file of list) {
        if (count >= MAX_PRODUCT_IMAGES) {
          setErr(`Limite de ${MAX_PRODUCT_IMAGES} fotos por produto.`);
          break;
        }
        const okUpload = await uploadOnePhoto(file, count);
        if (!okUpload) break;
        count += 1;
      }
    } catch (e: any) {
      setErr(e.message || 'Falha ao enviar foto');
    } finally {
      setUploading(false);
    }
  }

  async function removeFormImage(index: number) {
    const target = formImages[index];
    if (!target) return;
    setErr('');
    setMsg('');
    try {
      if (editingId && target.id) {
        const updated = await api<AdminProduct>(
          `/admin/products/${editingId}/images/${target.id}`,
          { method: 'DELETE' },
        );
        const imgs = mapProductImages(updated.images);
        setFormImages(imgs);
        syncCoverUrl(imgs);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        setMsg('Foto removida.');
      } else {
        const next = formImages
          .filter((_, i) => i !== index)
          .map((img, i) => ({ ...img, position: i }));
        setFormImages(next);
        syncCoverUrl(next);
      }
    } catch (e: any) {
      setErr(e.message || 'Falha ao remover foto');
    }
  }

  async function moveFormImage(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= formImages.length) return;
    const next = [...formImages];
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    const ordered = next.map((img, i) => ({ ...img, position: i }));
    setErr('');
    try {
      if (editingId && ordered.every((img) => img.id)) {
        const updated = await api<AdminProduct>(`/admin/products/${editingId}/images/reorder`, {
          method: 'PATCH',
          body: JSON.stringify({ orderedIds: ordered.map((img) => img.id as string) }),
        });
        const imgs = mapProductImages(updated.images);
        setFormImages(imgs);
        syncCoverUrl(imgs);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        setMsg(dir < 0 && index === 1 ? 'Capa atualizada.' : 'Ordem das fotos atualizada.');
      } else {
        setFormImages(ordered);
        syncCoverUrl(ordered);
      }
    } catch (e: any) {
      setErr(e.message || 'Falha ao reordenar fotos');
    }
  }

  async function setCoverImage(index: number) {
    if (index <= 0) return;
    const next = [...formImages];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    const ordered = next.map((img, i) => ({ ...img, position: i }));
    setErr('');
    try {
      if (editingId && ordered.every((img) => img.id)) {
        const updated = await api<AdminProduct>(`/admin/products/${editingId}/images/reorder`, {
          method: 'PATCH',
          body: JSON.stringify({ orderedIds: ordered.map((img) => img.id as string) }),
        });
        const imgs = mapProductImages(updated.images);
        setFormImages(imgs);
        syncCoverUrl(imgs);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        setMsg('Capa definida (posição 0).');
      } else {
        setFormImages(ordered);
        syncCoverUrl(ordered);
      }
    } catch (e: any) {
      setErr(e.message || 'Falha ao definir capa');
    }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setMsg('');
    const price = Number(String(form.price).replace(',', '.'));
    const stock = Number.parseInt(form.stock, 10);
    const compareRaw = form.compareAtPrice.trim();
    const compareAtPrice = compareRaw === '' ? null : Number(compareRaw.replace(',', '.'));
    if (!form.name.trim() || Number.isNaN(price) || price < 0) {
      setErr('Informe nome e um preço válido.');
      setSaving(false);
      return;
    }
    if (Number.isNaN(stock) || stock < 0) {
      setErr('Estoque deve ser um número inteiro ≥ 0.');
      setSaving(false);
      return;
    }
    if (compareAtPrice != null && (Number.isNaN(compareAtPrice) || compareAtPrice < 0)) {
      setErr('Preço “de” (riscado) inválido.');
      setSaving(false);
      return;
    }

    const coverUrl = (formImages[0]?.url || form.imageUrl).trim() || null;
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      stock,
      active: form.active,
      categoryId: form.categoryId || null,
      sellerId: form.sellerId || null,
      badge: form.badge.trim() || null,
      compareAtPrice,
    };
    if (form.sku.trim()) body.sku = form.sku.trim();

    try {
      if (editingId) {
        // Fotos já são gerenciadas pelos endpoints /images; não sobrescrever capa via imageUrl.
        await api(`/admin/products/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setMsg('Produto atualizado.');
      } else {
        body.imageUrl = coverUrl;
        const created = await api<AdminProduct>('/admin/products', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        const extraUrls = formImages.slice(1).map((img) => img.url).filter(Boolean);
        if (created?.id && extraUrls.length) {
          await persistNewImages(created.id, extraUrls);
        }
        setMsg('Produto cadastrado e já disponível na loja (se ativo).');
      }
      resetForm();
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao salvar produto');
    } finally {
      setSaving(false);
    }
  }


  async function saveCoupon(e: React.FormEvent) {
    e.preventDefault();
    setSavingCoupon(true);
    setErr('');
    setMsg('');
    const value = Number(String(couponForm.value).replace(',', '.'));
    const minRaw = couponForm.minSubtotal.trim();
    const minSubtotal = minRaw === '' ? null : Number(minRaw.replace(',', '.'));
    const maxRaw = couponForm.maxUses.trim();
    const maxUses = maxRaw === '' ? null : Number.parseInt(maxRaw, 10);
    if (!couponForm.code.trim()) {
      setErr('Informe o código do cupom.');
      setSavingCoupon(false);
      return;
    }
    if (Number.isNaN(value) || value <= 0) {
      setErr('Informe um valor de desconto válido.');
      setSavingCoupon(false);
      return;
    }
    if (minSubtotal != null && (Number.isNaN(minSubtotal) || minSubtotal < 0)) {
      setErr('Subtotal mínimo inválido.');
      setSavingCoupon(false);
      return;
    }
    if (maxUses != null && (Number.isNaN(maxUses) || maxUses < 1)) {
      setErr('Limite de usos inválido.');
      setSavingCoupon(false);
      return;
    }
    try {
      await api('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponForm.code.trim().toUpperCase(),
          type: couponForm.type,
          value,
          minSubtotal,
          maxUses,
          endsAt: couponForm.endsAt.trim() ? `${couponForm.endsAt.trim()}T23:59:59` : null,
          active: couponForm.active,
        }),
      });
      setMsg('Cupom criado.');
      setCouponForm(emptyCouponForm());
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao criar cupom');
    } finally {
      setSavingCoupon(false);
    }
  }

  async function toggleCoupon(c: AdminCoupon) {
    setErr('');
    try {
      await api(`/admin/coupons/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !c.active }),
      });
      setMsg(c.active ? 'Cupom desativado.' : 'Cupom ativado.');
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao atualizar cupom');
    }
  }

  async function saveShippingSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingShipping(true);
    setErr('');
    setMsg('');
    const freeAbove = Number(String(shippingForm.freeAbove).replace(',', '.'));
    const defaultFee = Number(String(shippingForm.defaultFee).replace(',', '.'));
    const defaultDays = Number.parseInt(shippingForm.defaultDays, 10);
    if (Number.isNaN(freeAbove) || freeAbove < 0) {
      setErr('Informe um valor válido para frete grátis a partir de.');
      setSavingShipping(false);
      return;
    }
    if (Number.isNaN(defaultFee) || defaultFee < 0) {
      setErr('Informe uma taxa padrão válida.');
      setSavingShipping(false);
      return;
    }
    if (Number.isNaN(defaultDays) || defaultDays < 1) {
      setErr('Prazo padrão deve ser pelo menos 1 dia.');
      setSavingShipping(false);
      return;
    }
    try {
      await api('/admin/shipping/settings', {
        method: 'PATCH',
        body: JSON.stringify({ freeAbove, defaultFee, defaultDays }),
      });
      setMsg('Configuração de frete salva.');
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao salvar frete');
    } finally {
      setSavingShipping(false);
    }
  }

  async function saveCepRule(e: React.FormEvent) {
    e.preventDefault();
    setSavingCepRule(true);
    setErr('');
    setMsg('');
    const fee = Number(String(cepRuleForm.fee).replace(',', '.'));
    const estimatedDays = Number.parseInt(cepRuleForm.estimatedDays, 10);
    const cepPrefix = cepRuleForm.cepPrefix.replace(/\D/g, '');
    if (!cepPrefix) {
      setErr('Informe o prefixo do CEP (somente números).');
      setSavingCepRule(false);
      return;
    }
    if (Number.isNaN(fee) || fee < 0) {
      setErr('Taxa da zona inválida.');
      setSavingCepRule(false);
      return;
    }
    if (Number.isNaN(estimatedDays) || estimatedDays < 1) {
      setErr('Prazo estimado inválido.');
      setSavingCepRule(false);
      return;
    }
    try {
      await api('/admin/shipping/rules', {
        method: 'POST',
        body: JSON.stringify({
          cepPrefix,
          fee,
          estimatedDays,
          label: cepRuleForm.label.trim() || null,
          active: cepRuleForm.active,
        }),
      });
      setMsg('Zona de CEP criada.');
      setCepRuleForm(emptyCepRuleForm());
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao criar zona de CEP');
    } finally {
      setSavingCepRule(false);
    }
  }

  async function toggleCepRule(r: ShippingCepRule) {
    setErr('');
    try {
      await api(`/admin/shipping/rules/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !r.active }),
      });
      setMsg(r.active ? 'Zona desativada.' : 'Zona ativada.');
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao atualizar zona');
    }
  }

  async function removeCepRule(r: ShippingCepRule) {
    if (!window.confirm(`Remover a zona de CEP ${r.cepPrefix}?`)) return;
    setErr('');
    try {
      await api(`/admin/shipping/rules/${r.id}`, { method: 'DELETE' });
      setMsg('Zona removida.');
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao remover zona');
    }
  }


  async function setReviewStatus(review: AdminReview, status: 'published' | 'hidden') {
    setReviewBusyId(review.id);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/reviews/${review.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMsg(status === 'hidden' ? 'Avaliação ocultada.' : 'Avaliação publicada.');
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao moderar avaliação');
    } finally {
      setReviewBusyId(null);
    }
  }

  async function deleteReview(review: AdminReview) {
    if (!confirm(`Excluir avaliação de ${review.user?.name || "usuário"} em "${review.product?.name || "produto"}"?`)) return;
    setReviewBusyId(review.id);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/reviews/${review.id}`, { method: 'DELETE' });
      setMsg('Avaliação excluída.');
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao excluir avaliação');
    } finally {
      setReviewBusyId(null);
    }
  }

  async function advance(order: AdminOrder) {
    const next = nextFulfillmentStatus(order.status);
    if (!next) return;
    const body: Record<string, unknown> = { status: next };
    if (next === 'in_transit') {
      const code = window.prompt(
        'Código de rastreio (opcional — aparece para o cliente):',
        order.trackingCode || '',
      );
      if (code === null) return; // cancelou
      const trimmed = code.trim();
      if (trimmed) body.trackingCode = trimmed;
      body.carrier = order.carrier || 'propria';
    }
    setBusyId(order.id);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setMsg(advanceSuccessMessage(order.publicId, orderStatusLabel(next)));
      await load();
      void loadOps();
    } catch (e: any) {
      setErr(e.message || 'Falha ao atualizar status');
    } finally {
      setBusyId(null);
    }
  }

  async function runBulkFulfillment(mode: 'separar' | 'advance') {
    const selected = filteredOrders.filter((o) => selectedOrderIds.includes(o.id));
    const part = mode === 'separar' ? partitionBulkSeparar(selected) : partitionBulkAdvance(selected);
    const skipped = part.skipped.map((s) => ({
      publicId: s.item.publicId,
      reason: s.reason,
    }));
    if (!part.eligible.length) {
      const fb = formatBulkAdvanceFeedback({ ok: [], failed: [], skipped }, mode);
      setMsg(fb.msg);
      setErr(fb.err || 'Nenhum pedido elegível na seleção.');
      return;
    }
    const confirmText = bulkConfirmMessage(mode, part.eligible.length);
    if (confirmText && !window.confirm(confirmText)) return;
    setBulkBusy(true);
    setBusyId('bulk');
    setErr('');
    setMsg('');
    const result: BulkAdvanceResult = { ok: [], failed: [], skipped };
    let i = 0;
    for (const order of part.eligible) {
      i += 1;
      setBulkProgress(bulkProgressLabel(i, part.eligible.length, mode));
      const next = nextOneClickFulfillmentStatus(order.status);
      if (!next) {
        result.skipped.push({ publicId: order.publicId, reason: 'no_transition' });
        continue;
      }
      try {
        await api(`/admin/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: next }),
        });
        result.ok.push({ publicId: order.publicId, from: order.status, to: next });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Falha ao atualizar status';
        result.failed.push({ publicId: order.publicId, message });
      }
    }
    const fb = formatBulkAdvanceFeedback(result, mode);
    setMsg(fb.msg);
    setErr(fb.err);
    setSelectedOrderIds([]);
    setBulkBusy(false);
    setBulkProgress('');
    setBusyId(null);
    await load();
    void loadOps();
  }

  function pickListPhoto(productId: string) {
    listPhotoProductIdRef.current = productId;
    const input = listPhotoInputRef.current;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  async function uploadListCoverPhoto(productId: string, file: File | null) {
    if (!file) return;
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setErr('Produto não encontrado na lista carregada. Atualize e tente de novo.');
      return;
    }
    const coverUrl = productCoverUrl(product);
    const currentCount = product.images?.length ?? 0;
    const invalid = validateProductPhotoFile(file, currentCount, MAX_PRODUCT_IMAGES);
    if (invalid) {
      setErr(invalid);
      return;
    }
    setListPhotoBusyId(productId);
    setErr('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiUpload<{ url: string }>('/admin/uploads', fd);
      const url = data.url;
      const updated = await api<AdminProduct>(`/admin/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      let finalProduct = updated;
      const promote = shouldPromoteUploadedImageToCover(coverUrl);
      const ids = (updated.images || []).map((img) => img.id).filter(Boolean);
      const added =
        (updated.images || []).find((img) => img.url === url) ||
        [...(updated.images || [])].sort((a, b) => (b.position ?? 0) - (a.position ?? 0))[0];
      if (promote && added?.id && ids.length > 1) {
        const ordered = orderedIdsWithNewCover(ids, added.id);
        finalProduct = await api<AdminProduct>(`/admin/products/${productId}/images/reorder`, {
          method: 'PATCH',
          body: JSON.stringify({ orderedIds: ordered }),
        });
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === finalProduct.id ? { ...p, ...finalProduct } : p)),
      );
      if (editingId === productId) {
        const imgs = mapProductImages(finalProduct.images);
        setFormImages(imgs);
        syncCoverUrl(imgs);
      }
      setMsg(listPhotoUploadSuccessMessage(product.name, promote));
      void loadOps();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Falha ao enviar foto';
      setErr(message);
    } finally {
      setListPhotoBusyId(null);
    }
  }


  async function resendStorePaidNotify(order: AdminOrder) {
    if (
      !window.confirm(
        `Reenviar aviso de venda paga para a loja (e-mail/in-app) do pedido ${order.publicId}? Não cria cobrança.`,
      )
    ) {
      return;
    }
    setBusyId(order.id);
    setErr('');
    setMsg('');
    try {
      const data = await api<{ publicId: string; emailsAttempted: number; inAppCreated: number }>(
        `/admin/orders/${order.id}/notify-paid`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setMsg(
        `Aviso loja reenviado (${data.publicId}): e-mails tentados ${data.emailsAttempted}, in-app ${data.inAppCreated}. Confira STORE_NOTIFY_EMAIL / MAIL_FROM se zero.`,
      );
    } catch (e: any) {
      setErr(e.message || 'Falha ao reenviar aviso da loja');
    } finally {
      setBusyId(null);
    }
  }

  async function copyOrderField(kind: 'publicId' | 'tracking', value: string) {
    const v = (value || '').trim();
    if (!v) {
      setErr(kind === 'tracking' ? 'Sem rastreio para copiar.' : 'Sem publicId.');
      return;
    }
    setErr('');
    const ok = await copyTextToClipboard(v);
    if (ok) setMsg(copySuccessMessage(kind, v));
    else setErr('Não foi possível copiar — copie manualmente.');
  }

  async function saveSeller(e: React.FormEvent) {
    e.preventDefault();
    if (!sellerForm.name.trim()) {
      setErr('Informe o nome do vendedor');
      return;
    }
    setSavingSeller(true);
    setMsg('');
    setErr('');
    try {
      await api('/admin/sellers', {
        method: 'POST',
        body: JSON.stringify({
          name: sellerForm.name.trim(),
          slug: sellerForm.slug.trim() || undefined,
          status: sellerForm.status,
        }),
      });
      setSellerForm({ name: '', slug: '', status: 'pending' });
      setMsg('Vendedor criado.');
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao criar vendedor');
    } finally {
      setSavingSeller(false);
    }
  }

  async function setSellerStatus(seller: AdminSeller, status: 'active' | 'suspended' | 'pending') {
    setSellerBusyId(seller.id);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/sellers/${seller.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMsg(`Vendedor ${seller.name}: ${status}`);
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao atualizar status do vendedor');
    } finally {
      setSellerBusyId(null);
    }
  }



  async function setSellerOwner(seller: AdminSeller) {
    const email = (ownerDraft[seller.id] ?? seller.owner?.email ?? '').trim();
    setOwnerBusyId(seller.id);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/sellers/${seller.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ownerEmail: email || null,
        }),
      });
      setMsg(email ? `Dono vinculado: ${email}` : 'Dono removido');
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao vincular dono');
    } finally {
      setOwnerBusyId(null);
    }
  }

  async function approveCommission(c: AdminCommission) {
    setCommissionBusyId(c.id);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/commissions/${c.id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      setMsg(`Comissão aprovada: ${c.seller.name} · ${brl(c.amount)}`);
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao aprovar comissão');
    } finally {
      setCommissionBusyId(null);
    }
  }

  async function markCommissionPaid(c: AdminCommission) {
    const payoutReference = (payoutDraft[c.id] || '').trim();
    setCommissionBusyId(c.id);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/commissions/${c.id}/paid`, {
        method: 'PATCH',
        body: JSON.stringify({
          payoutReference: payoutReference || undefined,
        }),
      });
      setMsg(
        payoutReference
          ? `Comissão marcada paga (${payoutReference})`
          : `Comissão marcada paga: ${c.seller.name}`,
      );
      setPayoutDraft((d) => {
        const next = { ...d };
        delete next[c.id];
        return next;
      });
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao marcar comissão como paga');
    } finally {
      setCommissionBusyId(null);
    }
  }

  async function exportCommissionsCsv() {
    if (!commissionSellerFilter) {
      setErr('Selecione um vendedor para exportar o CSV.');
      return;
    }
    setErr('');
    setMsg('');
    try {
      const data = await api<{ csv: string; filename: string; count: number }>(
        `/admin/commissions/export?sellerId=${encodeURIComponent(commissionSellerFilter)}&status=${encodeURIComponent(commissionStatusFilter === 'all' ? 'all' : commissionStatusFilter)}`,
      );
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'commissions.csv';
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`CSV exportado (${data.count} linha(s)).`);
    } catch (err: any) {
      setErr(err.message || 'Falha ao exportar CSV');
    }
  }

  async function saveSeo(e: React.FormEvent) {
    e.preventDefault();
    setSavingSeo(true);
    setMsg('');
    setErr('');
    try {
      const data = await api<StoreSeoSettings>('/admin/store/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          siteTitle: seoForm.siteTitle.trim(),
          siteDescription: seoForm.siteDescription.trim(),
          ogImageUrl: seoForm.ogImageUrl.trim() || null,
        }),
      });
      setSeoForm({
        siteTitle: data.siteTitle,
        siteDescription: data.siteDescription,
        ogImageUrl: data.ogImageUrl || '',
      });
      setMsg('SEO da loja salvo.');
    } catch (err: any) {
      setErr(err.message || 'Falha ao salvar SEO');
    } finally {
      setSavingSeo(false);
    }
  }

  async function uploadBannerPhoto(file: File | null) {
    if (!file) return;
    setUploadingBanner(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiUpload<{ url: string }>('/admin/uploads', fd);
      setBannerForm((f) => ({ ...f, imageUrl: data.url }));
      setMsg('Foto do banner enviada.');
    } catch (err: any) {
      setErr(err.message || 'Falha no upload do banner');
    } finally {
      setUploadingBanner(false);
    }
  }

  function startEditBanner(b: AdminBanner) {
    setEditingBannerId(b.id);
    setBannerForm({
      title: b.title || '',
      alt: b.alt || '',
      imageUrl: b.imageUrl || '',
      linkUrl: b.linkUrl || '',
      active: b.active,
    });
    setMsg('');
    setErr('');
  }

  function resetBannerForm() {
    setEditingBannerId(null);
    setBannerForm(emptyBannerForm());
  }

  async function saveBanner(e: React.FormEvent) {
    e.preventDefault();
    if (!bannerForm.imageUrl.trim()) {
      setErr('Envie ou informe a imagem do banner');
      return;
    }
    setSavingBanner(true);
    setMsg('');
    setErr('');
    try {
      const body = {
        title: bannerForm.title.trim(),
        alt: bannerForm.alt.trim() || bannerForm.title.trim(),
        imageUrl: bannerForm.imageUrl.trim(),
        linkUrl: bannerForm.linkUrl.trim() || null,
        active: bannerForm.active,
      };
      if (editingBannerId) {
        await api(`/admin/banners/${editingBannerId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setMsg('Banner atualizado.');
      } else {
        await api('/admin/banners', { method: 'POST', body: JSON.stringify(body) });
        setMsg('Banner criado.');
      }
      resetBannerForm();
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao salvar banner');
    } finally {
      setSavingBanner(false);
    }
  }

  async function toggleBannerActive(b: AdminBanner) {
    setBannerBusyId(b.id);
    setErr('');
    try {
      await api(`/admin/banners/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !b.active }),
      });
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao alterar banner');
    } finally {
      setBannerBusyId(null);
    }
  }

  async function deleteBanner(b: AdminBanner) {
    if (!confirm(`Excluir o banner "${b.title || b.id}"?`)) return;
    setBannerBusyId(b.id);
    setErr('');
    try {
      await api(`/admin/banners/${b.id}`, { method: 'DELETE' });
      setMsg('Banner excluído.');
      if (editingBannerId === b.id) resetBannerForm();
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao excluir banner');
    } finally {
      setBannerBusyId(null);
    }
  }

  async function moveBanner(b: AdminBanner, dir: -1 | 1) {
    const sorted = [...banners].sort((a, c) => a.sortOrder - c.sortOrder);
    const i = sorted.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    setBannerBusyId(b.id);
    setErr('');
    try {
      const list = await api<AdminBanner[]>('/admin/banners/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds: next.map((x) => x.id) }),
      });
      setBanners(list);
    } catch (err: any) {
      setErr(err.message || 'Falha ao reordenar');
    } finally {
      setBannerBusyId(null);
    }
  }


  async function saveAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSavingAdmin(true);
    setErr('');
    setMsg('');
    const name = adminForm.name.trim();
    const email = adminForm.email.trim().toLowerCase();
    const password = adminForm.password;
    if (!name || !email || !password) {
      setErr('Informe nome, e-mail e senha do administrador.');
      setSavingAdmin(false);
      return;
    }
    if (password.length < 8) {
      setErr('A senha deve ter pelo menos 8 caracteres (letras e números).');
      setSavingAdmin(false);
      return;
    }
    try {
      await api('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      setMsg('Administrador criado. A pessoa já pode entrar em /admin com esse e-mail e senha.');
      setAdminForm(emptyAdminUserForm());
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao criar administrador');
    } finally {
      setSavingAdmin(false);
    }
  }

  async function toggleAdminStatus(a: AdminUser) {
    const me = currentUser();
    if (me?.id === a.id && a.status === 'active') {
      setErr('Você não pode desativar a si mesmo.');
      return;
    }
    const next = a.status === 'active' ? 'blocked' : 'active';
    const label = next === 'blocked' ? 'desativar' : 'reativar';
    if (!confirm(`Confirma ${label} o admin ${a.email}?`)) return;
    setAdminBusyId(a.id);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/admins/${a.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setMsg(next === 'blocked' ? 'Administrador desativado.' : 'Administrador reativado.');
      await load();
    } catch (err: any) {
      setErr(err.message || 'Falha ao atualizar administrador');
    } finally {
      setAdminBusyId(null);
    }
  }


  const shellBadges = {
    paid: ops?.paidAwaitingOrg?.paidAwaitingCount ?? ops?.orders?.buckets?.paid ?? 0,
    recon: ops?.reconciliations?.openCount ?? 0,
    lowStock: ops?.inventory?.lowStockCount ?? 0,
    alerts: attentionAlerts.length || (ops?.alerts?.length ?? 0),
  };

  return (
    <AdminShell
      section={adminSection}
      onSectionChange={goAdminSection}
      badges={shellBadges}
    >
      {err ? <div className="alert">{err}</div> : null}
      {msg ? <div className="ok">{msg}</div> : null}

      {adminSection === 'ops' ? (
      <div className="admin-section-panel">
      <AdminAttentionStrip
        items={attentionAlerts.map((a) => ({
          code: a.code,
          severity: a.severity,
          message: a.message,
          recommendedAction: a.recommendedAction,
          evidenceLine: a.evidence?.reason
            ? `Evidência: ${a.evidence.reason}${
                a.evidence.providerStatus ? ` · status ${a.evidence.providerStatus}` : ''
              }${
                a.evidence.externalReference
                  ? ` · ref ${a.evidence.externalReference}`
                  : ''
              }`
            : null,
          ctaHint:
            a.section === 'reconciliations'
              ? '→ Reconciliações'
              : a.section === 'catalog'
                ? '→ Catálogo (fotos)'
                : a.queueBucket
                  ? '→ abrir fila'
                  : null,
        }))}
        onSelect={(code) => {
          const a = attentionAlerts.find((x) => x.code === code);
          if (a) selectOpsAlert(a);
        }}
      />

      <section className="admin-ops" aria-label="Centro de comando">
        <div className="admin-ops__body">
          <div className="admin-ops__head">
            <h2 className="admin-ops__title">Centro de comando</h2>
            <button
              type="button"
              className="btn ghost admin-btn-accent"
              disabled={opsBusy}
              onClick={() => {
                void loadOps();
                void loadReconciliations();
              }}
            >
              {opsBusy ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
          <p className="admin-ops__intro">
            Dados reais de GET /admin/ops e reconciliações. Sem métricas inventadas. Alertas = revisão humana.
          </p>

          <div className="admin-kpi-grid">
            <div className="admin-kpi admin-kpi--accent">
              <div className="admin-kpi__label">Receita hoje</div>
              <div className="admin-kpi__value">
                {ops?.sales?.today ? brl(ops.sales.today.revenue) : '—'}
              </div>
              <div className="admin-kpi__hint">
                {ops?.sales?.today ? `${ops.sales.today.orderCount} pedido(s) pagos` : 'aguardando snapshot'}
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi__label">Receita 30 dias</div>
              <div className="admin-kpi__value">
                {ops?.sales?.last30d ? brl(ops.sales.last30d.revenue) : '—'}
              </div>
              <div className="admin-kpi__hint">
                {ops?.sales?.last30d ? `${ops.sales.last30d.orderCount} pedido(s) pagos` : 'aguardando snapshot'}
              </div>
            </div>
            <div className={`admin-kpi${(ops?.inventory.lowStockCount ?? 0) > 0 ? ' admin-kpi--warn' : ' admin-kpi--accent'}`}>
              <div className="admin-kpi__label">Estoque baixo</div>
              <div className="admin-kpi__value">{ops?.inventory.lowStockCount ?? '—'}</div>
            </div>
            <div className={`admin-kpi${(ops?.inventory.outOfStockCount ?? 0) > 0 ? ' admin-kpi--danger' : ''}`}>
              <div className="admin-kpi__label">Zerados</div>
              <div className={`admin-kpi__value${(ops?.inventory.outOfStockCount ?? 0) > 0 ? ' admin-kpi__value--danger' : ''}`}>
                {ops?.inventory.outOfStockCount ?? '—'}
              </div>
            </div>
            <div className={`admin-kpi${(ops?.payments?.pendingCount ?? 0) > 0 ? ' admin-kpi--warn' : ' admin-kpi--accent'}`}>
              <div className="admin-kpi__label">Pag. pendentes</div>
              <div className="admin-kpi__value">{ops?.payments?.pendingCount ?? '—'}</div>
            </div>
            <button
              type="button"
              className={`admin-kpi${
                (ops?.paidAwaitingOrg?.stuckCount ?? 0) > 0
                  ? ' admin-kpi--danger'
                  : (ops?.orders?.buckets?.paid ?? 0) > 0
                    ? ' admin-kpi--warn'
                    : ' admin-kpi--accent'
              }`}
              onClick={() => selectOpsBucket('paid')}
            >
              <div className="admin-kpi__label">Pagos p/ organizar</div>
              <div
                className={`admin-kpi__value${
                  (ops?.paidAwaitingOrg?.stuckCount ?? 0) > 0 ? ' admin-kpi__value--danger' : ''
                }`}
              >
                {ops?.paidAwaitingOrg?.paidAwaitingCount ?? ops?.orders?.buckets?.paid ?? '—'}
              </div>
              <div className="admin-kpi__hint">
                {(ops?.paidAwaitingOrg?.stuckCount ?? 0) > 0
                  ? `${ops!.paidAwaitingOrg!.stuckCount} travado(s) ≥${ops?.paidAwaitingOrg?.stuckHoursThreshold ?? PAID_STUCK_HOURS_UI}h`
                  : `limite ${ops?.paidAwaitingOrg?.stuckHoursThreshold ?? PAID_STUCK_HOURS_UI}h`}
              </div>
            </button>
            <button
              type="button"
              className={`admin-kpi${(ops?.reconciliations?.openCount ?? 0) > 0 ? ' admin-kpi--danger' : ' admin-kpi--accent'}`}
              onClick={() => {
                const el = document.getElementById('admin-reconciliations');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                void loadReconciliations();
              }}
            >
              <div className="admin-kpi__label">Reconciliações</div>
              <div className={`admin-kpi__value${(ops?.reconciliations?.openCount ?? 0) > 0 ? ' admin-kpi__value--danger' : ''}`}>
                {ops?.reconciliations?.openCount ?? '—'}
              </div>
            </button>
            <button
              type="button"
              className={`admin-kpi${(ops?.catalog?.placeholderProductCount ?? 0) > 0 ? ' admin-kpi--warn' : ' admin-kpi--accent'}`}
              onClick={() => openCatalogPhotoQueue()}
            >
              <div className="admin-kpi__label">Foto p/ trocar</div>
              <div className="admin-kpi__value">{ops?.catalog?.placeholderProductCount ?? '—'}</div>
              <div className="admin-kpi__hint">fila Catálogo + CSV</div>
            </button>
            <div className={`admin-kpi${ops?.mail?.configured ? ' admin-kpi--accent' : ' admin-kpi--danger'}`}>
              <div className="admin-kpi__label">E-mail (env)</div>
              <div className={`admin-kpi__value${ops == null || ops.mail?.configured ? '' : ' admin-kpi__value--danger'}`} style={{ fontSize: 16 }}>
                {ops == null ? '—' : ops.mail?.configured ? 'Configurado' : 'Ausente'}
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi__label">Pedidos (total)</div>
              <div className="admin-kpi__value">{ops?.orders?.total ?? '—'}</div>
            </div>
          </div>

          {ops?.alerts?.length ? (
            <div style={{ marginBottom: 14 }}>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, color: '#f5e6a3' }}>
                Alertas (condições reais do snapshot)
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
                {ops.alerts.map((a) => {
                  const clickable = Boolean(a.queueBucket || a.section);
                  const tone =
                    a.severity === 'critical' || a.severity === 'high'
                      ? 'high'
                      : a.severity === 'warn'
                        ? 'warn'
                        : 'info';
                  return (
                    <li key={a.code}>
                      <button
                        type="button"
                        className={`admin-alert-btn admin-alert-btn--${tone}`}
                        onClick={() => selectOpsAlert(a)}
                        disabled={!clickable}
                        style={{
                          opacity: clickable ? 1 : 0.95,
                          cursor: clickable ? 'pointer' : 'default',
                        }}
                      >
                        <span style={{ fontSize: 11, textTransform: 'uppercase', marginRight: 8, opacity: 0.85 }}>
                          {a.severity}
                        </span>
                        {a.message}
                        {a.section === 'reconciliations'
                          ? ' → Reconciliações'
                          : a.queueBucket
                            ? ' → abrir fila'
                            : ''}
                        {a.recommendedAction ? (
                          <span style={{ display: 'block', fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                            {a.recommendedAction}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : ops ? (
            <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13, color: '#8a8a84' }}>
              Sem alertas no momento.
            </p>
          ) : null}

          <div style={{ marginTop: 4 }}>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 13, color: '#f5e6a3' }}>
              Fila operacional — clique no bucket para filtrar pedidos
            </p>
            <div className="admin-chip-row">
              <button
                type="button"
                className={`admin-chip${orderStatusFilter === '' ? ' is-active' : ''}`}
                onClick={() => selectOpsBucket('')}
              >
                Todos: {ops?.orders?.total ?? '—'}
              </button>
              {ADMIN_ORDER_QUEUE_BUCKETS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`admin-chip${orderStatusFilter === key ? ' is-active' : ''}`}
                  onClick={() => selectOpsBucket(key)}
                >
                  {adminQueueBucketLabel(key)}: {ops?.orders?.buckets?.[key] ?? 0}
                </button>
              ))}
            </div>
          </div>

          {ops?.catalog?.placeholderProducts?.length ? (
            <div style={{ marginTop: 14 }} id="admin-photos-checklist">
              <div
                className="row"
                style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
              >
                <p className="muted" style={{ margin: 0, fontSize: 13, color: '#f5e6a3', flex: 1 }}>
                  Checklist — produtos que precisam de foto da loja (sem inventar imagem).
                  Motivo: sem foto ou host placeholder (placehold.co etc.).
                </p>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => openCatalogPhotoQueue()}
                  style={{ borderColor: '#ffd100', color: '#ffd100', minHeight: 36 }}
                >
                  Abrir fila no Catálogo
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void downloadProductsNeedingPhotosCsv()}
                  style={{ borderColor: '#ffd100', color: '#ffd100', minHeight: 36 }}
                >
                  Baixar CSV
                </button>
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 13, color: '#f5f5f3' }}>
                {ops.catalog.placeholderProducts.map((p) => {
                  const reason =
                    p.reason ||
                    (p.imageUrl && p.imageUrl.trim() ? 'placeholder' : 'missing');
                  return (
                    <li
                      key={p.id}
                      style={{
                        marginBottom: 8,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: '#1a1a1a',
                        border: '1px solid #3a3a32',
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <b style={{ color: '#fff' }}>{p.name}</b>{' '}
                        <span
                          className="badge"
                          style={{
                            background: reason === 'missing' ? '#3a1515' : '#3a2f0a',
                            color: reason === 'missing' ? '#ffb4b4' : '#ffd100',
                            fontSize: 11,
                          }}
                        >
                          {reason === 'missing' ? 'Sem foto' : 'Placeholder'}
                        </span>
                        <br />
                        <code style={{ color: '#ffd100', fontSize: 11 }}>{p.id}</code>
                        {p.imageUrl ? (
                          <span style={{ display: 'block', fontSize: 11, opacity: 0.75, wordBreak: 'break-all' }}>
                            URL atual: {p.imageUrl}
                          </span>
                        ) : (
                          <span style={{ display: 'block', fontSize: 11, opacity: 0.75 }}>
                            URL atual: (vazia)
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: '#ffd100', color: '#111', minHeight: 36 }}
                        onClick={() => startEditById(p.id)}
                      >
                        Trocar foto
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : ops ? (
            <p className="muted" style={{ marginTop: 14, fontSize: 13, color: '#8a8a84' }}>
              Checklist de fotos: nenhum produto com placeholder/ausente no snapshot.
            </p>
          ) : null}
          {ops?.time ? (
            <p className="muted" style={{ marginBottom: 0, marginTop: 10, fontSize: 12, color: '#8a8a84' }}>
              Snapshot: {ops.time}
            </p>
          ) : null}
        </div>
      </section>

      <section
        id="admin-reconciliations"
        className="admin-ops"
        style={{ marginTop: 16 }}
        aria-label="Reconciliações"
      >
        <div className="admin-ops__body">
          <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <h2 className="admin-ops__title">Reconciliações</h2>
            <button
              type="button"
              className="btn ghost"
              disabled={reconBusy}
              onClick={() => void loadReconciliations()}
              style={{ borderColor: '#ffd100', color: '#ffd100' }}
            >
              {reconBusy ? 'Atualizando…' : 'Atualizar lista'}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: 14, color: '#b0b0a8' }}>
            Webhooks órfãos / pagamentos sem pedido local (`GET /admin/payments/reconciliations`).
            Somente revisão humana — sem estorno, cancelamento ou ajuste de estoque automático.
          </p>
          <p className="muted" style={{ fontSize: 13, color: '#f5e6a3', marginTop: 0 }}>
            Abertas no snapshot: {ops?.reconciliations?.openCount ?? '—'} · listadas: {reconciliations.length}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {(reconciliations.length
              ? reconciliations
              : (ops?.reconciliations?.recent || []).map((r) => ({
                  ...r,
                  provider: undefined,
                  externalId: undefined,
                  publicId: null,
                  amount: null,
                }))
            ).map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#1a1a1a',
                  border: '1px solid #ffd100',
                  fontSize: 13,
                }}
              >
                <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <b style={{ color: '#ffd100' }}>{r.reason || 'reconciliação'}</b>{' '}
                    <span className="badge" style={{ background: '#3a1515', color: '#ffb4b4' }}>
                      {r.status}
                    </span>
                    <div className="muted" style={{ fontSize: 12, color: '#b0b0a8', marginTop: 4 }}>
                      providerStatus: {r.providerStatus || '—'}
                      {r.externalReference ? ` · ref ${r.externalReference}` : ''}
                      {'publicId' in r && r.publicId ? ` · publicId ${r.publicId}` : ''}
                      {'externalId' in r && r.externalId ? ` · ext ${r.externalId}` : ''}
                      {'amount' in r && r.amount != null ? ` · ${brl(Number(r.amount))}` : ''}
                    </div>
                    <div className="muted" style={{ fontSize: 11, color: '#8a8a84' }}>
                      id {r.id} · {r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '—'}
                    </div>
                  </div>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f5e6a3' }}>
                  Ação recomendada: conferir no provedor (ref/publicId) e decidir manualmente. Não executar
                  estorno/cancelamento daqui.
                </p>
              </div>
            ))}
            {!reconciliations.length && !(ops?.reconciliations?.recent?.length) ? (
              <p className="muted" style={{ margin: 0, fontSize: 13, color: '#8a8a84' }}>
                Nenhuma reconciliação aberta.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      </div>
      ) : null}

      {adminSection === 'equipe' ? (
      <div className="admin-section-panel">
      <p className="admin-section-intro">
        Crie contas extras para a equipe. Todas têm o mesmo acesso ao painel. Desativar impede o login
        (não apaga o cadastro). Você não pode desativar a si mesmo nem o último admin ativo.
      </p>
      <section className="admin-card-pro">
        <div className="body">
          <h2>Novo administrador</h2>
          <form className="form admin-form-pro" style={{ marginTop: 12, marginBottom: 0 }} onSubmit={saveAdmin}>
            <label>
              Nome *
              <input
                value={adminForm.name}
                onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                placeholder="Ex.: Maria Schimitz"
                required
              />
            </label>
            <label>
              E-mail *
              <input
                type="email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                placeholder="admin2@loja.com"
                required
              />
            </label>
            <label>
              Senha * (mín. 8, letras e números)
              <input
                type="password"
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                placeholder="••••••••"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingAdmin}>
              {savingAdmin ? 'Salvando...' : 'Criar administrador'}
            </button>
          </form>
        </div>
      </section>
      <h3 className="admin-section-heading">Equipe ({admins.length})</h3>
      <div className="admin-dense-list">
            {admins.map((a) => {
              const me = currentUser();
              const isMe = me?.id === a.id;
              const active = a.status === 'active';
              return (
                <div
                  key={a.id}
                  className={`admin-dense-row${active ? '' : ' admin-dense-row--muted'}`}
                >
                  <div className="admin-dense-row__main">
                    <div className="admin-dense-row__title">
                      <b>{a.name}</b>
                      {isMe ? <AdminStatusChip label="Você" tone="accent" /> : null}
                      <AdminStatusChip label={adminUserStatusLabel(a.status)} tone={adminUserStatusTone(a.status)} />
                    </div>
                    <div className="admin-dense-row__meta">
                      {a.email}
                      {' · '}
                      desde {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="admin-dense-row__actions">
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={adminBusyId === a.id || (isMe && active)}
                    onClick={() => void toggleAdminStatus(a)}
                    title={isMe && active ? 'Você não pode desativar a si mesmo' : undefined}
                  >
                    {adminBusyId === a.id ? '...' : active ? 'Desativar' : 'Reativar'}
                  </button>
                  </div>
                </div>
              );
            })}
            {!admins.length ? (
              <p className="admin-empty">Nenhum administrador listado.</p>
            ) : null}
      </div>
      </div>
      ) : null}

      {adminSection === 'clientes' ? (
      <div className="admin-section-panel">
      <p className="admin-section-intro">
        Lista somente leitura: clientes com pedidos, total pago e histórico recente. Sem edição/exclusão.
      </p>
      <div className="admin-toolbar">
          <form
            className="admin-toolbar__row"
            onSubmit={(e) => {
              e.preventDefault();
              void loadCustomers(customerQ);
            }}
          >
            <label className="admin-search-field" style={{ flex: 1, minWidth: 200, maxWidth: 'none' }}>
              <span>Buscar (nome, e-mail ou telefone)</span>
              <input
                value={customerQ}
                onChange={(e) => setCustomerQ(e.target.value)}
                placeholder="Ex.: Maria ou 5199…"
              />
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={customerBusy}>
              {customerBusy ? 'Buscando…' : 'Buscar'}
            </button>
            <button
              className="btn ghost admin-btn-ghost-pro"
              type="button"
              disabled={customerBusy}
              onClick={() => {
                setCustomerQ('');
                void loadCustomers('');
              }}
            >
              Limpar
            </button>
          </form>
          <div className="admin-dense-row__meta">
            {customersTotal} cliente(s) · mostrando {customers.length}
          </div>
      </div>
      <div className="admin-dense-list">
            {customers.map((c) => (
              <div key={c.id} className="admin-dense-row">
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <b>{c.name}</b>
                    <AdminStatusChip
                      label={customerAccountLabel(c.status)}
                      tone={customerAccountTone(c.status)}
                    />
                  </div>
                  <div className="admin-dense-row__meta">
                    {c.email}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </div>
                  <div className="admin-dense-row__meta">
                    {c.ordersCount} pedido(s) · pagos {c.paidOrdersCount} · {brl(c.paidTotal)}
                    {c.lastPaidAt
                      ? ` · último ${new Date(c.lastPaidAt).toLocaleDateString('pt-BR')}`
                      : ''}
                  </div>
                </div>
                <div className="admin-dense-row__actions">
                <button
                  type="button"
                  className="btn ghost admin-btn-ghost-pro"
                  disabled={customerDetailBusy}
                  onClick={() => void openCustomer(c.id)}
                >
                  Ver pedidos
                </button>
                </div>
              </div>
            ))}
            {!customers.length ? (
              <p className="admin-empty">Nenhum cliente encontrado.</p>
            ) : null}
      </div>
          {customerDetail ? (
            <div className="admin-detail-panel">
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>
                  {customerDetail.name}{' '}
                  <span className="admin-dense-row__meta" style={{ fontWeight: 400 }}>
                    {customerDetail.email}
                  </span>
                </h3>
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => setCustomerDetail(null)}>
                  Fechar
                </button>
              </div>
              <p className="admin-dense-row__meta" style={{ marginTop: 0 }}>
                SCHIMITZ+ {brl(customerDetail.cashbackBalance)} · {customerDetail.addressesCount}{' '}
                endereço(s) · total pago {brl(customerDetail.paidTotal)}
              </p>
              <div className="admin-dense-list">
                {customerDetail.orders.map((o) => (
                  <div key={o.id} className="admin-dense-row">
                    <div className="admin-dense-row__main">
                      <div className="admin-dense-row__title">
                        <span className="admin-dense-row__code">{o.publicId}</span>
                        <AdminOrderStatusChip status={o.status} label={orderStatusLabel(o.status)} />
                      </div>
                      <div className="admin-dense-row__meta">
                        {brl(o.total)} · {new Date(o.createdAt).toLocaleString('pt-BR')}
                      </div>
                      <div className="admin-dense-row__meta">
                        {o.items.map((it) => `${it.qty}× ${it.name}`).join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
                {!customerDetail.orders.length ? (
                  <p className="admin-empty">Sem pedidos.</p>
                ) : null}
              </div>
            </div>
          ) : null}

      </div>
      ) : null}

      {adminSection === 'marketplace' ? (
      <div className="admin-section-panel">
      <p className="admin-section-intro">
        Fundação multi-seller. Checkout único continua igual. Repasse v1: ledger + PIX manual
        (sem split MP) — ver docs/MARKETPLACE.md. Produtos existentes ficam na Lojas Schimitz.
      </p>
      <section className="admin-card-pro">
        <div className="body">
          <h2>Novo vendedor</h2>
          <form className="form admin-form-pro" style={{ marginTop: 12, marginBottom: 0 }} onSubmit={saveSeller}>
            <label>
              Nome *
              <input
                value={sellerForm.name}
                onChange={(e) => setSellerForm({ ...sellerForm, name: e.target.value })}
                placeholder="Ex.: Parceiro Centro"
                required
              />
            </label>
            <label>
              Slug (opcional)
              <input
                value={sellerForm.slug}
                onChange={(e) => setSellerForm({ ...sellerForm, slug: e.target.value })}
                placeholder="parceiro-centro"
              />
            </label>
            <label>
              Status inicial
              <select
                value={sellerForm.status}
                onChange={(e) =>
                  setSellerForm({
                    ...sellerForm,
                    status: e.target.value as 'pending' | 'active' | 'suspended',
                  })
                }
              >
                <option value="pending">Pendente</option>
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
              </select>
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingSeller}>
              {savingSeller ? 'Salvando...' : 'Criar vendedor'}
            </button>
          </form>
        </div>
      </section>
      <h3 className="admin-section-heading">Vendedores ({sellers.length})</h3>
      <div className="admin-dense-list">
            {sellers.map((s) => (
              <div key={s.id} className={`admin-dense-row${s.status === 'suspended' ? ' admin-dense-row--muted' : ''}`}>
                <div className="admin-dense-row__main">
                    <div className="admin-dense-row__title">
                    <b>{s.name}</b>
                    <AdminStatusChip label={sellerStatusLabel(s.status)} tone={sellerStatusTone(s.status)} />
                    </div>
                    <div className="admin-dense-row__meta">
                      /{s.slug}
                      {s._count?.products != null ? ` · ${s._count.products} produto(s)` : ''}
                      {s.owner?.email ? ` · dono ${s.owner.email}` : ' · sem dono'}
                    </div>
                  <div className="admin-toolbar__row" style={{ marginTop: 10 }}>
                  <label className="admin-owner-field">
                    E-mail do dono (portal /vendedor)
                    <input
                      type="email"
                      value={ownerDraft[s.id] ?? s.owner?.email ?? ''}
                      onChange={(e) => setOwnerDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                      placeholder="vendedor@email.com"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn admin-btn-primary-accent"
                    disabled={ownerBusyId === s.id}
                    onClick={() => void setSellerOwner(s)}
                  >
                    {ownerBusyId === s.id ? '...' : 'Vincular dono'}
                  </button>
                  </div>
                </div>
                  <div className="admin-dense-row__actions">
                    {s.status !== 'active' ? (
                      <button
                        type="button"
                        className="btn admin-btn-primary-accent"
                        disabled={sellerBusyId === s.id}
                        onClick={() => void setSellerStatus(s, 'active')}
                      >
                        Ativar
                      </button>
                    ) : null}
                    {s.status !== 'suspended' ? (
                      <button
                        type="button"
                        className="btn ghost admin-btn-ghost-pro"
                        disabled={sellerBusyId === s.id}
                        onClick={() => void setSellerStatus(s, 'suspended')}
                      >
                        Suspender
                      </button>
                    ) : null}
                  </div>
              </div>
            ))}
            {!sellers.length ? (
              <p className="admin-empty">Nenhum vendedor ainda (rode a migration SCH-008).</p>
            ) : null}
      </div>

      <section className="admin-card-pro" style={{ marginTop: 16 }}>
        <div className="body">
          <h2>Comissões / Repasse (v1)</h2>
          <p className="admin-section-intro" style={{ marginTop: 8, marginBottom: 12 }}>
            Ledger no pagamento aprovado. Transferência real ainda é <b>PIX manual</b> (use a
            referência E2E ao marcar pago). Sem split Mercado Pago — ver docs/MARKETPLACE.md.
          </p>
          <div className="admin-toolbar" style={{ marginBottom: 12 }}>
          <div className="admin-toolbar__row">
            <label className="admin-date-field" style={{ minWidth: 140 }}>
              Status
              <select
                className="admin-filter-select"
                value={commissionStatusFilter}
                onChange={(e) =>
                  setCommissionStatusFilter(e.target.value as 'pending' | 'approved' | 'paid' | 'all')
                }
              >
                <option value="pending">Pendente</option>
                <option value="approved">Aprovada</option>
                <option value="paid">Paga</option>
                <option value="all">Todas</option>
              </select>
            </label>
            <label className="admin-date-field" style={{ minWidth: 200, flex: 1 }}>
              Vendedor
              <select
                className="admin-filter-select"
                value={commissionSellerFilter}
                onChange={(e) => setCommissionSellerFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn ghost admin-btn-ghost-pro"
              disabled={!commissionSellerFilter}
              onClick={() => void exportCommissionsCsv()}
              title={!commissionSellerFilter ? 'Selecione um vendedor' : 'Exportar CSV'}
            >
              Exportar CSV
            </button>
          </div>
          </div>
          <div className="admin-dense-list">
            {commissions.map((c) => (
              <div key={c.id} className="admin-dense-row">
                <div className="admin-dense-row__main">
                    <div className="admin-dense-row__title">
                    <b>{c.seller.name}</b>
                    <AdminStatusChip
                      label={commissionStatusLabel(c.status)}
                      tone={commissionStatusTone(c.status)}
                    />
                    <AdminStatusChip label={brl(c.amount)} tone="accent" />
                    <AdminStatusChip label={`${c.percent}%`} tone="neutral" />
                    </div>
                    <div className="admin-dense-row__meta">
                      {c.order.publicId} · {c.orderItem.qty}× {c.orderItem.name}
                      {c.payoutReference ? ` · ref ${c.payoutReference}` : ''}
                    </div>
                {c.status === 'pending' || c.status === 'approved' ? (
                  <div className="admin-toolbar__row" style={{ marginTop: 10 }}>
                    <label className="admin-owner-field">
                      Ref. PIX / nota
                      <input
                        value={payoutDraft[c.id] ?? ''}
                        onChange={(e) =>
                          setPayoutDraft((d) => ({ ...d, [c.id]: e.target.value }))
                        }
                        placeholder="E2E id ou observação"
                      />
                    </label>
                    {c.status === 'pending' ? (
                      <button
                        type="button"
                        className="btn ghost admin-btn-ghost-pro"
                        disabled={commissionBusyId === c.id}
                        onClick={() => void approveCommission(c)}
                      >
                        {commissionBusyId === c.id ? '...' : 'Aprovar'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn admin-btn-primary-accent"
                      disabled={commissionBusyId === c.id}
                      onClick={() => void markCommissionPaid(c)}
                    >
                      {commissionBusyId === c.id ? '...' : 'Marcar pago'}
                    </button>
                  </div>
                ) : null}
                </div>
              </div>
            ))}
            {!commissions.length ? (
              <p className="admin-empty">Nenhuma comissão neste filtro.</p>
            ) : null}
          </div>
        </div>
      </section>

      </div>
      ) : null}

      {adminSection === 'vitrine' ? (
      <div className="admin-section-panel">
      <section className="admin-card-pro">
        <div className="body">
          <h2>SEO da loja</h2>
          <p className="admin-section-intro" style={{ marginTop: 8 }}>
            Título e descrição usados nas abas do navegador e no compartilhamento (Open Graph).
          </p>
          <form className="form admin-form-pro" onSubmit={saveSeo}>
            <label>
              Título do site *
              <input
                value={seoForm.siteTitle}
                onChange={(e) => setSeoForm({ ...seoForm, siteTitle: e.target.value })}
                maxLength={120}
                required
              />
            </label>
            <label>
              Descrição (meta) *
              <textarea
                value={seoForm.siteDescription}
                onChange={(e) => setSeoForm({ ...seoForm, siteDescription: e.target.value })}
                maxLength={320}
                required
              />
            </label>
            <label>
              Imagem Open Graph (URL opcional)
              <input
                value={seoForm.ogImageUrl}
                onChange={(e) => setSeoForm({ ...seoForm, ogImageUrl: e.target.value })}
                placeholder="https://... (ou use upload de banner e cole a URL)"
              />
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingSeo}>
              {savingSeo ? 'Salvando...' : 'Salvar SEO'}
            </button>
          </form>
        </div>
      </section>

      <section className="admin-card-pro">
        <div className="body">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2>
              {editingBannerId ? 'Editar banner' : 'Banners da home'}
            </h2>
            {editingBannerId ? (
              <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={resetBannerForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>
          <p className="admin-section-intro">
            Imagem + link opcional. Só banners ativos aparecem na vitrine (carrossel).
          </p>
          <form className="form admin-form-pro" style={{ marginBottom: 20 }} onSubmit={saveBanner}>
            <label>
              Título (opcional)
              <input
                value={bannerForm.title}
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                placeholder="Ex.: Semana do eletro"
              />
            </label>
            <label>
              Texto alternativo (acessibilidade)
              <input
                value={bannerForm.alt}
                onChange={(e) => setBannerForm({ ...bannerForm, alt: e.target.value })}
                placeholder="Descreva a imagem"
              />
            </label>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Imagem do banner</div>
              <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label className="btn ghost admin-btn-ghost-pro" style={{ cursor: uploadingBanner ? 'wait' : 'pointer', margin: 0 }}>
                  {uploadingBanner ? 'Enviando...' : 'Enviar imagem'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingBanner || savingBanner}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      void uploadBannerPhoto(f);
                    }}
                  />
                </label>
                {bannerForm.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bannerForm.imageUrl}
                    alt="Prévia banner"
                    className="admin-banner-preview"
                  />
                ) : null}
              </div>
            </div>
            <label>
              URL da imagem *
              <input
                value={bannerForm.imageUrl}
                onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                placeholder="https://... ou envie acima"
                required
              />
            </label>
            <label>
              Link ao clicar (opcional)
              <input
                value={bannerForm.linkUrl}
                onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
                placeholder="/departamento/ofertas ou https://..."
              />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={bannerForm.active}
                onChange={(e) => setBannerForm({ ...bannerForm, active: e.target.checked })}
              />
              Banner ativo (aparece na home)
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingBanner}>
              {savingBanner ? 'Salvando...' : editingBannerId ? 'Salvar banner' : 'Criar banner'}
            </button>
          </form>

          <div className="admin-dense-list">
            {banners.map((b, i) => (
              <div
                key={b.id}
                className={`admin-dense-row${b.active ? '' : ' admin-dense-row--muted'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.imageUrl}
                  alt={b.alt || b.title || 'Banner'}
                  className="admin-banner-thumb"
                />
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <b>{b.title || '(sem título)'}</b>
                    <AdminStatusChip
                      label={bannerActiveLabel(b.active)}
                      tone={b.active ? 'ok' : 'neutral'}
                    />
                  </div>
                  <div className="admin-dense-row__meta">
                    ordem {i + 1}
                    {b.linkUrl ? ` · ${b.linkUrl}` : ''}
                  </div>
                </div>
                <div className="admin-dense-row__actions">
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={bannerBusyId === b.id || i === 0}
                    onClick={() => void moveBanner(b, -1)}
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={bannerBusyId === b.id || i === banners.length - 1}
                    onClick={() => void moveBanner(b, 1)}
                    title="Descer"
                  >
                    ↓
                  </button>
                  <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => startEditBanner(b)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={bannerBusyId === b.id}
                    onClick={() => void toggleBannerActive(b)}
                  >
                    {b.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={bannerBusyId === b.id}
                    onClick={() => void deleteBanner(b)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {!banners.length ? (
              <p className="admin-empty">Nenhum banner ainda. Crie o primeiro acima.</p>
            ) : null}
          </div>
        </div>
      </section>

      </div>
      ) : null}

      {adminSection === 'vendas' ? (
      <div className="admin-section-panel">
      <p className="admin-section-intro">
        Pedidos pagos no período (pago, separando, saiu para entrega, entregue). Horário de Brasília.
      </p>
      <div className="admin-toolbar">
          <div className="admin-filter-row">
            {[
              { label: 'Hoje', from: saoPauloYmd(), to: saoPauloYmd() },
              { label: '7 dias', from: addDaysYmd(saoPauloYmd(), -6), to: saoPauloYmd() },
              { label: '30 dias', from: addDaysYmd(saoPauloYmd(), -29), to: saoPauloYmd() },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`admin-filter-chip${salesPresetActive(salesFrom, salesTo, preset.from, preset.to) ? ' is-active' : ''}`}
                disabled={salesBusy}
                onClick={() => {
                  setSalesFrom(preset.from);
                  setSalesTo(preset.to);
                  void loadSalesReport(preset.from, preset.to);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <form
            className="admin-toolbar__row"
            onSubmit={(e) => {
              e.preventDefault();
              void loadSalesReport(salesFrom, salesTo);
            }}
          >
            <label className="admin-date-field">
              De
              <input
                type="date"
                value={salesFrom}
                onChange={(e) => setSalesFrom(e.target.value)}
                required
              />
            </label>
            <label className="admin-date-field">
              Até
              <input
                type="date"
                value={salesTo}
                onChange={(e) => setSalesTo(e.target.value)}
                required
              />
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={salesBusy}>
              {salesBusy ? 'Carregando...' : 'Atualizar'}
            </button>
          </form>
      </div>
          {salesReport ? (
            <>
              <div className="admin-kpi-lite-grid">
                <div className="admin-kpi-lite">
                  <div className="admin-kpi-lite__label">Pedidos pagos</div>
                  <div className="admin-kpi-lite__value">{salesReport.summary.orderCount}</div>
                </div>
                <div className="admin-kpi-lite">
                  <div className="admin-kpi-lite__label">Receita</div>
                  <div className="admin-kpi-lite__value">{brl(salesReport.summary.revenue)}</div>
                </div>
                <div className="admin-kpi-lite">
                  <div className="admin-kpi-lite__label">Ticket médio</div>
                  <div className="admin-kpi-lite__value">{brl(salesReport.summary.averageTicket)}</div>
                </div>
              </div>
              <div className="admin-split">
                <section className="admin-card-pro" style={{ marginBottom: 0 }}>
                  <div className="body">
                  <h3>Por status</h3>
                  {Object.keys(salesReport.byStatus).length ? (
                    <div className="admin-stat-list">
                      {Object.entries(salesReport.byStatus)
                        .sort((a, b) => b[1] - a[1])
                        .map(([st, count]) => (
                          <div key={st} className="admin-stat-row">
                            <span>{orderStatusLabel(st)}</span>
                            <b>{count}</b>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="admin-empty">Nenhum pedido no período.</p>
                  )}
                  </div>
                </section>
                <section className="admin-card-pro" style={{ marginBottom: 0 }}>
                  <div className="body">
                  <h3>Mais vendidos</h3>
                  {salesReport.topProducts.length ? (
                    <div className="admin-stat-list">
                      {salesReport.topProducts.map((tp) => (
                        <div key={tp.productId} className="admin-stat-row">
                          <span style={{ flex: 1, minWidth: 120 }}>{tp.name}</span>
                          <span className="admin-dense-row__meta">{tp.qty} un.</span>
                          <b>{brl(tp.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">Sem vendas pagas no período.</p>
                  )}
                  </div>
                </section>
              </div>
              <div className="admin-split" style={{ marginTop: 16 }}>
                <section className="admin-card-pro" style={{ marginBottom: 0 }}>
                  <div className="body">
                  <h3>Por dia</h3>
                  {(salesReport.byDay?.length ?? 0) ? (
                    <div className="admin-stat-list" style={{ maxHeight: 260, overflow: 'auto' }}>
                      {salesReport.byDay!.map((d) => (
                        <div key={d.date} className="admin-stat-row">
                          <span style={{ flex: 1, minWidth: 100 }}>
                            {new Date(`${d.date}T12:00:00-03:00`).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="admin-dense-row__meta">{d.orderCount} ped.</span>
                          <b>{brl(d.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">Sem vendas pagas no período.</p>
                  )}
                  </div>
                </section>
                <section className="admin-card-pro" style={{ marginBottom: 0 }}>
                  <div className="body">
                  <h3>Por vendedor</h3>
                  {(salesReport.bySeller?.length ?? 0) ? (
                    <div className="admin-stat-list">
                      {salesReport.bySeller!.map((s) => (
                        <div key={s.sellerId ?? 'loja'} className="admin-stat-row">
                          <span style={{ flex: 1, minWidth: 120 }}>
                            {s.sellerName}
                            {!s.sellerId ? (
                              <AdminStatusChip label="própria" tone="accent" />
                            ) : null}
                          </span>
                          <span className="admin-dense-row__meta">{s.itemQty} un. · {s.orderCount} ped.</span>
                          <b>{brl(s.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-empty">
                      Sem itens de vendas pagas (marketplace) no período.
                    </p>
                  )}
                  </div>
                </section>
              </div>
            </>
          ) : salesBusy ? (
            <p className="admin-empty">Carregando relatório…</p>
          ) : null}

      </div>
      ) : null}

      {adminSection === 'catalogo' ? (
      <div className="admin-section-panel admin-catalog">
      <section id="admin-product-form" className="admin-card-pro admin-catalog-form" style={{ marginTop: 0, marginBottom: 0 }}>
        <div className="body">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2>{editingLabel}</h2>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>
          <form className="form admin-form-pro" style={{ maxWidth: 560 }} onSubmit={saveProduct}>
            <label>
              Nome do produto *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder='Ex.: Smart TV 55" 4K'
                required
              />
            </label>
            <label>
              Descrição
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="O que o cliente precisa saber"
              />
            </label>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Preço (R$) *
                <input
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="199,90"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Preço “de” (opcional)
                <input
                  inputMode="decimal"
                  value={form.compareAtPrice}
                  onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                  placeholder="249,90"
                />
              </label>
            </div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Estoque *
                <input
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Código SKU
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Deixe em branco para gerar"
                />
              </label>
            </div>
            <label>
              Categoria
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vendedor (marketplace)
              <select
                value={form.sellerId}
                onChange={(e) => setForm({ ...form, sellerId: e.target.value })}
              >
                <option value="">Lojas Schimitz (padrão)</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status === 'suspended'}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Fotos do produto{' '}
                <span className="muted" style={{ fontWeight: 500 }}>
                  ({formImages.length}/{MAX_PRODUCT_IMAGES})
                </span>
              </div>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                Até {MAX_PRODUCT_IMAGES} fotos · JPG/PNG/WebP · 15 MB cada. A primeira é a capa da
                vitrine. Em produto já salvo, upload/remoção/reordenação aplica na hora.
              </p>
              <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <label
                  className="btn ghost"
                  style={{
                    cursor: uploading || formImages.length >= MAX_PRODUCT_IMAGES ? 'not-allowed' : 'pointer',
                    margin: 0,
                    opacity: formImages.length >= MAX_PRODUCT_IMAGES ? 0.6 : 1,
                  }}
                >
                  {uploading ? 'Enviando...' : 'Enviar fotos'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={uploading || saving || formImages.length >= MAX_PRODUCT_IMAGES}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = e.target.files;
                      e.target.value = '';
                      void uploadPhotos(files);
                    }}
                  />
                </label>
              </div>
              {formImages.length ? (
                <div className="admin-photo-grid">
                  {formImages.map((img, i) => (
                    <div
                      key={img.id || `${img.url}-${i}`}
                      className={`admin-photo-tile${i === 0 ? ' admin-photo-tile--cover' : ''}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Foto ${i + 1}`}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          objectFit: 'cover',
                          borderRadius: 8,
                          background: '#000',
                          display: 'block',
                        }}
                      />
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        {i === 0 ? 'Capa' : `Foto ${i + 1}`}
                      </div>
                      <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12, margin: 0 }}
                          disabled={i === 0 || uploading || saving}
                          onClick={() => void setCoverImage(i)}
                        >
                          Capa
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12, margin: 0 }}
                          disabled={i === 0 || uploading || saving}
                          onClick={() => void moveFormImage(i, -1)}
                          aria-label="Mover para esquerda"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12, margin: 0 }}
                          disabled={i >= formImages.length - 1 || uploading || saving}
                          onClick={() => void moveFormImage(i, 1)}
                          aria-label="Mover para direita"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px', fontSize: 12, margin: 0, color: '#ffb4b4' }}
                          disabled={uploading || saving}
                          onClick={() => {
                            if (confirm(`Remover foto ${i + 1}?`)) void removeFormImage(i);
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p role="status" className="admin-catalog-alert">
                  Sem foto — a vitrine fica sem imagem. Envie JPG/PNG/WebP ou cole uma URL abaixo
                  (capa).
                </p>
              )}
              {formImages.some((img) => isPlaceholderImageUrl(img.url)) ? (
                <p role="status" className="admin-catalog-alert" style={{ marginTop: 10 }}>
                  Há imagem placeholder (placehold.co) — troque por foto real antes de vender.
                </p>
              ) : null}
            </div>
            {!editingId ? (
              <label>
                URL da capa (opcional, se não enviar arquivo)
                <input
                  value={form.imageUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setForm({ ...form, imageUrl: url });
                    setFormImages((prev) => {
                      const trimmed = url.trim();
                      if (!trimmed) {
                        return prev.filter((_, i) => i !== 0).map((img, i) => ({ ...img, position: i }));
                      }
                      if (!prev.length) return [{ url: trimmed, position: 0 }];
                      const next = [...prev];
                      next[0] = { ...next[0], url: trimmed };
                      return next;
                    });
                  }}
                  placeholder="https://... ou use Enviar fotos"
                />
              </label>
            ) : null}
            <label>
              Selo / destaque (opcional)
              <input
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="Ex.: Oferta, Mais vendido"
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Produto ativo (aparece na loja)
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </form>
        </div>
      </section>

      
      </div>
      ) : null}

      {adminSection === 'cupons' ? (
      <div className="admin-section-panel">
      <p className="admin-section-intro">
            Crie códigos de desconto (% ou valor fixo). O cliente aplica no checkout. Use cupons ativos
            para campanhas (ex.: BEMVINDO10) mesmo sem banner na home.
      </p>
      {(() => {
        const couponStats = couponListStats(coupons);
        return (
          <div className="admin-stat-pills">
            <AdminStatusChip label={`${couponStats.active} ativo(s)`} tone="ok" />
            <AdminStatusChip label={`${couponStats.inactive} inativo(s)`} tone="neutral" />
            <AdminStatusChip label={`${couponStats.uses} uso(s) total`} tone="info" />
            <AdminStatusChip label={`${couponStats.reserved} reservado(s)`} tone="warn" />
          </div>
        );
      })()}
      <section className="admin-card-pro">
        <div className="body">
          <h2>Novo cupom</h2>
          <form className="form admin-form-pro" style={{ marginTop: 12, marginBottom: 0 }} onSubmit={saveCoupon}>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Código *
                <input
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="EX.: BEMVINDO10"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Tipo *
                <select
                  value={couponForm.type}
                  onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value as 'percent' | 'fixed' })}
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </label>
            </div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                {couponForm.type === 'percent' ? 'Percentual *' : 'Valor (R$) *'}
                <input
                  inputMode="decimal"
                  value={couponForm.value}
                  onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })}
                  placeholder={couponForm.type === 'percent' ? '10' : '50,00'}
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Subtotal mínimo (opcional)
                <input
                  inputMode="decimal"
                  value={couponForm.minSubtotal}
                  onChange={(e) => setCouponForm({ ...couponForm, minSubtotal: e.target.value })}
                  placeholder="0"
                />
              </label>
            </div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Validade (opcional)
                <input
                  type="date"
                  value={couponForm.endsAt}
                  onChange={(e) => setCouponForm({ ...couponForm, endsAt: e.target.value })}
                />
              </label>
              <label style={{ flex: 1 }}>
                Limite de usos (opcional)
                <input
                  inputMode="numeric"
                  value={couponForm.maxUses}
                  onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                  placeholder="Ilimitado"
                />
              </label>
            </div>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={couponForm.active}
                onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })}
              />
              Cupom ativo
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingCoupon}>
              {savingCoupon ? 'Salvando...' : 'Criar cupom'}
            </button>
          </form>
        </div>
      </section>
      <h3 className="admin-section-heading">Cupons ({coupons.length})</h3>
          <div className="admin-dense-list">
            {coupons.map((c) => {
              const expired = couponIsExpired(c.endsAt);
              const exhausted = couponIsExhausted(c.maxUses, c.usedCount);
              return (
              <div
                key={c.id}
                className={`admin-dense-row${c.active ? ' admin-dense-row--accent' : ' admin-dense-row--muted'}`}
              >
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <span className="admin-dense-row__code">{c.code}</span>
                    <AdminStatusChip
                      label={c.type === 'percent' ? `${c.value}%` : brl(c.value)}
                      tone="accent"
                    />
                    <AdminStatusChip
                      label={c.active ? 'Ativo' : 'Inativo'}
                      tone={c.active ? 'ok' : 'neutral'}
                    />
                    {expired ? <AdminStatusChip label="Expirado" tone="danger" /> : null}
                    {exhausted ? <AdminStatusChip label="Esgotado" tone="warn" /> : null}
                  </div>
                  <div className="admin-dense-row__meta">
                    {c.minSubtotal != null ? `Mín. ${brl(c.minSubtotal)} · ` : ''}
                    {c.endsAt ? `válido até ${new Date(c.endsAt).toLocaleDateString('pt-BR')} · ` : 'sem validade · '}
                    usos {c.usedCount}{c.maxUses != null ? `/${c.maxUses}` : ''}
                    {c.reservedCount ? ` · ${c.reservedCount} em pedidos abertos` : ''}
                  </div>
                </div>
                <div className="admin-dense-row__actions">
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => toggleCoupon(c)}>
                  {c.active ? 'Desativar' : 'Ativar'}
                </button>
                </div>
              </div>
              );
            })}
            {!coupons.length ? (
              <p className="admin-empty">
                Nenhum cupom ainda. Crie o primeiro acima — ele aparece no checkout mesmo sem banner.
              </p>
            ) : null}
          </div>

      </div>
      ) : null}

      {adminSection === 'avaliacoes' ? (
      <div className="admin-section-panel">
      <p className="admin-section-intro">
            Publicadas automaticamente. Você pode ocultar ou excluir se precisar.
      </p>
          <div className="admin-dense-list">
            {reviews.map((r) => (
              <div key={r.id} className={`admin-dense-row${r.status === 'hidden' ? ' admin-dense-row--muted' : ''}`}>
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <b aria-label={`${r.rating} de 5`}>{reviewStars(r.rating)}</b>
                    <AdminStatusChip
                      label={reviewStatusLabel(r.status)}
                      tone={reviewStatusTone(r.status)}
                    />
                  </div>
                  <div className="admin-dense-row__meta" style={{ marginTop: 4 }}>
                    <b style={{ color: 'var(--admin-ink)' }}>{r.user?.name || '—'}</b>
                    {' '}
                    ({r.user.email})
                  </div>
                  <div className="admin-dense-row__meta">
                    Produto:{' '}
                    <Link href={`/produto/${r.product.slug}`}>{r.product.name}</Link>
                    {' · '}
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  {r.body ? <p className="admin-dense-row__body">{r.body}</p> : (
                    <p className="admin-dense-row__meta" style={{ marginTop: 6 }}>Sem comentário</p>
                  )}
                </div>
                <div className="admin-dense-row__actions">
                  {r.status === 'published' ? (
                    <button
                      type="button"
                      className="btn ghost admin-btn-ghost-pro"
                      disabled={reviewBusyId === r.id}
                      onClick={() => setReviewStatus(r, 'hidden')}
                    >
                      Ocultar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost admin-btn-ghost-pro"
                      disabled={reviewBusyId === r.id}
                      onClick={() => setReviewStatus(r, 'published')}
                    >
                      Publicar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={reviewBusyId === r.id}
                    onClick={() => deleteReview(r)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {!reviews.length ? <p className="admin-empty">Nenhuma avaliação ainda.</p> : null}
          </div>

      </div>
      ) : null}

      {adminSection === 'frete' ? (
      <div className="admin-section-panel">
      <p className="admin-section-intro">
            Sem Melhor Envio/Correios. Defina frete grátis, taxa padrão e zonas por prefixo de CEP
            (ex.: 890 = região; 89010 = mais específico). O prefixo mais longo vence.
      </p>
      <section className="admin-card-pro">
        <div className="body">
          <h2>Configuração padrão</h2>
          <form className="form admin-form-pro" onSubmit={saveShippingSettings} style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Frete grátis a partir de (R$) *
                <input
                  inputMode="decimal"
                  value={shippingForm.freeAbove}
                  onChange={(e) => setShippingForm({ ...shippingForm, freeAbove: e.target.value })}
                  placeholder="299"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Taxa padrão (R$) *
                <input
                  inputMode="decimal"
                  value={shippingForm.defaultFee}
                  onChange={(e) => setShippingForm({ ...shippingForm, defaultFee: e.target.value })}
                  placeholder="19,90"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Prazo padrão (dias) *
                <input
                  inputMode="numeric"
                  value={shippingForm.defaultDays}
                  onChange={(e) => setShippingForm({ ...shippingForm, defaultDays: e.target.value })}
                  placeholder="5"
                  required
                />
              </label>
            </div>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingShipping}>
              {savingShipping ? 'Salvando...' : 'Salvar configuração de frete'}
            </button>
            {shippingSettings ? (
              <p className="admin-dense-row__meta" style={{ margin: 0 }}>
                Atual: grátis ≥ {brl(shippingSettings.freeAbove)} · padrão {brl(shippingSettings.defaultFee)} ·{' '}
                {shippingSettings.defaultDays} dias
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <section className="admin-card-pro">
        <div className="body">
          <h2>Zonas por CEP</h2>
          <form className="form admin-form-pro" onSubmit={saveCepRule} style={{ marginTop: 12, marginBottom: 14 }}>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <label style={{ flex: 1 }}>
                Prefixo CEP *
                <input
                  value={cepRuleForm.cepPrefix}
                  onChange={(e) => setCepRuleForm({ ...cepRuleForm, cepPrefix: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  placeholder="Ex.: 890 ou 89010"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Taxa (R$) *
                <input
                  inputMode="decimal"
                  value={cepRuleForm.fee}
                  onChange={(e) => setCepRuleForm({ ...cepRuleForm, fee: e.target.value })}
                  placeholder="15,00"
                  required
                />
              </label>
              <label style={{ flex: 1 }}>
                Prazo (dias) *
                <input
                  inputMode="numeric"
                  value={cepRuleForm.estimatedDays}
                  onChange={(e) => setCepRuleForm({ ...cepRuleForm, estimatedDays: e.target.value })}
                  placeholder="3"
                  required
                />
              </label>
            </div>
            <label>
              Nome da zona (opcional)
              <input
                value={cepRuleForm.label}
                onChange={(e) => setCepRuleForm({ ...cepRuleForm, label: e.target.value })}
                placeholder="Ex.: Grande Florianópolis"
              />
            </label>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={cepRuleForm.active}
                onChange={(e) => setCepRuleForm({ ...cepRuleForm, active: e.target.checked })}
              />
              Zona ativa
            </label>
            <button className="btn admin-btn-primary-accent" type="submit" disabled={savingCepRule}>
              {savingCepRule ? 'Salvando...' : 'Adicionar zona'}
            </button>
          </form>
          <div className="admin-dense-list">
            {shippingRules.map((r) => (
              <div
                key={r.id}
                className={`admin-dense-row${r.active ? '' : ' admin-dense-row--muted'}`}
              >
                <div className="admin-dense-row__main">
                  <div className="admin-dense-row__title">
                    <b>CEP {r.cepPrefix}…</b>
                    <AdminStatusChip
                      label={shippingZoneActiveLabel(r.active)}
                      tone={r.active ? 'ok' : 'neutral'}
                    />
                  </div>
                  <div className="admin-dense-row__meta">
                    {brl(r.fee)} · {r.estimatedDays} dia{r.estimatedDays === 1 ? '' : 's'}
                    {r.label ? ` · ${r.label}` : ''}
                  </div>
                </div>
                <div className="admin-dense-row__actions">
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => toggleCepRule(r)}>
                  {r.active ? 'Desativar' : 'Ativar'}
                </button>
                <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => removeCepRule(r)}>
                  Remover
                </button>
                </div>
              </div>
            ))}
            {!shippingRules.length ? (
              <p className="admin-empty">Nenhuma zona ainda. Sem zonas, vale a taxa padrão para todos os CEPs.</p>
            ) : null}
          </div>
        </div>
      </section>

      </div>
      ) : null}

      {adminSection === 'catalogo' ? (
      <div className="admin-section-panel admin-catalog">
<section className={`admin-card-pro admin-catalog-panel${lowStockProducts.length ? ' admin-catalog-panel--low' : ''}`} style={{ marginBottom: 0, borderColor: lowStockProducts.length ? 'var(--admin-danger)' : undefined }}>
        <div className="body">
          <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <h2>
              Estoque baixo{' '}
              <AdminStatusChip
                label={String(lowStockProducts.length)}
                tone={lowStockProducts.length ? 'danger' : 'ok'}
              />
            </h2>
            <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0, color: 'var(--admin-text)', fontSize: 13 }}>
              Limite ≤
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setLowStockThreshold(Number.isNaN(n) || n < 0 ? DEFAULT_LOW_STOCK : n);
                }}
                style={{ width: 72, minHeight: 36 }}
              />
            </label>
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Produtos com estoque em mãos igual ou abaixo do limite. Clique em Editar para repor.
          </p>
          {lowStockProducts.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {lowStockProducts.map((p) => (
                <div key={p.id} className="admin-low-stock-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{p.name}</b>
                    <div className="muted">
                      Estoque: {p.inventory?.qtyOnHand ?? 0}
                      {(p.inventory?.qtyReserved ?? 0) > 0
                        ? ` · ${availableStock(p)} disponível`
                        : null}
                      {!p.active ? ' · Inativo' : ''}
                    </div>
                  </div>
                  <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              Nenhum produto abaixo do limite. Bom trabalho!
            </p>
          )}
        </div>
      </section>

      <h3 id="admin-photo-queue" className="admin-section-heading">
        Produtos (
        {catalogPhotoFilter === 'needs_photo'
          ? `${visibleCatalogProducts.length} / ${products.length}`
          : products.length}
        )
      </h3>
      <div className="admin-catalog-toolbar">
        <button
          type="button"
          className={`admin-filter-chip${catalogPhotoFilter === 'all' ? ' is-active' : ''}`}
          onClick={() => setCatalogPhotoFilter('all')}
        >
          Todos ({products.length})
        </button>
        <button
          type="button"
          className={`admin-filter-chip${catalogPhotoFilter === 'needs_photo' ? ' is-active' : ''}`}
          onClick={() => setCatalogPhotoFilter('needs_photo')}
        >
          Sem foto / placeholder ({photoQueueCount})
        </button>
        {ops?.catalog?.placeholderProductCount != null ? (
          <AdminStatusChip
            label={`Ops: ${ops.catalog.placeholderProductCount}`}
            tone={photoQueueCount > 0 ? 'warn' : 'ok'}
            title="Contagem do snapshot GET /admin/ops — Foto p/ trocar"
          />
        ) : null}
        <button
          type="button"
          className="btn ghost admin-btn-ghost-pro"
          onClick={() => void downloadProductsNeedingPhotosCsv()}
        >
          Baixar CSV
        </button>
      </div>
      {photoQueueCount ? (
        <p role="status" className="admin-catalog-alert">
          {photoQueueAlignmentNote(ops?.catalog?.placeholderProductCount, photoQueueCount)}
        </p>
      ) : catalogPhotoFilter === 'needs_photo' ? (
        <p role="status" className="admin-catalog-alert" style={{ background: 'var(--admin-ok-soft)', borderColor: '#86efac', color: 'var(--admin-ok)' }}>
          {emptyPhotoQueueMessage('needs_photo')}
        </p>
      ) : null}
      <input
        ref={listPhotoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="admin-file-hidden"
        aria-label="Enviar foto real pela lista do catálogo"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          e.target.value = '';
          const productId = listPhotoProductIdRef.current;
          listPhotoProductIdRef.current = null;
          if (productId) void uploadListCoverPhoto(productId, file);
        }}
      />
      <div className="admin-product-list" style={{ marginBottom: 8 }}>
        {visibleCatalogProducts.map((p) => {
          const avail = availableStock(p);
          const onHand = p.inventory?.qtyOnHand ?? 0;
          const isLow = onHand <= lowStockThreshold;
          const imgUrl = rewritePublicUploadUrl(p.images?.[0]?.url) || p.images?.[0]?.url;
          const isPlaceholderImg = productNeedsStorePhoto(imgUrl);
          const photoKind = productPhotoBadgeKind({
            hasUrl: Boolean(imgUrl && String(imgUrl).trim()),
            isPlaceholderOrMissing: isPlaceholderImg,
          });
          const photoLabel = productPhotoBadgeLabel(photoKind);
          const listBusy = listPhotoBusyId === p.id;
          return (
            <div
              key={p.id}
              className={`admin-product-row${isLow ? ' admin-product-row--low' : ''}${isPlaceholderImg ? ' admin-product-row--needs-photo' : ''}`}
            >
              {imgUrl && !isPlaceholderImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl} alt="" className="admin-product-row__thumb" />
              ) : (
                <div className="admin-product-row__ph" aria-hidden>
                  {photoLabel || 'Sem foto'}
                </div>
              )}
              <div className="admin-product-row__main">
                <div className="admin-product-row__title">
                  <b>{p.name}</b>
                  <AdminProductActiveChip active={Boolean(p.active)} />
                  {photoLabel ? (
                    <AdminStatusChip label={photoLabel} tone="warn" />
                  ) : null}
                  {isLow ? (
                    <AdminProductStockChip
                      onHand={onHand}
                      threshold={lowStockThreshold}
                      active={Boolean(p.active)}
                      label="Estoque baixo"
                    />
                  ) : null}
                </div>
                <div className="admin-product-row__meta">
                  {p.sku} · {brl(p.price)}
                  {p.category ? ` · ${p.category.name}` : ''}
                </div>
                <div className="admin-product-row__meta" style={{ color: isLow ? 'var(--admin-danger)' : undefined }}>
                  Estoque: {onHand}
                  {(p.inventory?.qtyReserved ?? 0) > 0
                    ? ` (${avail} disponível, ${p.inventory?.qtyReserved} reservado)`
                    : null}
                </div>
              </div>
              <div className="admin-product-row__actions">
                {isPlaceholderImg ? (
                  <button
                    type="button"
                    className="btn admin-btn-photo"
                    disabled={listBusy || uploading}
                    onClick={() => pickListPhoto(p.id)}
                  >
                    {listBusy ? 'Enviando…' : 'Enviar foto'}
                  </button>
                ) : null}
                {isPlaceholderImg ? (
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    onClick={() => startEdit(p)}
                  >
                    Editar / galeria
                  </button>
                ) : (
                  <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                )}
                {p.active ? (
                  <Link className="btn ghost admin-btn-ghost-pro" href={`/produto/${p.slug}`} target="_blank">
                    Ver na loja
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
        {!visibleCatalogProducts.length ? (
          <p className="muted">{emptyPhotoQueueMessage(catalogPhotoFilter)}</p>
        ) : null}
      </div>

      </div>
      ) : null}

      {adminSection === 'pedidos' ? (
      <div className="admin-section-panel admin-pedidos">
      <h3 id="admin-orders-queue" className="admin-section-heading">
        Pedidos ({filteredOrders.length}{orderJumpQ.trim() ? ` / ${orders.length}` : ''})
      </h3>
      {(() => {
        const awaiting =
          ops?.paidAwaitingOrg?.paidAwaitingCount ?? ops?.orders?.buckets?.paid ?? 0;
        const stuck = ops?.paidAwaitingOrg?.stuckCount ?? 0;
        const tone = paidQueueBannerTone({
          paidAwaitingCount: awaiting,
          stuckCount: stuck,
        });
        return (
          <div className={paidQueueBannerClass(tone)}>
            <div className="body">
              <div style={{ flex: 1, minWidth: 200 }}>
                <span className="admin-queue-banner__title">
                  {tone === 'empty' ? 'Fila Pagos' : 'Pagos aguardando organização'}
                </span>
                <div className="admin-queue-banner__meta">
                  {tone === 'empty' ? (
                    <>
                      Nenhum pedido em Pago aguardando Separar agora. Quando um PIX/cartão confirmar,
                      aparece aqui.
                    </>
                  ) : (
                    <>
                      {awaiting} pedido(s) em Pago
                      {stuck > 0
                        ? ` · ${stuck} travado(s) ≥${ops?.paidAwaitingOrg?.stuckHoursThreshold ?? PAID_STUCK_HOURS_UI}h`
                        : ` · nenhum acima de ${ops?.paidAwaitingOrg?.stuckHoursThreshold ?? PAID_STUCK_HOURS_UI}h`}
                      {ops?.paidAwaitingOrg?.oldestStuckHours != null
                        ? ` · mais antigo ~${ops.paidAwaitingOrg.oldestStuckHours}h`
                        : ''}
                    </>
                  )}
                </div>
                {ops?.paidAwaitingOrg?.stuckPublicIds?.length ? (
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                    IDs travados: {ops.paidAwaitingOrg.stuckPublicIds.join(', ')}
                  </div>
                ) : null}
              </div>
              {tone === 'empty' ? (
                <button
                  type="button"
                  className="btn ghost admin-btn-accent"
                  onClick={() => {
                    void loadOps();
                    selectOpsBucket('paid');
                  }}
                  style={{ minHeight: 44 }}
                >
                  Atualizar / ver Pagos
                </button>
              ) : (
                <button
                  type="button"
                  className="btn admin-btn-primary-accent"
                  onClick={() => selectOpsBucket('paid')}
                  style={{ minHeight: 44, minWidth: 44 }}
                >
                  Abrir fila Pagos
                </button>
              )}
            </div>
          </div>
        );
      })()}
      <p className="admin-pedidos__intro">
        Fila operacional (entrega própria): Aguardando pagamento → Pago → Organizando → Embalagem →
        Pronto para coleta → Em trânsito → Entregue. Bucket Problemas = histórico (cancelado/reembolsado)
        + legado stuck (separando/saiu). Alerta crítico do Ops conta só o legado travado.
        “Separar” = Organizando / Embalagem (sem status novo). Ao marcar Em trânsito, informe o rastreio (opcional).
        Seleção em lote: Separar agora (Pago → Organizando) e Avançar só nas transições de um clique já existentes.
        Pronto para coleta → Em trânsito continua individual (rastreio). WhatsApp é wa.me — não envia sozinho.
      </p>
      <div className="admin-pedidos__toolbar">
      <label className="admin-search-field">
        <span>
          Busca pedidos (servidor se ≥3 caracteres ou SCH-…; senão na lista carregada)
          {orderSearchBusy ? ' — buscando…' : orderServerSearchActive ? ' — busca no servidor' : ''}
        </span>
        <input
          value={orderJumpQ}
          onChange={(e) => setOrderJumpQ(e.target.value)}
          placeholder="Ex.: SCH-…, e-mail ou nome do cliente"
          aria-label="Busca de pedidos"
        />
      </label>
      <div className="admin-filter-row">
        {(
          [
            { key: 'all', label: 'Filtro ROI: todos' },
            { key: 'stuck_paid', label: 'Pagos travados (≥24h)' },
            { key: 'no_shipping', label: 'Sem frete/rastreio (pago→pronto)' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            className={`admin-filter-chip${orderRoiFilter === f.key ? ' is-active' : ''}`}
            onClick={() => {
              setOrderRoiFilter(f.key);
              if (f.key === 'stuck_paid') selectOpsBucket('paid');
            }}
          >
            {f.label}
            {f.key === 'stuck_paid' && ops?.paidAwaitingOrg?.stuckCount != null
              ? ` (${ops.paidAwaitingOrg.stuckCount})`
              : ''}
          </button>
        ))}
      </div>
      <p className="ok" style={{ fontSize: 13, margin: 0 }}>
        {POST_PAYMENT_OPS_HINT}
      </p>
      <div className="admin-filter-row">
        {ORDER_STATUS_TABS.map((tab) => {
          const active = orderStatusFilter === tab.key;
          const opsCount =
            tab.key === ''
              ? ops?.orders?.total
              : ops?.orders?.buckets?.[tab.key];
          const listCount =
            tab.key === ''
              ? orders.length
              : tab.key === 'problems'
                ? orders.length
                : orders.filter((o) => o.status === tab.key).length;
          const count = active
            ? listCount
            : opsCount != null
              ? opsCount
              : null;
          return (
            <button
              key={tab.key || 'all'}
              type="button"
              className={`admin-filter-chip${active ? ' is-active' : ''}`}
              onClick={() => selectOpsBucket(tab.key)}
            >
              {tab.label}
              {count != null ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
      <div className="admin-filter-row">
        <button
          type="button"
          className="admin-filter-chip"
          disabled={bulkBusy || !filteredOrders.length}
          onClick={() =>
            setSelectedOrderIds(
              filteredOrders.every((o) => selectedOrderIds.includes(o.id))
                ? []
                : filteredOrders.map((o) => o.id),
            )
          }
        >
          {filteredOrders.length && filteredOrders.every((o) => selectedOrderIds.includes(o.id))
            ? 'Limpar visíveis'
            : `Selecionar visíveis (${filteredOrders.length})`}
        </button>
        <button
          type="button"
          className="admin-filter-chip"
          disabled={bulkBusy || !filteredOrders.some((o) => isBulkSepararEligible(o.status))}
          onClick={() => setSelectedOrderIds(selectVisibleEligibleIds(filteredOrders, 'separar'))}
        >
          Selecionar pagos ({filteredOrders.filter((o) => isBulkSepararEligible(o.status)).length})
        </button>
        <button
          type="button"
          className="admin-filter-chip"
          disabled={bulkBusy || !filteredOrders.some((o) => isBulkAdvanceEligible(o.status))}
          onClick={() => setSelectedOrderIds(selectVisibleEligibleIds(filteredOrders, 'advance'))}
        >
          Selecionar avançáveis ({filteredOrders.filter((o) => isBulkAdvanceEligible(o.status)).length})
        </button>
      </div>
      </div>
      {selectedOrderIds.length ? (
        <div className="admin-bulk-bar" role="region" aria-label="Ações em lote">
          <span className="admin-bulk-bar__count">{selectedOrderIds.length} selecionado(s)</span>
          <span className="admin-bulk-bar__hint">
            {bulkProgress ||
              `Separar agora: ${bulkSepararEligibleCount} · Avançar (um clique): ${bulkAdvanceEligibleCount}. Falhas aparecem aqui — nada silencioso.`}
          </span>
          <button
            type="button"
            className="btn admin-btn-separar"
            disabled={bulkBusy || bulkSepararEligibleCount === 0}
            onClick={() => void runBulkFulfillment('separar')}
            title="Pago → Organizando, mesma transição do botão da linha"
          >
            {bulkBusy ? bulkProgress || 'Separando…' : `Separar agora (${bulkSepararEligibleCount})`}
          </button>
          <button
            type="button"
            className="btn admin-btn-primary-accent"
            disabled={bulkBusy || bulkAdvanceEligibleCount === 0}
            onClick={() => void runBulkFulfillment('advance')}
            title="Avança cada pedido ao próximo status de um clique (sem rastreio)"
          >
            Avançar status ({bulkAdvanceEligibleCount})
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={bulkBusy}
            onClick={() => setSelectedOrderIds([])}
            style={{ borderColor: '#ffd100', color: '#ffd100' }}
          >
            Limpar
          </button>
        </div>
      ) : null}
      <div className="admin-order-list">
      {filteredOrders.map((o) => {
        const next = nextFulfillmentStatus(o.status);
        const wa = orderWa(o, 'generic');
        const waPaid = orderWa(o, 'paid');
        const waShipped = orderWa(o, 'shipped');
        const showEarlyPaidOps =
          o.status === 'paid' || o.status === 'organizing' || o.status === 'separating';
        const canResendStorePaidNotify = isPostPaidStatus(o.status);
        const open = openOrderId === o.id;
        const phone = customerPhone(o);
        const stuck = isPaidStuckOrder(o);
        const sticky = shouldStickyOrderActions(o.status);
        const selected = selectedOrderIds.includes(o.id);
        const cardMod =
          stuck ? ' admin-order-card--stuck' : o.status === 'paid' ? ' admin-order-card--paid' : '';
        const payBadge = paymentMethodBadge(o.payments);
        const needsSepararStyle =
          o.status === 'paid' ||
          o.status === 'organizing' ||
          o.status === 'separating' ||
          stuck;
        return (
          <div key={o.id} className={`admin-order-card${cardMod}${selected ? ' is-selected' : ''}`}>
            <div className="admin-order-card__body">
              <div className="admin-order-card__top">
                <div className="admin-order-card__main">
                  <div className="admin-order-card__id-row">
                    <label className="admin-select-hit">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={bulkBusy}
                        onChange={() => setSelectedOrderIds((prev) => toggleIdInList(prev, o.id))}
                        aria-label={`Selecionar ${o.publicId}`}
                      />
                    </label>
                    <span className="admin-order-card__public-id">{o.publicId}</span>
                    <button
                      type="button"
                      className="btn ghost admin-btn-ghost-pro"
                      onClick={() => void copyOrderField('publicId', o.publicId)}
                      title="Copiar publicId"
                      aria-label={`Copiar ${o.publicId}`}
                      style={{ padding: '6px 10px', minHeight: 36, fontSize: 12 }}
                    >
                      Copiar ID
                    </button>
                    {payBadge ? (
                      <AdminStatusChip
                        label={`${payBadge.label}${payBadge.amount != null ? ` · ${brl(payBadge.amount)}` : ''}`}
                        tone={payBadge.kind === 'pix' ? 'ok' : 'info'}
                        title={payBadge.status ? `status ${payBadge.status}` : undefined}
                        className={
                          payBadge.kind === 'pix'
                            ? 'admin-chip-status--pay-pix'
                            : payBadge.kind === 'card'
                              ? 'admin-chip-status--pay-card'
                              : undefined
                        }
                      />
                    ) : null}
                    <AdminOrderStatusChip status={o.status} label={orderStatusLabel(o.status)} />
                    {o.status === 'paid' ? (
                      <AdminStatusChip
                        label={
                          stuck
                            ? `Travado ${formatStuckHours(hoursSincePaid(o))}`
                            : `Aguardando org. · ${formatStuckHours(hoursSincePaid(o))}`
                        }
                        tone={stuck ? 'danger' : 'accent'}
                      />
                    ) : null}
                  </div>
                  <div className="admin-order-card__meta">
                    {orderStatusLabel(o.status)}{' '}
                    <span style={{ opacity: 0.6 }}>({o.status})</span>
                    {next ? (
                      <span style={{ marginLeft: 6 }}>
                        → próximo: <b>{orderStatusLabel(next)}</b>
                      </span>
                    ) : null}
                  </div>
                  <div className="admin-order-card__meta">
                    {brl(o.total)} · {customerHint(o)}
                    {o.items?.length ? ` · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}` : ''}
                  </div>
                  <div className="admin-order-card__meta" style={{ fontSize: 12, marginTop: 2 }}>
                    Pagamento:{' '}
                    {o.payments?.length
                      ? o.payments.map((p) => `${p.status}${p.method ? `/${p.method}` : ''}`).join(', ')
                      : '—'}
                    {' · '}
                    Frete:{' '}
                    {o.freightSnap?.label ||
                      (o.freight != null ? brl(Number(o.freight)) : '—')}
                    {o.trackingCode ? ` · Rastreio ${o.trackingCode}` : ''}
                    {o.createdAt
                      ? ` · criado ${new Date(o.createdAt).toLocaleString('pt-BR')}`
                      : ''}
                  </div>
                </div>
                <div
                  className={`admin-order-card__actions${sticky ? ' is-sticky' : ''}`}
                >
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    onClick={() => setOpenOrderId(open ? null : o.id)}
                  >
                    {open ? 'Fechar' : 'Detalhe'}
                  </button>
                  {next ? (
                    <button
                      className={`btn${needsSepararStyle ? ' admin-btn-separar' : ''}`}
                      disabled={busyId === o.id || bulkBusy}
                      onClick={() => advance(o)}
                      title={`Avançar para ${orderStatusLabel(next)}`}
                      style={needsSepararStyle ? undefined : { minHeight: 44, minWidth: 44 }}
                    >
                      {busyId === o.id ? 'Salvando...' : advanceButtonLabel(o.status, next)}
                    </button>
                  ) : (
                    <AdminOrderStatusChip status={o.status} label={orderStatusLabel(o.status)} />
                  )}
                </div>
              </div>

              {canResendStorePaidNotify ? (
                <div className="admin-order-card__ops ok">
                  {showEarlyPaidOps ? (
                    <span>
                      Cliente pagou — próximo ops: Separar (Organizando) — não é automático.
                      {o.status === 'paid' && stuck
                        ? ` Pedido travado há ${formatStuckHours(hoursSincePaid(o))}.`
                        : ''}{' '}
                      Avisar no WhatsApp (e-mail já cobre o cliente, se mail estiver ativo).
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 13 }}>
                      Pedido já pago ({orderStatusLabel(o.status)}) — reenviar aviso de venda à loja se o e-mail não chegou.
                    </span>
                  )}
                  {showEarlyPaidOps ? (
                    <a
                      className="btn wa"
                      href={waPaid.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                      title={waPaid.toCustomer ? 'Abre wa.me com o cliente' : 'Cliente sem telefone — wa.me da loja'}
                    >
                      {whatsAppOpsButtonLabel(waPaid.toCustomer, 'paid')}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn ghost admin-btn-ghost-pro"
                    disabled={busyId === o.id || bulkBusy}
                    onClick={() => void resendStorePaidNotify(o)}
                    title="POST /admin/orders/:id/notify-paid"
                  >
                    Reenviar aviso loja
                  </button>
                </div>
              ) : null}

              <div className="admin-order-card__wa-row">
                <a
                  className="btn wa"
                  href={wa.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                  title={wa.toCustomer ? 'Abre wa.me com o cliente' : 'Cliente sem telefone — wa.me da loja'}
                >
                  {whatsAppOpsButtonLabel(wa.toCustomer, 'generic')}
                </a>
                {o.status === 'in_transit' || o.status === 'shipped' ? (
                  <a
                    className="btn wa"
                    href={waShipped.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                  >
                    {whatsAppOpsButtonLabel(waShipped.toCustomer, 'shipped')}
                  </a>
                ) : null}
              </div>
              <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                {wa.toCustomer
                  ? `Abre conversa com o cliente (${phone}).`
                  : 'Cliente sem telefone — abre o WhatsApp da loja (NEXT_PUBLIC_WHATSAPP) com rascunho interno.'}
              </p>

              {open ? (
                <div className="admin-order-card__detail">
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span>
                      <b>publicId:</b> {o.publicId}{' '}
                      <span style={{ opacity: 0.7 }}>(id {o.id})</span>
                    </span>
                    <button
                      type="button"
                      className="btn ghost admin-btn-ghost-pro"
                      onClick={() => void copyOrderField('publicId', o.publicId)}
                      style={{ padding: '6px 10px', minHeight: 36, fontSize: 12 }}
                    >
                      Copiar ID
                    </button>
                  </div>
                  <div><b>Cliente:</b> {o.user?.name || '—'}</div>
                  <div><b>E-mail:</b> {o.user?.email || '—'}</div>
                  <div><b>WhatsApp:</b> {phone || 'não cadastrado'}</div>
                  {o.addressSnap?.city ? (
                    <div>
                      <b>Entrega:</b>{' '}
                      {o.addressSnap.label ? `${o.addressSnap.label} · ` : ''}
                      {o.addressSnap.city}/{o.addressSnap.uf}
                    </div>
                  ) : null}
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span>
                      <b>Rastreio:</b>{' '}
                      {o.trackingCode || '—'}
                      {o.carrier ? ` · ${o.carrier}` : ''}
                    </span>
                    {o.trackingCode?.trim() ? (
                      <button
                        type="button"
                        className="btn ghost admin-btn-ghost-pro"
                        onClick={() => void copyOrderField('tracking', o.trackingCode || '')}
                        style={{ padding: '6px 10px', minHeight: 36, fontSize: 12 }}
                      >
                        Copiar rastreio
                      </button>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Pagamento(s):</b>
                    {o.payments?.length ? (
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {o.payments.map((pay) => (
                          <li key={pay.id}>
                            {pay.status}
                            {pay.method ? ` · ${pay.method}` : ''}
                            {pay.provider ? ` · ${pay.provider}` : ''}
                            {pay.externalId ? ` · ext ${pay.externalId}` : ''}
                            {pay.amount != null ? ` · ${brl(Number(pay.amount))}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span> — (nenhum registro na API)</span>
                    )}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Frete / envio:</b>{' '}
                    {o.freightSnap?.label || '—'}
                    {o.freight != null ? ` · ${brl(Number(o.freight))}` : ''}
                    {o.freightSnap?.estimatedDays != null
                      ? ` · ~${o.freightSnap.estimatedDays} dia(s)`
                      : ''}
                    {o.carrier ? ` · carrier ${o.carrier}` : ''}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Histórico:</b>
                    {o.statusHistory?.length ? (
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {o.statusHistory.map((h) => (
                          <li key={h.id}>
                            {h.fromStatus ? `${h.fromStatus} → ` : ''}
                            {h.toStatus}
                            {' · '}
                            {new Date(h.createdAt).toLocaleString('pt-BR')}
                            {h.note ? ` · ${h.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span>
                        {' '}
                        — (sem histórico; criado{' '}
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleString('pt-BR')
                          : '—'}
                        )
                      </span>
                    )}
                  </div>
                  {o.status === 'paid' ? (
                    <div style={{ marginTop: 8, color: stuck ? 'var(--admin-danger)' : undefined }}>
                      <b>Tempo em pago:</b>{' '}
                      {formatStuckHours(hoursSincePaid(o))}
                      {stuck
                        ? ` — acima de ${PAID_STUCK_HOURS_UI}h (travado)`
                        : ` (limite alerta ${PAID_STUCK_HOURS_UI}h)`}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {!filteredOrders.length ? (
        <p className="muted">
          {emptyOrdersQueueMessage({
            hasSearch: Boolean(orderJumpQ.trim()),
            roiFilter: orderRoiFilter,
            statusFilter: orderStatusFilter,
            paidBucketLabel: orderStatusFilter
              ? adminQueueBucketLabel(orderStatusFilter)
              : undefined,
          })}
        </p>
      ) : null}
      </div>
      </div>
      ) : null}

    </AdminShell>
  );
}
