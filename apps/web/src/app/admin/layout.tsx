import { Suspense, type ReactNode } from 'react';
import { AdminConsole } from '@/components/admin/AdminConsole';
import { AdminBrandMark } from '@/components/admin/AdminShell';
import '@/components/admin/admin-theme.css';

export const metadata = { title: 'Admin' };

function AdminBootFallback() {
  return (
    <div className="admin-app">
      <header className="admin-header">
        <AdminBrandMark />
        <div className="admin-header__meta">Console operacional</div>
      </header>
      <div className="admin-main">
        <div className="admin-shell-state admin-shell-state--loading" role="status">
          <p className="admin-shell-state__title">Carregando console…</p>
          <p>A navegação entra assim que a sessão do admin estiver pronta.</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminBootFallback />}>
      <AdminConsole>{children}</AdminConsole>
    </Suspense>
  );
}
