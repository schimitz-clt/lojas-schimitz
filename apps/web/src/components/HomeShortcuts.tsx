'use client';

import Link from 'next/link';
import { homeQuickShortcuts, type HomeShortcutId } from '@/lib/home-ux';
import { useSessionUser } from '@/lib/use-session-user';

function ShortcutIcon({ id }: { id: HomeShortcutId }) {
  if (id === 'cupons') {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4V7.5zm6.2 2.2.8.8.8-.8a1 1 0 1 1 1.4 1.4l-.8.8.8.8a1 1 0 0 1-1.4 1.4l-.8-.8-.8.8a1 1 0 1 1-1.4-1.4l.8-.8-.8-.8a1 1 0 0 1 1.4-1.4z"
        />
      </svg>
    );
  }
  if (id === 'ofertas') {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M12.6 2.2a1 1 0 0 1 .7.3l8.2 8.2a1 1 0 0 1 0 1.4l-9.4 9.4a1 1 0 0 1-1.4 0L2.5 13.3a1 1 0 0 1-.3-.7V3.2A1 1 0 0 1 3.2 2.2h9.4zM7.2 6.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"
        />
      </svg>
    );
  }
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4 4h6.5v6.5H4V4zm9.5 0H20v6.5h-6.5V4zM4 13.5h6.5V20H4v-6.5zM13.5 13.5H20V20h-6.5v-6.5z"
      />
    </svg>
  );
}

/** Circular shortcuts above the existing Categorias strip. Does not replace it. */
export function HomeShortcuts() {
  const { user } = useSessionUser();
  const items = homeQuickShortcuts(user?.role);

  return (
    <nav className="home-shortcuts" aria-label="Atalhos">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="home-shortcut" title={item.description}>
          <span className="home-shortcut-ico">
            <ShortcutIcon id={item.id} />
          </span>
          <span className="home-shortcut-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
