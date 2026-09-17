/**
 * Admin PROFESSIONAL Phase 2 — pure display helpers for Pedidos + Catálogo.
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
