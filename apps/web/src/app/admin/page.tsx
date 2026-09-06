'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiUpload, brl, clearSession, currentUser, isUnauthorizedError } from '@/lib/api';
import { nextFulfillmentStatus, orderStatusLabel } from '@/lib/order-status';
import { resolveOrderWhatsApp } from '@/lib/whatsapp';

type AdminOrder = {
  id: string;
  publicId: string;
  status: string;
  total: number;
  trackingCode?: string | null;
  carrier?: string | null;
  items?: { name: string; qty: number }[];
  user?: { id: string; name: string; email: string; phone?: string | null } | null;
  addressSnap?: { city?: string; uf?: string; label?: string; phone?: string | null } | null;
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
  images?: { url: string }[];
  sellerId?: string | null;
  seller?: { id: string; name: string; slug: string; status?: string } | null;
};

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

const ORDER_STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'awaiting_payment', label: 'Aguardando pagamento' },
  { key: 'paid', label: 'Pago' },
  { key: 'organizing', label: 'Organizando' },
  { key: 'packing', label: 'Em embalagem' },
  { key: 'ready_for_pickup', label: 'Pronto para coleta' },
  { key: 'in_transit', label: 'Em trânsito' },
  { key: 'delivered', label: 'Entregue' },
  { key: 'cancelled', label: 'Cancelado' },
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
  const [sellerForm, setSellerForm] = useState({ name: '', slug: '', status: 'pending' as 'pending' | 'active' | 'suspended' });
  const [savingSeller, setSavingSeller] = useState(false);
  const [sellerBusyId, setSellerBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    const u = currentUser();
    if (!u || u.role !== 'admin') {
      setErr('Acesso restrito a admin. Entre com a conta administrativa.');
      return Promise.resolve();
    }
    const ordersPath = orderStatusFilter
      ? `/admin/orders?status=${encodeURIComponent(orderStatusFilter)}`
      : '/admin/orders';
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
    ])
      .then(([p, o, c, couponsList, shipping, reviewsList, seo, bannersList, adminsList, sellersList]) => {
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
  }, [orderStatusFilter]);


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

  const editingLabel = useMemo(
    () => (editingId ? 'Editar produto' : 'Cadastrar produto'),
    [editingId],
  );

  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => (p.inventory?.qtyOnHand ?? 0) <= lowStockThreshold)
      .sort((a, b) => (a.inventory?.qtyOnHand ?? 0) - (b.inventory?.qtyOnHand ?? 0));
  }, [products, lowStockThreshold]);

  function startEdit(p: AdminProduct) {
    setEditingId(p.id);
    setMsg('');
    setErr('');
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
      imageUrl: p.images?.[0]?.url || '',
      badge: p.badge || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setMsg('');
  }

  async function uploadPhoto(file: File | null) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErr('Use uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErr('A foto deve ter no máximo 15 MB.');
      return;
    }
    setUploading(true);
    setErr('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiUpload<{ url: string }>('/admin/uploads', fd);
      setForm((f) => ({ ...f, imageUrl: data.url }));
      setMsg('Foto enviada. Salve o produto para publicar.');
    } catch (e: any) {
      setErr(e.message || 'Falha ao enviar foto');
    } finally {
      setUploading(false);
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
      imageUrl: form.imageUrl.trim() || null,
    };
    if (form.sku.trim()) body.sku = form.sku.trim();

    try {
      if (editingId) {
        await api(`/admin/products/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setMsg('Produto atualizado.');
      } else {
        await api('/admin/products', {
          method: 'POST',
          body: JSON.stringify(body),
        });
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
    try {
      await api(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await load();
    } catch (e: any) {
      setErr(e.message || 'Falha ao atualizar status');
    } finally {
      setBusyId(null);
    }
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


  return (
    <div style={{ padding: '24px 0' }}>
      <h1>Admin Schimitz</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Cadastre produtos, ajuste estoque e avance a entrega dos pedidos. Sem termos técnicos.
      </p>
      {err ? <div className="alert">{err}</div> : null}
      {msg ? <div className="ok">{msg}</div> : null}




      <section className="card" style={{ marginTop: 16, marginBottom: 28 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Administradores</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Crie contas extras para a equipe. Todas têm o mesmo acesso ao painel. Desativar impede o login
            (não apaga o cadastro). Você não pode desativar a si mesmo nem o último admin ativo.
          </p>
          <form className="form" style={{ maxWidth: 560, marginBottom: 20 }} onSubmit={saveAdmin}>
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
            <button className="btn" type="submit" disabled={savingAdmin}>
              {savingAdmin ? 'Salvando...' : 'Criar administrador'}
            </button>
          </form>
          <div style={{ display: 'grid', gap: 8 }}>
            {admins.map((a) => {
              const me = currentUser();
              const isMe = me?.id === a.id;
              const active = a.status === 'active';
              return (
                <div
                  key={a.id}
                  className="row"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    flexWrap: 'wrap',
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <b>{a.name}</b>{' '}
                    {isMe ? <span className="badge">Você</span> : null}
                    {!active ? <span className="badge">Desativado</span> : null}
                    <div className="muted" style={{ fontSize: 13 }}>
                      {a.email}
                      {' · '}
                      desde {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={adminBusyId === a.id || (isMe && active)}
                    onClick={() => void toggleAdminStatus(a)}
                    title={isMe && active ? 'Você não pode desativar a si mesmo' : undefined}
                  >
                    {adminBusyId === a.id ? '...' : active ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              );
            })}
            {!admins.length ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Nenhum administrador listado.
              </p>
            ) : null}
          </div>
        </div>
      </section>


      <section className="card" style={{ marginTop: 16, marginBottom: 28 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Vendedores (Marketplace v1)</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Fundação multi-seller. Checkout único continua igual. Comissão % é stub — payouts em v2
            (ver docs/MARKETPLACE.md). Produtos existentes ficam na Lojas Schimitz.
          </p>
          <form className="form" style={{ maxWidth: 560, marginBottom: 20 }} onSubmit={saveSeller}>
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
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </select>
            </label>
            <button className="btn" type="submit" disabled={savingSeller}>
              {savingSeller ? 'Salvando...' : 'Criar vendedor'}
            </button>
          </form>
          <div style={{ display: 'grid', gap: 8 }}>
            {sellers.map((s) => (
              <div
                key={s.id}
                className="row"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b>{s.name}</b>{' '}
                  <span className="badge">{s.status}</span>
                  <div className="muted" style={{ fontSize: 13 }}>
                    /{s.slug}
                    {s._count?.products != null ? ` · ${s._count.products} produto(s)` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.status !== 'active' ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={sellerBusyId === s.id}
                      onClick={() => void setSellerStatus(s, 'active')}
                    >
                      Ativar
                    </button>
                  ) : null}
                  {s.status !== 'suspended' ? (
                    <button
                      type="button"
                      className="btn ghost"
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
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Nenhum vendedor ainda (rode a migration SCH-008).
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16, marginBottom: 28 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>SEO da loja</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Título e descrição usados nas abas do navegador e no compartilhamento (Open Graph).
          </p>
          <form className="form" style={{ maxWidth: 560 }} onSubmit={saveSeo}>
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
            <button className="btn" type="submit" disabled={savingSeo}>
              {savingSeo ? 'Salvando...' : 'Salvar SEO'}
            </button>
          </form>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 28 }}>
        <div className="body">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              {editingBannerId ? 'Editar banner' : 'Banners da home'}
            </h2>
            {editingBannerId ? (
              <button type="button" className="btn ghost" onClick={resetBannerForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Imagem + link opcional. Só banners ativos aparecem na vitrine (carrossel).
          </p>
          <form className="form" style={{ maxWidth: 560, marginBottom: 20 }} onSubmit={saveBanner}>
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
                <label className="btn ghost" style={{ cursor: uploadingBanner ? 'wait' : 'pointer', margin: 0 }}>
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
                    style={{
                      width: 120,
                      height: 48,
                      objectFit: 'cover',
                      borderRadius: 8,
                      background: '#111',
                    }}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
              <input
                type="checkbox"
                checked={bannerForm.active}
                onChange={(e) => setBannerForm({ ...bannerForm, active: e.target.checked })}
              />
              Banner ativo (aparece na home)
            </label>
            <button className="btn" type="submit" disabled={savingBanner}>
              {savingBanner ? 'Salvando...' : editingBannerId ? 'Salvar banner' : 'Criar banner'}
            </button>
          </form>

          <div style={{ display: 'grid', gap: 10 }}>
            {banners.map((b, i) => (
              <div
                key={b.id}
                className="row"
                style={{
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  opacity: b.active ? 1 : 0.65,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.imageUrl}
                  alt={b.alt || b.title || 'Banner'}
                  style={{ width: 96, height: 40, objectFit: 'cover', borderRadius: 6 }}
                />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 600 }}>{b.title || '(sem título)'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {b.active ? 'Ativo' : 'Inativo'} · ordem {i + 1}
                    {b.linkUrl ? ` · ${b.linkUrl}` : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={bannerBusyId === b.id || i === 0}
                    onClick={() => void moveBanner(b, -1)}
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={bannerBusyId === b.id || i === banners.length - 1}
                    onClick={() => void moveBanner(b, 1)}
                    title="Descer"
                  >
                    ↓
                  </button>
                  <button type="button" className="btn ghost" onClick={() => startEditBanner(b)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={bannerBusyId === b.id}
                    onClick={() => void toggleBannerActive(b)}
                  >
                    {b.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={bannerBusyId === b.id}
                    onClick={() => void deleteBanner(b)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {!banners.length ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Nenhum banner ainda. Crie o primeiro acima.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16, marginBottom: 28 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Relatório de vendas</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Pedidos pagos no período (pago, separando, saiu para entrega, entregue). Horário de Brasília.
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Hoje', from: saoPauloYmd(), to: saoPauloYmd() },
              { label: '7 dias', from: addDaysYmd(saoPauloYmd(), -6), to: saoPauloYmd() },
              { label: '30 dias', from: addDaysYmd(saoPauloYmd(), -29), to: saoPauloYmd() },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={
                  salesFrom === preset.from && salesTo === preset.to ? 'btn' : 'btn ghost'
                }
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
            className="row"
            style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              void loadSalesReport(salesFrom, salesTo);
            }}
          >
            <label style={{ margin: 0 }}>
              De
              <input
                type="date"
                value={salesFrom}
                onChange={(e) => setSalesFrom(e.target.value)}
                required
              />
            </label>
            <label style={{ margin: 0 }}>
              Até
              <input
                type="date"
                value={salesTo}
                onChange={(e) => setSalesTo(e.target.value)}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={salesBusy}>
              {salesBusy ? 'Carregando...' : 'Atualizar'}
            </button>
          </form>
          {salesReport ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                  <div className="muted" style={{ fontSize: 13 }}>Pedidos pagos</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{salesReport.summary.orderCount}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                  <div className="muted" style={{ fontSize: 13 }}>Receita</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{brl(salesReport.summary.revenue)}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                  <div className="muted" style={{ fontSize: 13 }}>Ticket médio</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{brl(salesReport.summary.averageTicket)}</div>
                </div>
              </div>
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Por status</h3>
                  {Object.keys(salesReport.byStatus).length ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {Object.entries(salesReport.byStatus)
                        .sort((a, b) => b[1] - a[1])
                        .map(([st, count]) => (
                          <div key={st} className="row" style={{ fontSize: 14 }}>
                            <span>{orderStatusLabel(st)}</span>
                            <b>{count}</b>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nenhum pedido no período.</p>
                  )}
                </div>
                <div style={{ flex: 1.4, minWidth: 220 }}>
                  <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Mais vendidos</h3>
                  {salesReport.topProducts.length ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {salesReport.topProducts.map((tp) => (
                        <div key={tp.productId} className="row" style={{ fontSize: 14, flexWrap: 'wrap' }}>
                          <span style={{ flex: 1, minWidth: 120 }}>{tp.name}</span>
                          <span className="muted">{tp.qty} un.</span>
                          <b>{brl(tp.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Sem vendas pagas no período.</p>
                  )}
                </div>
              </div>
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
                <div style={{ flex: 1.2, minWidth: 220 }}>
                  <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Por dia</h3>
                  {(salesReport.byDay?.length ?? 0) ? (
                    <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflow: 'auto' }}>
                      {salesReport.byDay!.map((d) => (
                        <div key={d.date} className="row" style={{ fontSize: 14, flexWrap: 'wrap' }}>
                          <span style={{ flex: 1, minWidth: 100 }}>
                            {new Date(`${d.date}T12:00:00-03:00`).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="muted">{d.orderCount} ped.</span>
                          <b>{brl(d.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Sem vendas pagas no período.</p>
                  )}
                </div>
                <div style={{ flex: 1.2, minWidth: 220 }}>
                  <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>Por vendedor</h3>
                  {(salesReport.bySeller?.length ?? 0) ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {salesReport.bySeller!.map((s) => (
                        <div
                          key={s.sellerId ?? 'loja'}
                          className="row"
                          style={{ fontSize: 14, flexWrap: 'wrap' }}
                        >
                          <span style={{ flex: 1, minWidth: 120 }}>
                            {s.sellerName}
                            {!s.sellerId ? (
                              <span className="badge" style={{ marginLeft: 6 }}>
                                própria
                              </span>
                            ) : null}
                          </span>
                          <span className="muted">{s.itemQty} un. · {s.orderCount} ped.</span>
                          <b>{brl(s.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      Sem itens de vendas pagas (marketplace) no período.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : salesBusy ? (
            <p className="muted">Carregando relatório…</p>
          ) : null}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16, marginBottom: 28 }}>
        <div className="body">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{editingLabel}</h2>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>
          <form className="form" style={{ maxWidth: 560 }} onSubmit={saveProduct}>
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
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Foto do produto</div>
              <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label className="btn ghost" style={{ cursor: uploading ? 'wait' : 'pointer', margin: 0 }}>
                  {uploading ? 'Enviando...' : 'Enviar foto'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading || saving}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      void uploadPhoto(f);
                    }}
                  />
                </label>
                {form.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.imageUrl}
                    alt="Prévia"
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: 'cover',
                      borderRadius: 8,
                      background: '#111',
                    }}
                  />
                ) : null}
              </div>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                JPG, PNG ou WebP · até 15 MB. Você também pode colar um link abaixo.
              </p>
            </div>
            <label>
              URL da imagem (opcional)
              <input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://... ou envie uma foto acima"
              />
            </label>
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
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </form>
        </div>
      </section>

      
      <section className="card" style={{ marginBottom: 28 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Cupons de desconto</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Crie códigos de desconto (% ou valor fixo). O cliente aplica no checkout. Use cupons ativos
            para campanhas (ex.: BEMVINDO10) mesmo sem banner na home.
          </p>
          <div
            className="row"
            style={{
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span className="badge">
              {coupons.filter((c) => c.active).length} ativo(s)
            </span>
            <span className="badge">
              {coupons.filter((c) => !c.active).length} inativo(s)
            </span>
            <span className="badge">
              {coupons.reduce((s, c) => s + (c.usedCount || 0), 0)} uso(s) total
            </span>
            <span className="badge">
              {coupons.reduce((s, c) => s + (c.reservedCount || 0), 0)} reservado(s)
            </span>
          </div>
          <form className="form" style={{ maxWidth: 560, marginBottom: 20 }} onSubmit={saveCoupon}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
              <input
                type="checkbox"
                checked={couponForm.active}
                onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })}
              />
              Cupom ativo
            </label>
            <button className="btn" type="submit" disabled={savingCoupon}>
              {savingCoupon ? 'Salvando...' : 'Criar cupom'}
            </button>
          </form>
          <div style={{ display: 'grid', gap: 8 }}>
            {coupons.map((c) => {
              const expired = c.endsAt ? new Date(c.endsAt).getTime() < Date.now() : false;
              const exhausted = c.maxUses != null && c.usedCount >= c.maxUses;
              return (
              <div key={c.id} className="row" style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: c.active ? '1px solid var(--gold, #D4AF37)' : '1px solid var(--line)', flexWrap: 'wrap', opacity: c.active ? 1 : 0.75 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <b style={{ fontSize: 16, letterSpacing: 0.4 }}>{c.code}</b>
                    <span className="badge">{c.type === 'percent' ? `${c.value}%` : brl(c.value)}</span>
                    {c.active ? <span className="badge">Ativo</span> : <span className="badge">Inativo</span>}
                    {expired ? <span className="badge">Expirado</span> : null}
                    {exhausted ? <span className="badge">Esgotado</span> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {c.minSubtotal != null ? `Mín. ${brl(c.minSubtotal)} · ` : ''}
                    {c.endsAt ? `válido até ${new Date(c.endsAt).toLocaleDateString('pt-BR')} · ` : 'sem validade · '}
                    usos {c.usedCount}{c.maxUses != null ? `/${c.maxUses}` : ''}
                    {c.reservedCount ? ` · ${c.reservedCount} em pedidos abertos` : ''}
                  </div>
                </div>
                <button type="button" className="btn ghost" onClick={() => toggleCoupon(c)}>
                  {c.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
              );
            })}
            {!coupons.length ? (
              <p className="muted" style={{ margin: 0 }}>
                Nenhum cupom ainda. Crie o primeiro acima — ele aparece no checkout mesmo sem banner.
              </p>
            ) : null}
          </div>
        </div>
      </section>



      <section className="card" style={{ marginBottom: 28 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Avaliações</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Publicadas automaticamente. Você pode ocultar ou excluir se precisar.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {reviews.map((r) => (
              <div
                key={r.id}
                className="row"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div>
                    <b>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b>{' '}
                    {r.status === 'hidden' ? <span className="badge">Oculta</span> : <span className="badge">Publicada</span>}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <b>{r.user?.name || '—'}</b>{' '}
                    <span className="muted" style={{ fontSize: 13 }}>({r.user.email})</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Produto:{' '}
                    <Link href={`/produto/${r.product.slug}`}>{r.product.name}</Link>
                    {' · '}
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  {r.body ? <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{r.body}</p> : (
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Sem comentário</p>
                  )}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {r.status === 'published' ? (
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={reviewBusyId === r.id}
                      onClick={() => setReviewStatus(r, 'hidden')}
                    >
                      Ocultar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={reviewBusyId === r.id}
                      onClick={() => setReviewStatus(r, 'published')}
                    >
                      Publicar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={reviewBusyId === r.id}
                    onClick={() => deleteReview(r)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {!reviews.length ? <p className="muted">Nenhuma avaliação ainda.</p> : null}
          </div>
        </div>
      </section>


      <section className="card" style={{ marginBottom: 28 }}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Frete — entrega própria</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            Sem Melhor Envio/Correios. Defina frete grátis, taxa padrão e zonas por prefixo de CEP
            (ex.: 890 = região; 89010 = mais específico). O prefixo mais longo vence.
          </p>
          <form onSubmit={saveShippingSettings} style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
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
            <button className="btn" type="submit" disabled={savingShipping}>
              {savingShipping ? 'Salvando...' : 'Salvar configuração de frete'}
            </button>
            {shippingSettings ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Atual: grátis ≥ {brl(shippingSettings.freeAbove)} · padrão {brl(shippingSettings.defaultFee)} ·{' '}
                {shippingSettings.defaultDays} dias
              </p>
            ) : null}
          </form>

          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Zonas por CEP</h3>
          <form onSubmit={saveCepRule} style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
              <input
                type="checkbox"
                checked={cepRuleForm.active}
                onChange={(e) => setCepRuleForm({ ...cepRuleForm, active: e.target.checked })}
              />
              Zona ativa
            </label>
            <button className="btn" type="submit" disabled={savingCepRule}>
              {savingCepRule ? 'Salvando...' : 'Adicionar zona'}
            </button>
          </form>
          <div style={{ display: 'grid', gap: 8 }}>
            {shippingRules.map((r) => (
              <div
                key={r.id}
                className="row"
                style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)', flexWrap: 'wrap' }}
              >
                <div style={{ flex: 1, minWidth: 160 }}>
                  <b>CEP {r.cepPrefix}…</b>{' '}
                  {!r.active ? <span className="badge">Inativa</span> : null}
                  <div className="muted" style={{ fontSize: 13 }}>
                    {brl(r.fee)} · {r.estimatedDays} dia{r.estimatedDays === 1 ? '' : 's'}
                    {r.label ? ` · ${r.label}` : ''}
                  </div>
                </div>
                <button type="button" className="btn ghost" onClick={() => toggleCepRule(r)}>
                  {r.active ? 'Desativar' : 'Ativar'}
                </button>
                <button type="button" className="btn ghost" onClick={() => removeCepRule(r)}>
                  Remover
                </button>
              </div>
            ))}
            {!shippingRules.length ? (
              <p className="muted">Nenhuma zona ainda. Sem zonas, vale a taxa padrão para todos os CEPs.</p>
            ) : null}
          </div>
        </div>
      </section>

<section className="card" style={{ marginBottom: 28, borderColor: lowStockProducts.length ? 'var(--danger)' : undefined }}>
        <div className="body">
          <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              Estoque baixo{' '}
              <span className="badge" style={{ marginBottom: 0, background: lowStockProducts.length ? '#3a1515' : undefined, color: lowStockProducts.length ? '#ffb4b4' : undefined }}>
                {lowStockProducts.length}
              </span>
            </h2>
            <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0, color: 'var(--text)' }}>
              Limite ≤
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setLowStockThreshold(Number.isNaN(n) || n < 0 ? DEFAULT_LOW_STOCK : n);
                }}
                style={{ width: 72 }}
              />
            </label>
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Produtos com estoque em mãos igual ou abaixo do limite. Clique em Editar para repor.
          </p>
          {lowStockProducts.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="row"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#2a1515',
                    border: '1px solid #5a2a2a',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b>{p.name}</b>
                    <div className="muted" style={{ fontSize: 13, color: '#ffb4b4' }}>
                      Estoque: {p.inventory?.qtyOnHand ?? 0}
                      {(p.inventory?.qtyReserved ?? 0) > 0
                        ? ` · ${availableStock(p)} disponível`
                        : null}
                      {!p.active ? ' · Inativo' : ''}
                    </div>
                  </div>
                  <button type="button" className="btn ghost" onClick={() => startEdit(p)}>
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

      <h3>Produtos ({products.length})</h3>
      <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
        {products.map((p) => {
          const avail = availableStock(p);
          const onHand = p.inventory?.qtyOnHand ?? 0;
          const isLow = onHand <= lowStockThreshold;
          return (
            <div
              key={p.id}
              className="card"
              style={isLow ? { borderColor: '#5a2a2a', boxShadow: 'inset 3px 0 0 #ff6b6b' } : undefined}
            >
              <div className="body row" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }}>
                  {p.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.images[0].url}
                      alt=""
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: 8,
                        background: '#111',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <b>{p.name}</b>{' '}
                      {!p.active ? <span className="badge">Inativo</span> : null}
                      {isLow ? (
                        <span className="badge" style={{ background: '#3a1515', color: '#ffb4b4' }}>
                          Estoque baixo
                        </span>
                      ) : null}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {p.sku} · {brl(p.price)}
                      {p.category ? ` · ${p.category.name}` : ''}
                    </div>
                    <div className="muted" style={{ fontSize: 13, color: isLow ? '#ffb4b4' : undefined }}>
                      Estoque: {onHand}
                      {(p.inventory?.qtyReserved ?? 0) > 0
                        ? ` (${avail} disponível, ${p.inventory?.qtyReserved} reservado)`
                        : null}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn ghost" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                  {p.active ? (
                    <Link className="btn ghost" href={`/produto/${p.slug}`} target="_blank">
                      Ver na loja
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {!products.length ? <p className="muted">Nenhum produto ainda. Cadastre o primeiro acima.</p> : null}
      </div>

      <h3>Pedidos ({orders.length})</h3>
      <p className="muted" style={{ fontSize: 14 }}>
        Entrega própria: Pago → Organizando → Embalagem → Pronto para coleta → Em trânsito → Entregue.
        Ao marcar Em trânsito, informe o código de rastreio (opcional). WhatsApp é wa.me — não envia sozinho.
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 14,
        }}
      >
        {ORDER_STATUS_TABS.map((tab) => {
          const active = orderStatusFilter === tab.key;
          const count = orderStatusFilter === '' || orderStatusFilter === tab.key
            ? (tab.key === '' ? orders.length : orders.filter((o) => o.status === tab.key).length)
            : null;
          return (
            <button
              key={tab.key || 'all'}
              type="button"
              className={active ? 'btn' : 'btn ghost'}
              onClick={() => setOrderStatusFilter(tab.key)}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                opacity: active ? 1 : 0.9,
              }}
            >
              {tab.label}
              {active && count != null ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
      {orders.map((o) => {
        const next = nextFulfillmentStatus(o.status);
        const wa = orderWa(o, 'generic');
        const waPaid = orderWa(o, 'paid');
        const waShipped = orderWa(o, 'shipped');
        const paidLike = o.status === 'paid' || o.status === 'organizing' || o.status === 'separating';
        const open = openOrderId === o.id;
        const phone = customerPhone(o);
        return (
          <div key={o.id} className="card" style={{ marginBottom: 10 }}>
            <div className="body">
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b>{o.publicId}</b>
                  <div className="muted">
                    {orderStatusLabel(o.status)} <span style={{ opacity: 0.6 }}>({o.status})</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {brl(o.total)} · {customerHint(o)}
                    {o.items?.length ? ` · ${o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setOpenOrderId(open ? null : o.id)}
                  >
                    {open ? 'Fechar' : 'Detalhe'}
                  </button>
                  {next ? (
                    <button
                      className="btn"
                      disabled={busyId === o.id}
                      onClick={() => advance(o)}
                      title={`Avançar para ${orderStatusLabel(next)}`}
                    >
                      {busyId === o.id ? 'Salvando...' : `Marcar: ${orderStatusLabel(next)}`}
                    </button>
                  ) : (
                    <span className="badge">{orderStatusLabel(o.status)}</span>
                  )}
                </div>
              </div>

              {paidLike ? (
                <div
                  className="ok"
                  style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <span>Cliente pagou — avise no WhatsApp (e-mail já cobre o cliente, se SMTP estiver ativo).</span>
                  <a className="btn wa" href={waPaid.url} target="_blank" rel="noreferrer">
                    Cliente pagou — abrir WhatsApp
                  </a>
                </div>
              ) : null}

              <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
                <a className="btn wa" href={wa.url} target="_blank" rel="noreferrer">
                  Avisar no WhatsApp
                </a>
                {o.status === 'in_transit' || o.status === 'shipped' ? (
                  <a className="btn wa" href={waShipped.url} target="_blank" rel="noreferrer">
                    Pedido saiu — abrir WhatsApp
                  </a>
                ) : null}
              </div>
              <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                {wa.toCustomer
                  ? `Abre conversa com o cliente (${phone}).`
                  : 'Cliente sem telefone — abre o WhatsApp da loja (NEXT_PUBLIC_WHATSAPP) com rascunho interno.'}
              </p>

              {open ? (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div className="muted" style={{ fontSize: 13, display: 'grid', gap: 4 }}>
                    <div><b style={{ color: 'var(--text)' }}>Cliente:</b> {o.user?.name || '—'}</div>
                    <div><b style={{ color: 'var(--text)' }}>E-mail:</b> {o.user?.email || '—'}</div>
                    <div><b style={{ color: 'var(--text)' }}>WhatsApp:</b> {phone || 'não cadastrado'}</div>
                    {o.addressSnap?.city ? (
                      <div>
                        <b style={{ color: 'var(--text)' }}>Entrega:</b>{' '}
                        {o.addressSnap.label ? `${o.addressSnap.label} · ` : ''}
                        {o.addressSnap.city}/{o.addressSnap.uf}
                      </div>
                    ) : null}
                    <div>
                      <b style={{ color: 'var(--text)' }}>Rastreio:</b>{' '}
                      {o.trackingCode || '—'}
                      {o.carrier ? ` · ${o.carrier}` : ''}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {!orders.length ? (
        <p className="muted">
          {orderStatusFilter
            ? `Nenhum pedido com status “${orderStatusLabel(orderStatusFilter)}”.`
            : 'Nenhum pedido ainda.'}
        </p>
      ) : null}
    </div>
  );
}
