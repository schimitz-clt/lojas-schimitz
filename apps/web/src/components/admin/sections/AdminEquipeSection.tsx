'use client';

import Link from 'next/link';
import { brl, currentUser } from '@/lib/api';
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

export function AdminEquipeSection() {
  const {
    form,
    admins,
    adminForm,
    setAdminForm,
    savingAdmin,
    adminBusyId,
    saveAdmin,
    toggleAdminStatus,
  } = useAdminConsole();
  return (
    <>
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
    </>
  );
}
