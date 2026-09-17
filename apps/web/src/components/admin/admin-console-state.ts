'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api, apiUpload, brl, clearSession, currentUser, isUnauthorizedError } from '@/lib/api';
import {
  nextFulfillmentStatus,
  orderStatusLabel,
  adminQueueBucketLabel,
  POST_PAYMENT_OPS_HINT,
  isPostPaidStatus,
} from '@/lib/order-status';
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
} from '@/lib/admin-ops-ui';
import {
  type AdminSectionId,
  adminEntrarHref,
  adminLoginNextPath,
  buildAdminCatalogoPhotosHref,
  buildAdminSectionHref,
  legacyAdminRedirect,
  photosQueueFromSearch,
  sectionFromPathname,
} from '@/lib/admin-sections';
import {
  type BulkAdvanceResult,
  type CatalogPhotoFilter,
  bulkConfirmMessage,
  bulkProgressLabel,
  catalogPhotoQueueCount,
  filterCatalogProducts,
  formatBulkAdvanceFeedback,
  isBulkAdvanceEligible,
  isBulkSepararEligible,
  listPhotoUploadSuccessMessage,
  nextOneClickFulfillmentStatus,
  orderedIdsWithNewCover,
  productCoverUrl,
  partitionBulkAdvance,
  partitionBulkSeparar,
  pruneSelectedIds,
  selectVisibleEligibleIds,
  shouldPromoteUploadedImageToCover,
  toggleIdInList,
  validateProductPhotoFile,
} from '@/lib/admin-daily-ops';
import {
  buildSalesReportCsv,
  salesCsvWithBom,
  salesExportFilename,
} from '@/lib/admin-sales-ui';
import {
  buildAdminCustomerHref,
  buildAdminPedidoHref,
  customerIdFromSearch,
  isAdminRecordId,
  orderIdFromSearch,
} from '@/lib/admin-customers-ui';
import {
  DEFAULT_LOW_STOCK,
  MAX_PRODUCT_IMAGES,
  ORDER_STATUS_TABS,
  addDaysYmd,
  emptyAdminUserForm,
  emptyBannerForm,
  emptyCepRuleForm,
  emptyCouponForm,
  emptyForm,
  hoursSincePaid,
  isPaidStuckOrder,
  orderWa,
  saoPauloYmd,
  type AdminBanner,
  type AdminCommission,
  type AdminCoupon,
  type AdminCustomerDetail,
  type AdminCustomerListItem,
  type AdminOpsAlert,
  type AdminOpsSnapshot,
  type AdminOrder,
  type AdminPaymentReconciliationItem,
  type AdminProduct,
  type AdminReview,
  type AdminSeller,
  type AdminUser,
  type AdminUserForm,
  type BannerForm,
  type Category,
  type CepRuleForm,
  type CouponForm,
  type FormImage,
  type ProductForm,
  type SalesReport,
  type ShippingConfig,
  type ShippingCepRule,
  type ShippingSettings,
  type ShippingSettingsForm,
  type StoreSeoSettings,
} from './admin-console-model';

function adminUnauthorizedRedirect() {
  if (typeof window === 'undefined') return;
  clearSession();
  window.location.href = adminEntrarHref(
    adminLoginNextPath(window.location.pathname, window.location.search),
  );
}

export function useAdminConsoleState() {
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
  const [salesExportBusy, setSalesExportBusy] = useState(false);
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
  const deepCustomerRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname() || '/admin';
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const adminSection = sectionFromPathname(pathname);

  const goAdminSection = useCallback((next: AdminSectionId) => {
    if (next !== 'clientes') setCustomerDetail(null);
    router.push(buildAdminSectionHref(next));
  }, [router]);

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
          adminUnauthorizedRedirect();
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
        adminUnauthorizedRedirect();
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
        adminUnauthorizedRedirect();
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
    router.push(buildAdminSectionHref('pedidos'));
    requestAnimationFrame(() => {
      const el = document.getElementById('admin-orders-queue');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [router]);

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
        adminUnauthorizedRedirect();
        return;
      }
      console.warn('admin reconciliations', e?.message || e);
    } finally {
      setReconBusy(false);
    }
  }, []);

  const openCatalogPhotoQueue = useCallback(() => {
    setCatalogPhotoFilter('needs_photo');
    router.push(buildAdminCatalogoPhotosHref());
    requestAnimationFrame(() => {
      const el = document.getElementById('admin-photo-queue');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [router]);

  /** Deep-link alert → section or order queue (review only). */
  const selectOpsAlert = useCallback(
    (a: AdminOpsAlert) => {
      if (a.section === 'reconciliations') {
        router.push(buildAdminSectionHref('ops'));
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
    [loadReconciliations, selectOpsBucket, openCatalogPhotoQueue, router],
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
        adminUnauthorizedRedirect();
        return;
      }
      setErr(e.message || 'Falha ao baixar CSV de fotos');
    }
  }

  const openCustomer = useCallback(async (id: string) => {
    if (!isAdminRecordId(id)) return;
    deepCustomerRef.current = id;
    const href = buildAdminCustomerHref(id);
    if (typeof window !== 'undefined') {
      const here = `${window.location.pathname}${window.location.search}`;
      if (here !== href) router.push(href);
    }
    setCustomerDetailBusy(true);
    setErr('');
    try {
      const data = await api<AdminCustomerDetail>(`/admin/customers/${id}`);
      setCustomerDetail(data);
      requestAnimationFrame(() => {
        document.getElementById('admin-customer-detail')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        adminUnauthorizedRedirect();
        return;
      }
      setErr(e.message || 'Falha ao abrir cliente');
    } finally {
      setCustomerDetailBusy(false);
    }
  }, [router]);

  const closeCustomer = useCallback(() => {
    deepCustomerRef.current = null;
    setCustomerDetail(null);
    router.push(buildAdminSectionHref('clientes'));
  }, [router]);

  const openPedidoFromCustomer = useCallback((orderId: string) => {
    if (!isAdminRecordId(orderId)) return;
    setOpenOrderId(orderId);
    router.push(buildAdminPedidoHref(orderId));
    requestAnimationFrame(() => {
      document.getElementById('admin-orders-queue')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [router]);


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
        adminUnauthorizedRedirect();
        return;
      }
      setErr(e.message || 'Falha ao carregar relatório de vendas');
    } finally {
      setSalesBusy(false);
    }
  }, [salesFrom, salesTo]);

  function exportSalesCsv() {
    if (!salesReport) {
      setErr('Carregue o relatório antes de exportar.');
      return;
    }
    setSalesExportBusy(true);
    setErr('');
    setMsg('');
    try {
      const csv = buildSalesReportCsv(salesReport, orderStatusLabel);
      const blob = new Blob([salesCsvWithBom(csv)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = salesExportFilename(salesReport.from, salesReport.to);
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`CSV de vendas exportado (${salesReport.from} a ${salesReport.to}).`);
    } catch (e: any) {
      setErr(e.message || 'Falha ao exportar CSV de vendas');
    } finally {
      setSalesExportBusy(false);
    }
  }

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

  /** Legacy hash + path+search deep-links (customer=, order=, photos=). */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const to = legacyAdminRedirect({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });
    if (to) {
      router.replace(to);
      return;
    }
    const cid = customerIdFromSearch(searchString ? `?${searchString}` : window.location.search);
    if (cid) {
      if (deepCustomerRef.current !== cid) void openCustomer(cid);
    } else {
      deepCustomerRef.current = null;
    }
    const oid = orderIdFromSearch(searchString ? `?${searchString}` : window.location.search);
    if (oid) setOpenOrderId(oid);
    if (photosQueueFromSearch(searchString ? `?${searchString}` : window.location.search)) {
      setCatalogPhotoFilter('needs_photo');
      requestAnimationFrame(() => {
        document.getElementById('admin-photo-queue')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  }, [openCustomer, router, pathname, searchString]);

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
              adminUnauthorizedRedirect();
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
            adminUnauthorizedRedirect();
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
    router.push(buildAdminSectionHref('catalogo'));
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


  return {
    products,
    setProducts,
    orders,
    setOrders,
    categories,
    setCategories,
    err,
    setErr,
    msg,
    setMsg,
    busyId,
    setBusyId,
    saving,
    setSaving,
    uploading,
    setUploading,
    editingId,
    setEditingId,
    form,
    setForm,
    formImages,
    setFormImages,
    orderStatusFilter,
    setOrderStatusFilter,
    lowStockThreshold,
    setLowStockThreshold,
    coupons,
    setCoupons,
    couponForm,
    setCouponForm,
    savingCoupon,
    setSavingCoupon,
    shippingSettings,
    setShippingSettings,
    shippingRules,
    setShippingRules,
    shippingForm,
    setShippingForm,
    cepRuleForm,
    setCepRuleForm,
    savingShipping,
    setSavingShipping,
    savingCepRule,
    setSavingCepRule,
    salesReport,
    setSalesReport,
    salesFrom,
    setSalesFrom,
    salesTo,
    setSalesTo,
    salesBusy,
    setSalesBusy,
    salesExportBusy,
    setSalesExportBusy,
    reviews,
    setReviews,
    reviewBusyId,
    setReviewBusyId,
    openOrderId,
    setOpenOrderId,
    seoForm,
    setSeoForm,
    savingSeo,
    setSavingSeo,
    banners,
    setBanners,
    bannerForm,
    setBannerForm,
    editingBannerId,
    setEditingBannerId,
    savingBanner,
    setSavingBanner,
    uploadingBanner,
    setUploadingBanner,
    bannerBusyId,
    setBannerBusyId,
    admins,
    setAdmins,
    adminForm,
    setAdminForm,
    savingAdmin,
    setSavingAdmin,
    adminBusyId,
    setAdminBusyId,
    sellers,
    setSellers,
    commissions,
    setCommissions,
    commissionStatusFilter,
    setCommissionStatusFilter,
    commissionSellerFilter,
    setCommissionSellerFilter,
    commissionBusyId,
    setCommissionBusyId,
    payoutDraft,
    setPayoutDraft,
    ownerDraft,
    setOwnerDraft,
    ownerBusyId,
    setOwnerBusyId,
    sellerForm,
    setSellerForm,
    savingSeller,
    setSavingSeller,
    sellerBusyId,
    setSellerBusyId,
    customers,
    setCustomers,
    customersTotal,
    setCustomersTotal,
    customerQ,
    setCustomerQ,
    customerBusy,
    setCustomerBusy,
    customerDetail,
    setCustomerDetail,
    customerDetailBusy,
    setCustomerDetailBusy,
    ops,
    setOps,
    opsBusy,
    setOpsBusy,
    reconciliations,
    setReconciliations,
    reconBusy,
    setReconBusy,
    orderJumpQ,
    setOrderJumpQ,
    orderSearchBusy,
    setOrderSearchBusy,
    orderServerSearchActive,
    setOrderServerSearchActive,
    orderServerSearchRef,
    orderRoiFilter,
    setOrderRoiFilter,
    selectedOrderIds,
    setSelectedOrderIds,
    bulkBusy,
    setBulkBusy,
    bulkProgress,
    setBulkProgress,
    catalogPhotoFilter,
    setCatalogPhotoFilter,
    listPhotoBusyId,
    setListPhotoBusyId,
    listPhotoInputRef,
    listPhotoProductIdRef,
    adminSection,
    goAdminSection,
    load,
    loadCustomers,
    loadOps,
    selectOpsBucket,
    loadReconciliations,
    openCatalogPhotoQueue,
    selectOpsAlert,
    downloadProductsNeedingPhotosCsv,
    openCustomer,
    closeCustomer,
    openPedidoFromCustomer,
    loadSalesReport,
    exportSalesCsv,
    editingLabel,
    lowStockProducts,
    filteredOrders,
    selectedVisibleOrders,
    bulkSepararEligibleCount,
    bulkAdvanceEligibleCount,
    photoQueueCount,
    visibleCatalogProducts,
    attentionAlerts,
    mapProductImages,
    syncCoverUrl,
    startEdit,
    startEditById,
    resetForm,
    persistNewImages,
    uploadOnePhoto,
    uploadPhoto,
    uploadPhotos,
    removeFormImage,
    moveFormImage,
    setCoverImage,
    saveProduct,
    saveCoupon,
    toggleCoupon,
    saveShippingSettings,
    saveCepRule,
    toggleCepRule,
    removeCepRule,
    setReviewStatus,
    deleteReview,
    advance,
    runBulkFulfillment,
    pickListPhoto,
    uploadListCoverPhoto,
    resendStorePaidNotify,
    copyOrderField,
    saveSeller,
    setSellerStatus,
    setSellerOwner,
    approveCommission,
    markCommissionPaid,
    exportCommissionsCsv,
    saveSeo,
    uploadBannerPhoto,
    startEditBanner,
    resetBannerForm,
    saveBanner,
    toggleBannerActive,
    deleteBanner,
    moveBanner,
    saveAdmin,
    toggleAdminStatus,
    shellBadges
  };
}
