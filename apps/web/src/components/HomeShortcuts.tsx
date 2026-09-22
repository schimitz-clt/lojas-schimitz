'use client';

import Link from 'next/link';
import { homeQuickShortcuts, type HomeShortcutId } from '@/lib/home-ux';
import { useSessionUser } from '@/lib/use-session-user';
import { HomeShortcutGlyph } from '@/components/icons/StorefrontIcons';

function ShortcutIcon({ id }: { id: HomeShortcutId }) {
  return <HomeShortcutGlyph id={id} />;
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
