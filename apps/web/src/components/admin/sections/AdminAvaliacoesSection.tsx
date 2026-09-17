'use client';

import Link from 'next/link';
import { brl } from '@/lib/api';
import {
  orderStatusLabel,
  adminQueueBucketLabel,
  POST_PAYMENT_OPS_HINT,
  isPostPaidStatus,
} from '@/lib/order-status';
import { isPlaceholderImageUrl } from '@/lib/placeholder-image';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import { shouldServerOrderSearch } from '@/lib/admin-order-search';
import {
  emptyOrdersQueueMessage,
  paymentMethodBadge,
  whatsAppOpsButtonLabel,
} from '@/lib/admin-ops-ui';
import { AdminAttentionStrip } from '@/components/admin/AdminAttentionStrip';
import { AdminSalesCharts } from '@/components/admin/AdminSalesCharts';
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
  emptyPhotoQueueMessage,
  isBulkAdvanceEligible,
  isBulkSepararEligible,
  photoQueueAlignmentNote,
  productNeedsStorePhoto,
  selectVisibleEligibleIds,
  toggleIdInList,
} from '@/lib/admin-daily-ops';
import {
  customerHistoryEmptyMessage,
  customerOrderPaymentLabel,
  customerOrdersEmptyMessage,
  customerVerClienteLabel,
  formatAdminDate,
  formatAdminDateTime,
  formatCustomerAddressLine,
  formatCustomerCityUf,
} from '@/lib/admin-customers-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';
import {
  DEFAULT_LOW_STOCK,
  MAX_PRODUCT_IMAGES,
  availableStock,
  customerHint,
  formatStuckHours,
  isPaidStuckOrder,
  hoursSincePaid,
  advanceButtonLabel,
  orderWa,
} from '@/components/admin/admin-console-model';

export function AdminAvaliacoesSection() {
  const {
    reviews,
    reviewBusyId,
    setReviewStatus,
    deleteReview,
  } = useAdminConsole();
  return (
    <>
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
    </>
  );
}
