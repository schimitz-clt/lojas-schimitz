/**
 * Admin PROFESSIONAL — pure display helpers (Phase 2 Pedidos/Catálogo + Phase 3 remaining).
 * No network, no DOM. Reuses Phase 1 tokens via CSS class names only.
 */

export type AdminChipTone = 'neutral' | 'warn' | 'ok' | 'danger' | 'info' | 'accent';

/** Visual tone for order status chips (PT labels stay in orderStatusLabel). */
export function orderStatusChipTone(status: string): AdminChipTone {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'paid') return 'accent';
  if (s === 'organizing' || s === 'separating' || s === 'packing') return 'warn';
  if (s === 'ready_for_pickup' || s === 'in_transit' || s === 'shipped') return 'info';
  if (s === 'delivered') return 'ok';
  if (s === 'cancelled' || s === 'refunded') return 'danger';
  return 'neutral';
}

export function orderStatusChipClass(status: string): string {
  return `admin-chip-status admin-chip-status--${orderStatusChipTone(status)}`;
}

export type PaidQueueBannerTone = 'empty' | 'active' | 'stuck';

/** Paid-awaiting-org banner tone from ops snapshot counts. */
export function paidQueueBannerTone(opts: {
  paidAwaitingCount?: number | null;
  stuckCount?: number | null;
}): PaidQueueBannerTone {
  const stuck = Math.max(0, Number(opts.stuckCount) || 0);
  const awaiting = Math.max(0, Number(opts.paidAwaitingCount) || 0);
  if (stuck > 0) return 'stuck';
  if (awaiting > 0) return 'active';
  return 'empty';
}

export function paidQueueBannerClass(tone: PaidQueueBannerTone): string {
  return `admin-queue-banner admin-queue-banner--${tone}`;
}

/** Sticky primary actions on mobile for early ops rows (Separar / WA pago). */
export function shouldStickyOrderActions(status: string): boolean {
  const s = String(status || '').trim().toLowerCase();
  return s === 'paid' || s === 'organizing' || s === 'separating';
}

export type ProductPhotoBadgeKind = 'ok' | 'missing' | 'placeholder';

/**
 * Photo badge for catalog rows — never invents images.
 * Pass `isPlaceholderOrMissing` from isMissingOrPlaceholderImage(url).
 */
export function productPhotoBadgeKind(opts: {
  hasUrl: boolean;
  isPlaceholderOrMissing: boolean;
}): ProductPhotoBadgeKind {
  if (!opts.hasUrl || opts.isPlaceholderOrMissing) {
    return opts.hasUrl ? 'placeholder' : 'missing';
  }
  return 'ok';
}

export function productPhotoBadgeLabel(kind: ProductPhotoBadgeKind): string | null {
  if (kind === 'missing') return 'Sem foto';
  if (kind === 'placeholder') return 'Foto placeholder';
  return null;
}

export function productStockTone(
  onHand: number,
  threshold: number,
  active = true,
): AdminChipTone {
  if (!active) return 'neutral';
  const n = Number.isFinite(onHand) ? onHand : 0;
  const lim = Number.isFinite(threshold) ? Math.max(0, threshold) : 0;
  if (n <= 0) return 'danger';
  if (n <= lim) return 'warn';
  return 'ok';
}

export function productActiveLabel(active: boolean): string {
  return active ? 'Ativo' : 'Inativo';
}

export function productActiveChipClass(active: boolean): string {
  return active
    ? 'admin-chip-status admin-chip-status--ok'
    : 'admin-chip-status admin-chip-status--neutral';
}

export function productStockChipClass(
  onHand: number,
  threshold: number,
  active = true,
): string {
  return `admin-chip-status admin-chip-status--${productStockTone(onHand, threshold, active)}`;
}

/** PT summary for products needing real photos (CSV / banner). */
export function catalogNeedsPhotoSummary(count: number): string {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 0) return '';
  return `${n} produto(s) precisam de foto da loja (vazia ou placeholder). Use Trocar foto / Editar — sem inventar imagem.`;
}

/** Dense table density hint — used by CSS hook class only. */
export function adminTableDensityClass(dense = true): string {
  return dense ? 'admin-table admin-table--dense' : 'admin-table';
}

/* —— Phase 3: remaining sections (display only) —— */

function normStatus(status: string | null | undefined): string {
  return String(status || '').trim().toLowerCase();
}

export function customerAccountTone(status: string): AdminChipTone {
  const s = normStatus(status);
  if (s === 'blocked' || s === 'inactive' || s === 'disabled') return 'danger';
  if (s === 'active') return 'ok';
  return 'neutral';
}

export function customerAccountLabel(status: string): string {
  const s = normStatus(status);
  if (s === 'blocked') return 'Bloqueado';
  if (s === 'inactive' || s === 'disabled') return 'Inativo';
  if (s === 'active') return 'Ativo';
  return status || '—';
}

export function sellerStatusTone(status: string): AdminChipTone {
  const s = normStatus(status);
  if (s === 'active') return 'ok';
  if (s === 'pending') return 'warn';
  if (s === 'suspended') return 'danger';
  return 'neutral';
}

export function sellerStatusLabel(status: string): string {
  const s = normStatus(status);
  if (s === 'active') return 'Ativo';
  if (s === 'pending') return 'Pendente';
  if (s === 'suspended') return 'Suspenso';
  return status || '—';
}

export function commissionStatusTone(status: string): AdminChipTone {
  const s = normStatus(status);
  if (s === 'paid') return 'ok';
  if (s === 'approved') return 'info';
  if (s === 'pending') return 'warn';
  return 'neutral';
}

export function commissionStatusLabel(status: string): string {
  const s = normStatus(status);
  if (s === 'paid') return 'Paga';
  if (s === 'approved') return 'Aprovada';
  if (s === 'pending') return 'Pendente';
  return status || '—';
}

export function couponIsExpired(endsAt: string | null | undefined, now = Date.now()): boolean {
  if (!endsAt) return false;
  const t = new Date(endsAt).getTime();
  return Number.isFinite(t) && t < now;
}

export function couponIsExhausted(
  maxUses: number | null | undefined,
  usedCount: number | null | undefined,
): boolean {
  if (maxUses == null) return false;
  const max = Number(maxUses);
  const used = Number(usedCount) || 0;
  return Number.isFinite(max) && used >= max;
}

export function couponListStats(
  coupons: Array<{ active?: boolean; usedCount?: number; reservedCount?: number }>,
): { active: number; inactive: number; uses: number; reserved: number } {
  let active = 0;
  let uses = 0;
  let reserved = 0;
  for (const c of coupons) {
    if (c.active) active += 1;
    uses += Number(c.usedCount) || 0;
    reserved += Number(c.reservedCount) || 0;
  }
  return { active, inactive: coupons.length - active, uses, reserved };
}

export function reviewStatusTone(status: string): AdminChipTone {
  const s = normStatus(status);
  if (s === 'hidden') return 'neutral';
  if (s === 'published') return 'ok';
  return 'warn';
}

export function reviewStatusLabel(status: string): string {
  const s = normStatus(status);
  if (s === 'hidden') return 'Oculta';
  if (s === 'published') return 'Publicada';
  return status || '—';
}

/** 1–5 star glyphs for moderation rows (clamped). */
export function reviewStars(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.floor(Number(rating) || 0)));
  return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
}

export function adminUserStatusTone(status: string): AdminChipTone {
  return normStatus(status) === 'active' ? 'ok' : 'neutral';
}

export function adminUserStatusLabel(status: string): string {
  return normStatus(status) === 'active' ? 'Ativo' : 'Desativado';
}

export function bannerActiveLabel(active: boolean): string {
  return active ? 'Ativo' : 'Inativo';
}

export function shippingZoneActiveLabel(active: boolean): string {
  return active ? 'Ativa' : 'Inativa';
}

export function salesPresetActive(
  from: string,
  to: string,
  presetFrom: string,
  presetTo: string,
): boolean {
  return from === presetFrom && to === presetTo;
}
