'use client';

import Link from 'next/link';
import { brl } from '@/lib/api';
import { adminQueueBucketLabel, ADMIN_ORDER_QUEUE_BUCKETS } from '@/lib/order-status';
import { buildAdminSectionHref } from '@/lib/admin-sections';
import {
  formatOpsSnapshotTime,
  opsAlertCtaHintPt,
  OPS_DO_HEADING,
  OPS_DO_LEDE,
  OPS_NOW_HEADING,
  OPS_NOW_LEDE,
  OPS_QUICK_ACTIONS,
  opsCountOrDash,
  opsMailStatusLabel,
  opsQuickActionFigure,
  opsUploadsStatusLabel,
  sortOpsAlertsForAttention,
  type OpsQuickActionId,
} from '@/lib/admin-ops-ui';
import { AdminAttentionStrip, type AdminAttentionItem } from '@/components/admin/AdminAttentionStrip';
import { useAdminConsole } from '@/components/admin/admin-console-context';
import {
  PAID_STUCK_HOURS_UI,
  type AdminOpsAlert,
} from '@/components/admin/admin-console-model';

function toAttentionItem(a: AdminOpsAlert): AdminAttentionItem {
  const count = typeof a.count === 'number' && Number.isFinite(a.count) ? a.count : null;
  return {
    code: a.code,
    severity: a.severity,
    message: a.message,
    count,
    recommendedAction: a.recommendedAction,
    evidenceLine: a.evidence?.reason
      ? `Evidência: ${a.evidence.reason}${
          a.evidence.providerStatus ? ` · status ${a.evidence.providerStatus}` : ''
        }${a.evidence.externalReference ? ` · ref ${a.evidence.externalReference}` : ''}`
      : null,
    ctaHint: opsAlertCtaHintPt(a),
  };
}

function kpiTone(ready: boolean, n: number | null | undefined, kind: 'warn' | 'danger'): string {
  if (!ready || n == null || n <= 0) return '';
  return kind === 'danger' ? ' admin-cc-kpi--danger' : ' admin-cc-kpi--warn';
}

export function AdminOpsSection() {
  const {
    orderStatusFilter,
    ops,
    opsBusy,
    reconciliations,
    reconBusy,
    loadOps,
    selectOpsBucket,
    loadReconciliations,
    openCatalogPhotoQueue,
    selectOpsAlert,
    downloadProductsNeedingPhotosCsv,
    attentionAlerts,
    opsSnapshot,
    startEditById,
  } = useAdminConsole();

  const ready = ops != null;
  const signalAlerts = sortOpsAlertsForAttention(
    (ops?.alerts ?? []).filter((a) => a.severity === 'info'),
  );
  const infoAlertCount = signalAlerts.length;
  const mail = opsMailStatusLabel(ops?.mail, ready);
  const uploadsLabel = opsUploadsStatusLabel(ops?.uploads);
  const paidCount = ops?.paidAwaitingOrg?.paidAwaitingCount ?? ops?.orders?.buckets?.paid;
  const stuckCount = ops?.paidAwaitingOrg?.stuckCount;
  const stuckThreshold = ops?.paidAwaitingOrg?.stuckHoursThreshold ?? (ready ? PAID_STUCK_HOURS_UI : null);
  const oldestStuck = ops?.paidAwaitingOrg?.oldestStuckHours;
  const actionSnap = ready
    ? {
        paidAwaiting: paidCount ?? null,
        ordersTotal: ops?.orders?.total ?? null,
        placeholderPhotos: ops?.catalog?.placeholderProductCount ?? null,
        lowStock: ops?.inventory.lowStockCount ?? null,
        outOfStock: ops?.inventory.outOfStockCount ?? null,
        openRecon: ops?.reconciliations?.openCount ?? null,
      }
    : null;

  const nowBits: string[] = [];
  if (!ready) {
    nowBits.push(
      opsSnapshot === 'error'
        ? 'Snapshot operacional indisponível. Nenhum número foi estimado.'
        : 'Lendo o snapshot…',
    );
  } else {
    if (ops.sales?.today) {
      nowBits.push(
        `Hoje ${brl(ops.sales.today.revenue)} em ${ops.sales.today.orderCount} pedido(s) pagos.`,
      );
    } else {
      nowBits.push('Receita de hoje não veio neste snapshot.');
    }
    if (paidCount != null) nowBits.push(`${paidCount} pago(s) aguardando organização.`);
    nowBits.push(`${attentionAlerts.length} alerta(s) de atenção.`);
  }

  function runQuickAction(id: OpsQuickActionId) {
    if (id === 'paid') {
      selectOpsBucket('paid');
      return;
    }
    if (id === 'orders') {
      selectOpsBucket('');
      return;
    }
    if (id === 'photos') {
      openCatalogPhotoQueue();
      return;
    }
    if (id === 'recon') {
      document.getElementById('admin-reconciliations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      void loadReconciliations();
    }
  }

  const quickHref: Partial<Record<OpsQuickActionId, string>> = {
    catalog: buildAdminSectionHref('catalogo'),
    push: buildAdminSectionHref('notificacoes'),
    vendas: buildAdminSectionHref('vendas'),
    clientes: buildAdminSectionHref('clientes'),
  };

  return (
    <div className="admin-section-panel admin-cc">
      <header className="admin-cc-banner">
        <div>
          <p className="admin-cc-banner__eyebrow">Centro de comando</p>
          <p className="admin-cc-banner__title">Três perguntas, um snapshot.</p>
          <p className="admin-cc-banner__meta">
            Snapshot{' '}
            {ops?.time ? (
              <time dateTime={ops.time}>{formatOpsSnapshotTime(ops.time)}</time>
            ) : (
              '—'
            )}
            {' · '}
            GET /admin/ops
          </p>
        </div>
        <button
          type="button"
          className="admin-cc-banner__refresh"
          disabled={opsBusy}
          onClick={() => {
            void loadOps();
            void loadReconciliations();
          }}
        >
          {opsBusy ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      <section className="admin-cc-block" aria-labelledby="ops-now-heading">
        <p className="admin-cc-block__step">01</p>
        <h2 id="ops-now-heading" className="admin-cc-block__title">
          {OPS_NOW_HEADING}
        </h2>
        <p className="admin-cc-block__lede">{OPS_NOW_LEDE}</p>
        <p className="admin-cc-nowline" role="status">
          {nowBits.join(' ')}
        </p>

        <div className="admin-cc-kpi-grid">
          <div className="admin-cc-kpi">
            <div className="admin-cc-kpi__label">Receita hoje</div>
            <div className="admin-cc-kpi__value">
              {ops?.sales?.today ? brl(ops.sales.today.revenue) : '—'}
            </div>
            <div className="admin-cc-kpi__hint">
              {ops?.sales?.today
                ? `${ops.sales.today.orderCount} pedido(s) pagos`
                : ready
                  ? 'sem janela neste snapshot'
                  : 'aguardando snapshot'}
            </div>
          </div>
          <div className="admin-cc-kpi">
            <div className="admin-cc-kpi__label">Receita 30 dias</div>
            <div className="admin-cc-kpi__value">
              {ops?.sales?.last30d ? brl(ops.sales.last30d.revenue) : '—'}
            </div>
            <div className="admin-cc-kpi__hint">
              {ops?.sales?.last30d
                ? `${ops.sales.last30d.orderCount} pedido(s) pagos`
                : ready
                  ? 'sem janela neste snapshot'
                  : 'aguardando snapshot'}
            </div>
          </div>
          <div className="admin-cc-kpi">
            <div className="admin-cc-kpi__label">Pedidos</div>
            <div className="admin-cc-kpi__value">{opsCountOrDash(ops?.orders?.total, ready)}</div>
            <div className="admin-cc-kpi__hint">total no snapshot</div>
          </div>
          <button
            type="button"
            className={`admin-cc-kpi${kpiTone(ready, stuckCount, 'danger')}${
              ready && (stuckCount ?? 0) === 0 ? kpiTone(ready, paidCount, 'warn') : ''
            }`}
            onClick={() => selectOpsBucket('paid')}
          >
            <div className="admin-cc-kpi__label">Pagos p/ organizar</div>
            <div className={`admin-cc-kpi__value${(stuckCount ?? 0) > 0 ? ' admin-cc-kpi__value--danger' : ''}`}>
              {opsCountOrDash(paidCount, ready)}
            </div>
            <div className="admin-cc-kpi__hint">
              {!ready
                ? 'aguardando snapshot'
                : (stuckCount ?? 0) > 0
                  ? `${stuckCount} travado(s) ≥${stuckThreshold ?? PAID_STUCK_HOURS_UI}h`
                  : `limite ${stuckThreshold ?? PAID_STUCK_HOURS_UI}h`}
            </div>
          </button>
          <div className={`admin-cc-kpi${kpiTone(ready, ops?.payments?.pendingCount, 'warn')}`}>
            <div className="admin-cc-kpi__label">Pagamentos</div>
            <div className="admin-cc-kpi__value">{opsCountOrDash(ops?.payments?.pendingCount, ready)}</div>
            <div className="admin-cc-kpi__hint">pendentes no snapshot</div>
          </div>
          <button
            type="button"
            className={`admin-cc-kpi${kpiTone(ready, ops?.reconciliations?.openCount, 'danger')}`}
            onClick={() => {
              document.getElementById('admin-reconciliations')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
              void loadReconciliations();
            }}
          >
            <div className="admin-cc-kpi__label">Reconciliações</div>
            <div
              className={`admin-cc-kpi__value${
                (ops?.reconciliations?.openCount ?? 0) > 0 ? ' admin-cc-kpi__value--danger' : ''
              }`}
            >
              {opsCountOrDash(ops?.reconciliations?.openCount, ready)}
            </div>
            <div className="admin-cc-kpi__hint">abertas no snapshot</div>
          </button>
        </div>

        <p className="admin-cc-flow__label">Fila por status real — o clique abre Pedidos</p>
        <div className="admin-cc-flow" role="list">
          <button
            type="button"
            role="listitem"
            className={`admin-cc-flow__step${orderStatusFilter === '' ? ' is-active' : ''}`}
            onClick={() => selectOpsBucket('')}
          >
            <span>Todos</span>
            <strong>{opsCountOrDash(ops?.orders?.total, ready)}</strong>
          </button>
          {ADMIN_ORDER_QUEUE_BUCKETS.map((key) => (
            <button
              key={key}
              type="button"
              role="listitem"
              className={`admin-cc-flow__step${orderStatusFilter === key ? ' is-active' : ''}${
                ready && key === 'problems' && (ops?.orders?.stuckCount ?? 0) > 0
                  ? ' is-hot'
                  : ''
              }`}
              onClick={() => selectOpsBucket(key)}
            >
              <span>{adminQueueBucketLabel(key)}</span>
              <strong>{ready ? (ops?.orders?.buckets?.[key] ?? 0) : '—'}</strong>
            </button>
          ))}
        </div>

        <dl className="admin-cc-facts">
          <div>
            <dt>Estoque baixo</dt>
            <dd>
              {opsCountOrDash(ops?.inventory.lowStockCount, ready)}
              {ready ? <span> limite ≤{ops?.inventory.lowStockThreshold ?? '—'}</span> : null}
            </dd>
          </div>
          <div>
            <dt>Zerados</dt>
            <dd className={(ops?.inventory.outOfStockCount ?? 0) > 0 ? 'is-danger' : undefined}>
              {opsCountOrDash(ops?.inventory.outOfStockCount, ready)}
            </dd>
          </div>
          <div>
            <dt>Foto p/ trocar</dt>
            <dd>{opsCountOrDash(ops?.catalog?.placeholderProductCount, ready)}</dd>
          </div>
          <div>
            <dt>E-mail loja</dt>
            <dd className={mail.tone === 'danger' ? 'is-danger' : mail.tone === 'ok' ? 'is-ok' : undefined}>
              {mail.label}
              {ops?.mail?.lastStoreNotifyFailure?.publicId ? (
                <span> último {ops.mail.lastStoreNotifyFailure.publicId}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Pagos travados</dt>
            <dd className={(stuckCount ?? 0) > 0 ? 'is-danger' : undefined}>
              {!ready
                ? '—'
                : (stuckCount ?? 0) > 0
                  ? `${stuckCount} ≥${stuckThreshold}h${
                      oldestStuck != null ? ` · mais antigo ~${oldestStuck}h` : ''
                    }`
                  : `0 · limite ${stuckThreshold}h`}
            </dd>
          </div>
          {uploadsLabel ? (
            <div>
              <dt>Uploads</dt>
              <dd className={ops?.uploads?.persistent === false ? 'is-danger' : undefined}>{uploadsLabel}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <AdminAttentionStrip
        variant="command"
        snapshot={ops ? 'ready' : opsSnapshot}
        infoCount={infoAlertCount}
        max={Math.max(attentionAlerts.length, 1)}
        items={attentionAlerts.map(toAttentionItem)}
        signals={signalAlerts.map(toAttentionItem)}
        onSelect={(code) => {
          const a = (ops?.alerts ?? []).find((x) => x.code === code);
          if (a) selectOpsAlert(a);
        }}
      />

      <section className="admin-cc-block" aria-labelledby="ops-do-heading">
        <p className="admin-cc-block__step">03</p>
        <h2 id="ops-do-heading" className="admin-cc-block__title">
          {OPS_DO_HEADING}
        </h2>
        <p className="admin-cc-block__lede">{OPS_DO_LEDE}</p>
        <div className="admin-cc-actions">
          {OPS_QUICK_ACTIONS.map((action) => {
            const figure = opsQuickActionFigure(action.id, actionSnap);
            const href = quickHref[action.id];
            const inner = (
              <>
                <span className="admin-cc-action__label">{action.label}</span>
                <span className="admin-cc-action__hint">{action.hint}</span>
                {figure ? <span className="admin-cc-action__figure">{figure}</span> : null}
              </>
            );
            if (href) {
              return (
                <Link key={action.id} href={href} className="admin-cc-action">
                  {inner}
                </Link>
              );
            }
            return (
              <button key={action.id} type="button" className="admin-cc-action" onClick={() => runQuickAction(action.id)}>
                {inner}
              </button>
            );
          })}
        </div>

        <div className="admin-cc-work" id="admin-photos-checklist">
          <div className="admin-cc-work__head">
            <h3>Checklist de fotos</h3>
            <div className="admin-cc-work__actions">
              <button type="button" className="btn ghost" onClick={() => openCatalogPhotoQueue()}>
                Abrir fila no Catálogo
              </button>
              <button type="button" className="btn ghost" onClick={() => void downloadProductsNeedingPhotosCsv()}>
                Baixar CSV
              </button>
            </div>
          </div>
          <p className="admin-cc-work__note">
            Produtos do snapshot com foto ausente ou host placeholder. Nenhuma imagem é inventada.
          </p>
          {ops?.catalog?.placeholderProducts?.length ? (
            <ul className="admin-cc-photo-list">
              {ops.catalog.placeholderProducts.map((p) => {
                const reason = p.reason || (p.imageUrl && p.imageUrl.trim() ? 'placeholder' : 'missing');
                return (
                  <li key={p.id} className="admin-cc-photo">
                    <div>
                      <strong>{p.name}</strong>{' '}
                      <span className={`admin-chip-status admin-chip-status--${reason === 'missing' ? 'danger' : 'warn'}`}>
                        {reason === 'missing' ? 'Sem foto' : 'Placeholder'}
                      </span>
                      <div className="admin-cc-photo__id">
                        <code>{p.id}</code>
                      </div>
                      <div className="admin-cc-photo__url">
                        {p.imageUrl ? `URL atual: ${p.imageUrl}` : 'URL atual: (vazia)'}
                      </div>
                    </div>
                    <button type="button" className="btn" onClick={() => startEditById(p.id)}>
                      Trocar foto
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="admin-cc-empty">
              {ready
                ? 'Nenhum produto com placeholder ou foto ausente neste snapshot.'
                : 'A lista aparece quando o snapshot carregar.'}
            </p>
          )}
        </div>
      </section>

      <section id="admin-reconciliations" className="admin-cc-block" aria-label="Reconciliações">
        <div className="admin-cc-work__head">
          <h2 className="admin-cc-block__title">Reconciliações</h2>
          <button type="button" className="btn ghost" disabled={reconBusy} onClick={() => void loadReconciliations()}>
            {reconBusy ? 'Atualizando…' : 'Atualizar lista'}
          </button>
        </div>
        <p className="admin-cc-block__lede">
          Webhooks que não aplicaram o pagamento no pedido: órfãos (sem Payment local) e divergência de
          valor ou referência (`GET /admin/payments/reconciliations`). Somente revisão humana — sem
          estorno, cancelamento ou ajuste de estoque automático.
        </p>
        <p className="admin-cc-work__note">
          Abertas no snapshot: {opsCountOrDash(ops?.reconciliations?.openCount, ready)} · listadas:{' '}
          {reconciliations.length}
        </p>
        <div className="admin-cc-recon-list">
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
            <article key={r.id} className="admin-cc-recon">
              <div className="admin-cc-recon__top">
                <strong>{r.reason || 'reconciliação'}</strong>
                <span className="admin-chip-status admin-chip-status--danger">{r.status}</span>
              </div>
              <p>
                providerStatus: {r.providerStatus || '—'}
                {r.externalReference ? ` · ref ${r.externalReference}` : ''}
                {'publicId' in r && r.publicId ? ` · publicId ${r.publicId}` : ''}
                {'externalId' in r && r.externalId ? ` · ext ${r.externalId}` : ''}
                {'amount' in r && r.amount != null ? ` · ${brl(Number(r.amount))}` : ''}
                {'expectedPayment' in r && r.expectedPayment != null
                  ? ` · esperado ${brl(Number(r.expectedPayment))}`
                  : ''}
                {'expectedOrder' in r && r.expectedOrder != null && r.expectedOrder !== r.expectedPayment
                  ? ` · total pedido ${brl(Number(r.expectedOrder))}`
                  : ''}
              </p>
              <p className="admin-cc-recon__id">
                id {r.id} · {r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '—'}
              </p>
              <p className="admin-cc-recon__action">
                Conferir no provedor (ref/publicId) e decidir manualmente. Não executar estorno ou
                cancelamento daqui.
              </p>
            </article>
          ))}
          {!reconciliations.length && !ops?.reconciliations?.recent?.length ? (
            <p className="admin-cc-empty">
              {ready ? 'Nenhuma reconciliação aberta.' : 'A fila aparece quando o snapshot carregar.'}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
