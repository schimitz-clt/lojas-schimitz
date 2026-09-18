/**
 * Admin Ciclo A (P0) — daily-ops helpers.
 * Bulk fulfillment (existing one-click transitions only) + catalog photo queue.
 * No network, no DOM.
 */

import { nextFulfillmentStatus, orderStatusLabel } from './order-status';
import { isMissingOrPlaceholderImage } from './placeholder-image';

/** ready_for_pickup → in_transit prompts for rastreio — not bulk-safe. */
export function fulfillmentNeedsExtraInput(status: string): boolean {
  return nextFulfillmentStatus(status) === 'in_transit';
}

/** Next status the admin can PATCH without extra prompt (tracking, etc.). */
export function nextOneClickFulfillmentStatus(status: string): string | null {
  const next = nextFulfillmentStatus(status);
  if (!next) return null;
  if (next === 'in_transit') return null;
  return next;
}

/** “Separar agora” = paid → organizing only (same one-click as the row CTA). */
export function isBulkSepararEligible(status: string): boolean {
  return status === 'paid' && nextFulfillmentStatus(status) === 'organizing';
}

export function isBulkAdvanceEligible(status: string): boolean {
  return nextOneClickFulfillmentStatus(status) != null;
}

export type BulkSkipReason = 'no_transition' | 'needs_tracking' | 'not_paid_separar';

export type BulkPartition<T extends { id: string; status: string }> = {
  eligible: T[];
  skipped: Array<{ item: T; reason: BulkSkipReason }>;
};

export function partitionBulkSeparar<T extends { id: string; status: string }>(
  selected: T[],
): BulkPartition<T> {
  const eligible: T[] = [];
  const skipped: Array<{ item: T; reason: BulkSkipReason }> = [];
  for (const item of selected) {
    if (isBulkSepararEligible(item.status)) {
      eligible.push(item);
    } else if (fulfillmentNeedsExtraInput(item.status)) {
      skipped.push({ item, reason: 'needs_tracking' });
    } else if (!nextFulfillmentStatus(item.status)) {
      skipped.push({ item, reason: 'no_transition' });
    } else {
      skipped.push({ item, reason: 'not_paid_separar' });
    }
  }
  return { eligible, skipped };
}

export function partitionBulkAdvance<T extends { id: string; status: string }>(
  selected: T[],
): BulkPartition<T> {
  const eligible: T[] = [];
  const skipped: Array<{ item: T; reason: BulkSkipReason }> = [];
  for (const item of selected) {
    if (isBulkAdvanceEligible(item.status)) {
      eligible.push(item);
    } else if (fulfillmentNeedsExtraInput(item.status)) {
      skipped.push({ item, reason: 'needs_tracking' });
    } else {
      skipped.push({ item, reason: 'no_transition' });
    }
  }
  return { eligible, skipped };
}

export function bulkSkipReasonLabel(reason: BulkSkipReason): string {
  if (reason === 'needs_tracking') {
    return 'precisa de rastreio (use o botão individual em Pronto para coleta → Em trânsito)';
  }
  if (reason === 'not_paid_separar') {
    return 'Separar agora só vale Pago → Organizando';
  }
  return 'sem transição de um clique neste status';
}

export type BulkAdvanceOk = { publicId: string; from: string; to: string };
export type BulkAdvanceFail = { publicId: string; message: string };
export type BulkAdvanceSkip = { publicId: string; reason: BulkSkipReason };

export type BulkAdvanceResult = {
  ok: BulkAdvanceOk[];
  failed: BulkAdvanceFail[];
  skipped: BulkAdvanceSkip[];
};

export function formatBulkAdvanceFeedback(
  result: BulkAdvanceResult,
  mode: 'separar' | 'advance',
): { msg: string; err: string } {
  const okParts =
    result.ok.length > 0
      ? `${mode === 'separar' ? 'Separados' : 'Avançados'} ${result.ok.length}: ${result.ok
          .map((r) => `${r.publicId} → ${orderStatusLabel(r.to)}`)
          .join('; ')}.`
      : '';
  const skipParts =
    result.skipped.length > 0
      ? `Ignorados ${result.skipped.length}: ${result.skipped
          .map((r) => `${r.publicId} — ${bulkSkipReasonLabel(r.reason)}`)
          .join('; ')}.`
      : '';
  const failParts =
    result.failed.length > 0
      ? `Falharam ${result.failed.length}: ${result.failed
          .map((r) => `${r.publicId} (${r.message})`)
          .join('; ')}.`
      : '';

  if (!result.ok.length && !result.failed.length && !result.skipped.length) {
    return { msg: '', err: 'Nenhum pedido na seleção.' };
  }
  if (!result.ok.length && result.failed.length === 0) {
    return {
      msg: '',
      err: skipParts || 'Nenhum pedido elegível na seleção (só status com transição de um clique).',
    };
  }
  if (result.failed.length) {
    return {
      msg: [okParts, skipParts].filter(Boolean).join(' '),
      err: failParts,
    };
  }
  return {
    msg: [okParts, skipParts].filter(Boolean).join(' '),
    err: '',
  };
}

export function bulkConfirmMessage(mode: 'separar' | 'advance', count: number): string {
  if (count <= 0) return '';
  if (mode === 'separar') {
    return `Separar agora ${count} pedido(s) Pago → Organizando? Cada um usa a mesma transição de um clique já existente.`;
  }
  return `Avançar ${count} pedido(s) para o próximo status de um clique? Pedidos que precisam de rastreio não entram.`;
}

export function toggleIdInList(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function pruneSelectedIds(selected: string[], visibleIds: readonly string[]): string[] {
  const vis = new Set(visibleIds);
  return selected.filter((id) => vis.has(id));
}

export function selectVisibleEligibleIds<T extends { id: string; status: string }>(
  visible: T[],
  mode: 'separar' | 'advance' | 'all',
): string[] {
  return visible
    .filter((o) => {
      if (mode === 'separar') return isBulkSepararEligible(o.status);
      if (mode === 'advance') return isBulkAdvanceEligible(o.status);
      return true;
    })
    .map((o) => o.id);
}

export function bulkProgressLabel(done: number, total: number, mode: 'separar' | 'advance'): string {
  const verb = mode === 'separar' ? 'Separando' : 'Avançando';
  return `${verb} ${done}/${total}…`;
}

/* —— Catálogo: fila sem foto / placeholder —— */

export type CatalogPhotoFilter = 'all' | 'needs_photo';

export function productCoverUrl(product: {
  images?: Array<{ url?: string | null; position?: number }> | null;
}): string {
  const imgs = product.images || [];
  const sorted = [...imgs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return typeof sorted[0]?.url === 'string' ? sorted[0].url.trim() : '';
}

export function productNeedsStorePhoto(url?: string | null): boolean {
  return isMissingOrPlaceholderImage(url);
}

export function catalogPhotoQueueCount(
  products: Array<{ images?: Array<{ url?: string | null; position?: number }> | null }>,
): number {
  return products.filter((p) => productNeedsStorePhoto(productCoverUrl(p))).length;
}

export function filterCatalogProducts<
  T extends { images?: Array<{ url?: string | null; position?: number }> | null },
>(products: T[], filter: CatalogPhotoFilter): T[] {
  if (filter === 'needs_photo') {
    return products.filter((p) => productNeedsStorePhoto(productCoverUrl(p)));
  }
  return products;
}

/** Align Catálogo queue count with Ops KPI “Foto p/ trocar”. */
export function photoQueueAlignmentNote(
  opsCount: number | null | undefined,
  listCount: number,
): string {
  const n = Math.max(0, Math.floor(Number(listCount) || 0));
  if (opsCount == null || !Number.isFinite(Number(opsCount))) {
    return `${n} produto(s) na lista sem foto real (vazia ou placeholder). Use Enviar foto na lista — sem inventar imagem.`;
  }
  const ops = Math.max(0, Math.floor(Number(opsCount) || 0));
  if (ops === n) {
    return `${n} produto(s) — alinhado ao Ops “Foto p/ trocar”. Sem foto inventada.`;
  }
  return `Lista: ${n} · Ops (snapshot): ${ops}. Atualize o Centro de comando se acabou de enviar fotos.`;
}

export function shouldPromoteUploadedImageToCover(coverUrl?: string | null): boolean {
  return productNeedsStorePhoto(coverUrl);
}

/** Put newCoverId first; keep remaining ids in prior order (PATCH reorder). */
export function orderedIdsWithNewCover(existingIds: string[], newCoverId: string): string[] {
  const id = String(newCoverId || '');
  const rest = existingIds.filter((x) => x !== id);
  return id ? [id, ...rest] : [...existingIds];
}

export function listPhotoUploadSuccessMessage(name: string, promotedToCover: boolean): string {
  const n = (name || 'produto').trim() || 'produto';
  if (promotedToCover) {
    return `Foto real enviada para “${n}” e definida como capa (placeholder/ausente não conta como pronta).`;
  }
  return `Foto adicionada a “${n}”.`;
}

const PHOTO_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** Android WebView often sends empty MIME or application/octet-stream with a real .jpg name. */
export function isAllowedProductPhotoMime(type?: string | null, name?: string | null): boolean {
  const mime = String(type || '').toLowerCase().trim();
  if (PHOTO_MIME.has(mime)) return true;
  const n = String(name || '').toLowerCase();
  const extOk = /\.(jpe?g|png|webp)$/.test(n);
  if (!extOk) return false;
  return !mime || mime === 'application/octet-stream';
}

export function validateProductPhotoFile(
  file: { type?: string; name?: string; size: number } | null | undefined,
  currentCount: number,
  max = 10,
): string | null {
  if (!file) return 'Selecione um arquivo de imagem.';
  if (!isAllowedProductPhotoMime(file.type, file.name)) return 'Use uma imagem JPG, PNG ou WebP.';
  if (file.size > PHOTO_MAX_BYTES) return 'A foto deve ter no máximo 15 MB.';
  if (currentCount >= max) return `Limite de ${max} fotos por produto.`;
  return null;
}

/** Unique gallery URLs (capa first) from form tiles + optional cover field. */
export function collectProductGalleryUrls(
  images: Array<{ url?: string | null }> | null | undefined,
  coverUrl?: string | null,
  max = 10,
): string[] {
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : 10;
  const raw = [
    ...(Array.isArray(images) ? images.map((img) => img?.url) : []),
    coverUrl,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const url = typeof item === 'string' ? item.trim() : '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= cap) break;
  }
  return out;
}

export function extraProductImageUrls(urls: string[]): string[] {
  return urls.slice(1);
}

export function missingProductImageUrls(desired: string[], existing: Array<{ url?: string | null }> | null | undefined): string[] {
  const have = new Set(
    (existing || [])
      .map((img) => (typeof img?.url === 'string' ? img.url.trim() : ''))
      .filter(Boolean),
  );
  return desired.filter((url) => !have.has(url));
}

export function emptyPhotoQueueMessage(filter: CatalogPhotoFilter): string {
  if (filter === 'needs_photo') {
    return 'Fila sem foto vazia — nenhum produto com capa vazia ou placeholder na lista carregada.';
  }
  return 'Nenhum produto ainda. Cadastre o primeiro acima.';
}
