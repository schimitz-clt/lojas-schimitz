'use client';

import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminConsoleContext } from '@/components/admin/admin-console-context';
import { useAdminConsoleState } from '@/components/admin/admin-console-state';
import { AdminAvaliacoesSection } from '@/components/admin/sections/AdminAvaliacoesSection';
import { AdminCatalogoSection } from '@/components/admin/sections/AdminCatalogoSection';
import { AdminClientesSection } from '@/components/admin/sections/AdminClientesSection';
import { AdminCuponsSection } from '@/components/admin/sections/AdminCuponsSection';
import { AdminEquipeSection } from '@/components/admin/sections/AdminEquipeSection';
import { AdminFreteSection } from '@/components/admin/sections/AdminFreteSection';
import { AdminMarketplaceSection } from '@/components/admin/sections/AdminMarketplaceSection';
import { AdminOpsSection } from '@/components/admin/sections/AdminOpsSection';
import { AdminPedidosSection } from '@/components/admin/sections/AdminPedidosSection';
import { AdminVendasSection } from '@/components/admin/sections/AdminVendasSection';
import { AdminVitrineSection } from '@/components/admin/sections/AdminVitrineSection';
import { ADMIN_LOGOUT_LABEL, adminLogoutHref } from '@/lib/admin-sections';
import { clearSession } from '@/lib/api';

const SECTION_VIEW = {
  ops: AdminOpsSection,
  pedidos: AdminPedidosSection,
  catalogo: AdminCatalogoSection,
  clientes: AdminClientesSection,
  vendas: AdminVendasSection,
  frete: AdminFreteSection,
  cupons: AdminCuponsSection,
  vitrine: AdminVitrineSection,
  avaliacoes: AdminAvaliacoesSection,
  marketplace: AdminMarketplaceSection,
  equipe: AdminEquipeSection,
} as const;

/** Same session wipe as Conta (`clearSession` → POST /auth/logout + cookie). */
function AdminLogoutButton() {
  return (
    <button
      type="button"
      className="admin-header__logout"
      onClick={() => {
        clearSession();
        window.location.href = adminLogoutHref();
      }}
    >
      {ADMIN_LOGOUT_LABEL}
    </button>
  );
}

export function AdminConsole({ children }: { children?: ReactNode }) {
  const state = useAdminConsoleState();
  const View = SECTION_VIEW[state.adminSection];
  return (
    <AdminConsoleContext.Provider value={state}>
      <AdminShell
        section={state.adminSection}
        onSectionChange={state.goAdminSection}
        badges={state.shellBadges}
        headerActions={<AdminLogoutButton />}
      >
        {state.err ? <div className="alert">{state.err}</div> : null}
        {state.msg ? <div className="ok">{state.msg}</div> : null}
        <View />
        {children}
      </AdminShell>
    </AdminConsoleContext.Provider>
  );
}
