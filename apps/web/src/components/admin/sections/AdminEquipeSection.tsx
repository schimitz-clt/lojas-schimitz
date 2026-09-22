'use client';

import { currentUser } from '@/lib/api';
import { ENTERPRISE_MISSING, textOrDash } from '@/lib/admin-enterprise-ui';
import { formatAdminDate } from '@/lib/admin-customers-ui';
import {
  EQUIPE_DO_LEDE,
  EQUIPE_EVIDENCE_LEDE,
  EQUIPE_NOW_LEDE,
  equipePrimeModel,
} from '@/lib/admin-prime-sections-ui';
import { AdminPrimeCommand, scrollAdminAnchor } from '@/components/admin/AdminPrimeCommand';
import { AdminStatusChip } from '@/components/admin/AdminStatusChip';
import { adminUserStatusLabel, adminUserStatusTone } from '@/lib/admin-pro-ui';
import { useAdminConsole } from '@/components/admin/admin-console-context';

const ANCHOR: Record<string, string> = {
  admins_none_active: 'admin-equipe-list',
  admins_inactive: 'admin-equipe-list',
  create: 'admin-equipe-form',
  list: 'admin-equipe-list',
  total: 'admin-equipe-list',
  active: 'admin-equipe-list',
  inactive: 'admin-equipe-list',
  roles: 'admin-equipe-list',
};

export function AdminEquipeSection() {
  const { admins, adminForm, setAdminForm, savingAdmin, adminBusyId, saveAdmin, toggleAdminStatus, storePayload, load } =
    useAdminConsole();

  const model = equipePrimeModel({
    load: storePayload,
    admins: storePayload === 'ready' ? admins : null,
  });

  function go(id: string) {
    const anchor = ANCHOR[id];
    if (anchor) scrollAdminAnchor(anchor);
  }

  return (
    <>
      <AdminPrimeCommand
        eyebrow="Equipe"
        title="Administradores, um GET /admin/admins."
        endpoint="GET /admin/admins · POST /admin/admins · PATCH /admin/admins/:id/status"
        busy={savingAdmin}
        onRefresh={() => void load()}
        nowLede={EQUIPE_NOW_LEDE}
        summary={model.summary}
        kpis={model.kpis}
        onKpi={go}
        load={storePayload}
        attention={model.attention}
        signals={model.signals}
        onAttention={go}
        doLede={EQUIPE_DO_LEDE}
        actions={model.actions}
        onAction={go}
      />

      <div className="admin-section-panel" id="admin-equipe-evidence">
        <p className="admin-ent-kicker">Evidência</p>
        <h2 className="admin-cc-block__title">Quem entra no painel</h2>
        <p className="admin-cc-block__lede">{EQUIPE_EVIDENCE_LEDE}</p>
        <p className="admin-ent-note">
          Desativar impede o login e não apaga o cadastro. Você não pode desativar a si mesmo nem o último admin ativo.
        </p>

        <section className="admin-card-pro" id="admin-equipe-form">
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

        <h3 className="admin-section-heading" id="admin-equipe-list">
          Equipe ({storePayload === 'ready' ? admins.length : ENTERPRISE_MISSING})
        </h3>
        <div className="admin-dense-list">
          {storePayload === 'ready'
            ? admins.map((a) => {
                const me = currentUser();
                const isMe = me?.id === a.id;
                const active = a.status === 'active';
                return (
                  <div key={a.id} className={`admin-dense-row${active ? '' : ' admin-dense-row--muted'}`}>
                    <div className="admin-dense-row__main">
                      <div className="admin-dense-row__title">
                        <b>{textOrDash(a.name)}</b>
                        {isMe ? <AdminStatusChip label="Você" tone="accent" /> : null}
                        <AdminStatusChip label={adminUserStatusLabel(a.status)} tone={adminUserStatusTone(a.status)} />
                        <AdminStatusChip label={textOrDash(a.role)} tone="neutral" />
                      </div>
                      <div className="admin-dense-row__meta">
                        {textOrDash(a.email)}
                        {' · '}
                        desde {formatAdminDate(a.createdAt)}
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
              })
            : null}
          {storePayload === 'ready' && !admins.length ? <p className="admin-empty">Nenhum administrador listado.</p> : null}
          {storePayload !== 'ready' ? (
            <p className="admin-empty">
              {storePayload === 'error' ? 'Equipe indisponível. Nenhum admin foi estimado.' : 'Lendo GET /admin/admins…'}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
