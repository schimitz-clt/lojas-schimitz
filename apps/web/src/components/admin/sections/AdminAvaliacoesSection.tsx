'use client';

import Link from 'next/link';
import { ENTERPRISE_MISSING, textOrDash } from '@/lib/admin-enterprise-ui';
import { formatAdminDate } from '@/lib/admin-customers-ui';
import {
  AVALIACOES_DO_LEDE,
  AVALIACOES_EVIDENCE_LEDE,
  AVALIACOES_NOW_LEDE,
  avaliacoesPrimeModel,
} from '@/lib/admin-prime-sections-ui';
import { AdminPrimeCommand, scrollAdminAnchor } from '@/components/admin/AdminPrimeCommand';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import { reviewStars, reviewStatusLabel, reviewStatusTone } from '@/lib/admin-pro-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';

export function AdminAvaliacoesSection() {
  const { reviews, reviewBusyId, setReviewStatus, deleteReview, storePayload, load } = useAdminConsole();
  const model = avaliacoesPrimeModel({
    load: storePayload,
    reviews: storePayload === 'ready' ? reviews : null,
  });

  function go() {
    scrollAdminAnchor('admin-avaliacoes-list');
  }

  return (
    <>
      <AdminPrimeCommand
        eyebrow="Avaliações"
        title="Moderação do que GET /admin/reviews já devolve."
        endpoint="GET /admin/reviews · PATCH /admin/reviews/:id · DELETE /admin/reviews/:id"
        busy={Boolean(reviewBusyId)}
        onRefresh={() => void load()}
        nowLede={AVALIACOES_NOW_LEDE}
        summary={model.summary}
        kpis={model.kpis}
        onKpi={go}
        load={storePayload}
        attention={model.attention}
        signals={model.signals}
        onAttention={go}
        doLede={AVALIACOES_DO_LEDE}
        actions={model.actions}
        onAction={go}
      />

      <div className="admin-section-panel" id="admin-avaliacoes-evidence">
        <p className="admin-ent-kicker">Evidência</p>
        <h2 className="admin-cc-block__title">Notas publicadas e ocultas</h2>
        <p className="admin-cc-block__lede">{AVALIACOES_EVIDENCE_LEDE}</p>
        <p className="admin-ent-note">
          Não há status de moderação além de published e hidden. Excluir continua o DELETE já desta tela.
        </p>
        <div className="admin-dense-list" id="admin-avaliacoes-list">
          {storePayload === 'ready'
            ? reviews.map((r) => (
                <div key={r.id} className={`admin-dense-row${r.status === 'hidden' ? ' admin-dense-row--muted' : ''}`}>
                  <div className="admin-dense-row__main">
                    <div className="admin-dense-row__title">
                      <b aria-label={`${r.rating} de 5`}>{reviewStars(r.rating)}</b>
                      <AdminStatusChip label={reviewStatusLabel(r.status)} tone={reviewStatusTone(r.status)} />
                    </div>
                    <div className="admin-dense-row__meta" style={{ marginTop: 4 }}>
                      <b style={{ color: 'var(--admin-ink)' }}>{textOrDash(r.user?.name)}</b> ({textOrDash(r.user?.email)})
                    </div>
                    <div className="admin-dense-row__meta">
                      Produto:{' '}
                      {r.product?.slug ? (
                        <Link href={`/produto/${r.product.slug}`}>{textOrDash(r.product.name)}</Link>
                      ) : (
                        textOrDash(r.product?.name)
                      )}
                      {' · '}
                      {formatAdminDate(r.createdAt)}
                    </div>
                    {r.body ? (
                      <p className="admin-dense-row__body">{r.body}</p>
                    ) : (
                      <p className="admin-dense-row__meta" style={{ marginTop: 6 }}>
                        Sem comentário
                      </p>
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
              ))
            : null}
          {storePayload === 'ready' && !reviews.length ? <p className="admin-empty">Nenhuma avaliação ainda.</p> : null}
          {storePayload !== 'ready' ? (
            <p className="admin-empty">
              {storePayload === 'error'
                ? 'Avaliações indisponíveis. Nenhuma nota foi estimada.'
                : 'Lendo GET /admin/reviews…'}
            </p>
          ) : null}
        </div>
        {storePayload !== 'ready' ? <p className="admin-ent-note">{ENTERPRISE_MISSING}</p> : null}
      </div>
    </>
  );
}
