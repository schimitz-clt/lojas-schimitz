import { Suspense, type ReactNode } from 'react';
import { AdminConsole } from '@/components/admin/AdminConsole';
import '@/components/admin/admin-theme.css';

export const metadata = { title: 'Admin' };

function AdminBootFallback() {
  return (
    <div className="admin-app">
      <header className="admin-header">
        <div className="admin-header__brand">
          SCHIMITZ <span>Admin</span>
        </div>
        <div className="admin-header__meta">Console operacional</div>
      </header>
      <p className="admin-main__sub" style={{ padding: 24 }}>
        Carregando console…
      </p>
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
