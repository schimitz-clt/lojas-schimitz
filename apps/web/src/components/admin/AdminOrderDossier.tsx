'use client';

import { useEffect, useRef } from 'react';
import { isPostPaidStatus } from '@/lib/order-status';
import { rewritePublicUploadUrl } from '@/lib/public-upload-url';
import {
  ENTERPRISE_MISSING,
  ORDER_ACTOR_SCOPE,
  fulfillmentConfirmCopy,
  orderDossierModel,
} from '@/lib/admin-enterprise-ui';
import { whatsAppOpsButtonLabel } from '@/lib/admin-ops-ui';
import { customerVerClienteLabel } from '@/lib/admin-customers-ui';
import {
  paymentRefundAttentionCopy,
  paymentRefundConfirmCopy,
  paymentRefundOffer,
  paymentRefundRowLine,
} from '@/lib/admin-payment-refund-ui';
import { advanceButtonLabel, type AdminOrder } from '@/components/admin/admin-console-model';

type WaLink = { url: string; toCustomer: boolean };

type Props = {
  order: AdminOrder;
  busy: boolean;
  bulkBusy: boolean;
  confirming: boolean;
  trackingDraft: string;
  carrierDraft: string;
  err: string;
  msg: string;
  waGeneric: WaLink;
  waPaid: WaLink;
  waShipped: WaLink;
  onTrackingDraft: (value: string) => void;
  onCarrierDraft: (value: string) => void;
  onClose: () => void;
  onAskAdvance: () => void;
  onConfirmAdvance: () => void;
  onCancelAdvance: () => void;
  refundingPaymentId: string | null;
  onAskRefund: (paymentId: string) => void;
  onConfirmRefund: (paymentId: string) => void;
  onCancelRefund: () => void;
  onResend: () => void;
  onCopyPublicId: () => void;
  onCopyTracking: () => void;
  onOpenCustomer?: () => void;
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-ent-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AdminOrderDossier({
  order,
  busy,
  bulkBusy,
  confirming,
  trackingDraft,
  carrierDraft,
  err,
  msg,
  waGeneric,
  waPaid,
  waShipped,
  onTrackingDraft,
  onCarrierDraft,
  onClose,
  onAskAdvance,
  onConfirmAdvance,
  onCancelAdvance,
  refundingPaymentId,
  onAskRefund,
  onConfirmRefund,
  onCancelRefund,
  onResend,
  onCopyPublicId,
  onCopyTracking,
  onOpenCustomer,
}: Props) {
  const model = orderDossierModel(order);
  const confirm =
    confirming && model.nextStatus
      ? fulfillmentConfirmCopy({
          publicId: order.publicId,
          fromStatus: order.status,
          toStatus: model.nextStatus,
        })
      : null;
  const refundOffers = paymentRefundOffer(order);
  const refundAttention = refundOffers.length
    ? paymentRefundAttentionCopy({ publicId: order.publicId, count: refundOffers.length })
    : null;
  const canResend = isPostPaidStatus(order.status);
  const showPaidWa =
    order.status === 'paid' || order.status === 'organizing' || order.status === 'separating';
  const showShippedWa = order.status === 'in_transit' || order.status === 'shipped';

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <>
      <button type="button" className="admin-ent-backdrop" aria-label="Fechar detalhe do pedido" onClick={onClose} />
      <aside className="admin-ent-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-order-dossier-title">
        <header className="admin-ent-sheet__head">
          <div>
            <p className="admin-ent-kicker">Pedido · GET /admin/orders</p>
            <h2 id="admin-order-dossier-title" className="admin-ent-sheet__title">
              {model.publicId}
            </h2>
            <p className="admin-ent-sheet__sub">{model.statusLabel}</p>
          </div>
          <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={onClose}>
            Fechar
          </button>
        </header>

        {err ? (
          <p role="alert" className="alert admin-ent-banner admin-ent-banner--err">
            {err}
          </p>
        ) : null}
        {msg && !err ? (
          <p role="status" className="ok admin-ent-banner">
            {msg}
          </p>
        ) : null}

        <div className="admin-ent-actions">
          <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={onCopyPublicId}>
            Copiar ID
          </button>
          {model.nextStatus ? (
            <button
              type="button"
              className={`btn${order.status === 'paid' || order.status === 'organizing' || order.status === 'separating' ? ' admin-btn-separar' : ''}`}
              disabled={busy || bulkBusy}
              onClick={onAskAdvance}
            >
              {busy ? 'Salvando...' : advanceButtonLabel(order.status, model.nextStatus)}
            </button>
          ) : (
            <span className="admin-ent-note">Sem transição de um clique neste status.</span>
          )}
          {canResend ? (
            <button type="button" className="btn ghost admin-btn-ghost-pro" disabled={busy || bulkBusy} onClick={onResend}>
              Reenviar aviso loja
            </button>
          ) : null}
        </div>

        {refundAttention ? (
          <section className="admin-ent-refund" aria-label="Estorno de pagamento">
            <p className="admin-ent-refund__kicker">Atenção</p>
            <p className="admin-ent-refund__title">{refundAttention.title}</p>
            <p className="admin-ent-refund__detail">{refundAttention.detail}</p>
            {refundOffers.map((payment) => {
              const id = String(payment.id || '').trim();
              const open = refundingPaymentId === id;
              const refundCopy = paymentRefundConfirmCopy({
                publicId: order.publicId,
                orderId: order.id,
                orderStatus: order.status,
                paymentId: id,
                amount: payment.amount,
              });
              return (
                <div key={id} className="admin-ent-refund__item">
                  <p className="admin-ent-refund__row">{paymentRefundRowLine(payment)}</p>
                  {open ? (
                    <div className="admin-ent-confirm admin-ent-confirm--danger" role="region" aria-label="Confirmar estorno">
                      <p className="admin-ent-confirm__title">{refundCopy.title}</p>
                      <p className="admin-ent-confirm__detail">{refundCopy.detail}</p>
                      <div className="admin-ent-actions">
                        <button
                          type="button"
                          className="btn admin-btn-danger"
                          disabled={busy || bulkBusy}
                          onClick={() => onConfirmRefund(id)}
                        >
                          {busy ? 'Estornando…' : 'Confirmar estorno'}
                        </button>
                        <button type="button" className="btn ghost" disabled={busy || bulkBusy} onClick={onCancelRefund}>
                          Voltar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn admin-btn-danger"
                      disabled={busy || bulkBusy || Boolean(refundingPaymentId)}
                      onClick={() => onAskRefund(id)}
                    >
                      Estornar pagamento
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ) : null}

        {confirm ? (
          <div className="admin-ent-confirm" role="region" aria-label="Confirmar avanço de status">
            <p className="admin-ent-confirm__title">{confirm.title}</p>
            <p className="admin-ent-confirm__detail">{confirm.detail}</p>
            {model.needsTracking ? (
              <div className="admin-ent-confirm__fields">
                <label>
                  Código de rastreio (opcional)
                  <input
                    value={trackingDraft}
                    onChange={(event) => onTrackingDraft(event.target.value)}
                    maxLength={80}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Transportadora
                  <input
                    value={carrierDraft}
                    onChange={(event) => onCarrierDraft(event.target.value)}
                    maxLength={80}
                    placeholder="propria"
                    autoComplete="off"
                  />
                </label>
              </div>
            ) : null}
            <div className="admin-ent-actions">
              <button type="button" className="btn admin-btn-primary-accent" disabled={busy || bulkBusy} onClick={onConfirmAdvance}>
                {busy ? 'Salvando...' : 'Confirmar avanço'}
              </button>
              <button type="button" className="btn ghost" disabled={busy || bulkBusy} onClick={onCancelAdvance}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <h3 className="admin-ent-h">Evidência</h3>
        <div className="admin-ent-facts">
          <Fact label="Status" value={model.statusLabel} />
          <Fact label="Próximo passo" value={model.nextLabel} />
          <Fact label="Criado" value={model.createdAt} />
          <Fact label="Atualizado" value={model.updatedAt} />
          {model.totals.map((row) => (
            <Fact key={row.label} label={row.label} value={row.value} />
          ))}
        </div>

        <h3 className="admin-ent-h">Cliente e entrega</h3>
        <div className="admin-ent-facts">
          <Fact label="Cliente" value={model.customerName} />
          <Fact label="E-mail" value={model.customerEmail} />
          <Fact label="WhatsApp" value={model.customerPhone} />
          <Fact label="Endereço" value={model.address} />
          <Fact label="Frete (rótulo)" value={model.freightLabel} />
          <Fact label="Prazo (dias)" value={model.freightDays} />
          <Fact label="Transportadora" value={model.carrier} />
          <Fact label="Rastreio" value={model.tracking} />
          <Fact label="Reserva até" value={model.reservationExpiresAt} />
        </div>
        <div className="admin-ent-actions">
          {order.user?.id && onOpenCustomer ? (
            <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={onOpenCustomer}>
              {customerVerClienteLabel(true)}
            </button>
          ) : null}
          {order.trackingCode?.trim() ? (
            <button type="button" className="btn ghost admin-btn-ghost-pro" onClick={onCopyTracking}>
              Copiar rastreio
            </button>
          ) : null}
          <a className="btn wa" href={waGeneric.url} target="_blank" rel="noreferrer">
            {whatsAppOpsButtonLabel(waGeneric.toCustomer, 'generic')}
          </a>
          {showPaidWa ? (
            <a className="btn wa" href={waPaid.url} target="_blank" rel="noreferrer">
              {whatsAppOpsButtonLabel(waPaid.toCustomer, 'paid')}
            </a>
          ) : null}
          {showShippedWa ? (
            <a className="btn wa" href={waShipped.url} target="_blank" rel="noreferrer">
              {whatsAppOpsButtonLabel(waShipped.toCustomer, 'shipped')}
            </a>
          ) : null}
        </div>

        <h3 className="admin-ent-h">Itens</h3>
        {model.items.length ? (
          <div className="admin-ent-table-wrap">
            <table className="admin-ent-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Unitário</th>
                  <th>Linha</th>
                </tr>
              </thead>
              <tbody>
                {model.items.map((item, index) => {
                  const src = item.imageUrl ? rewritePublicUploadUrl(item.imageUrl) || item.imageUrl : '';
                  return (
                    <tr key={`${item.name}-${index}`}>
                      <td>
                        <span className="admin-ent-item">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt="" className="admin-ent-item__thumb" />
                          ) : null}
                          {item.name}
                        </span>
                      </td>
                      <td>{item.qty}</td>
                      <td>{item.unit}</td>
                      <td>{item.line}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-ent-note">Itens: {ENTERPRISE_MISSING}</p>
        )}

        <h3 className="admin-ent-h">Pagamentos</h3>
        {model.payments.length ? (
          <ul className="admin-ent-list">
            {model.payments.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="admin-ent-note">Nenhum pagamento neste payload. {ENTERPRISE_MISSING}</p>
        )}

        <h3 className="admin-ent-h">Histórico de status</h3>
        <p className="admin-ent-note">{ORDER_ACTOR_SCOPE}</p>
        {model.history.length ? (
          <ul className="admin-ent-list">
            {model.history.map((row, index) => (
              <li key={`${row.when}-${index}`}>
                {row.when} · {row.from} → {row.to} · nota {row.note} · ator {row.actor}
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-ent-note">
            Sem histórico neste payload. Criado {model.createdAt}.
          </p>
        )}
      </aside>
    </>
  );
}
