'use client';

import Link from 'next/link';
import type { AccountShortcut } from '@/lib/account-menu';

function ShortcutIcon({ id }: { id: AccountShortcut['id'] }) {
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  if (id === 'orders') {
    return (
      <svg {...common}>
        <path d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5 4H3" />
        <circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="18" cy="20" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === 'address') {
    return (
      <svg {...common}>
        <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10z" />
        <circle cx="12" cy="11" r="2" />
      </svg>
    );
  }
  if (id === 'logout') {
    return (
      <svg {...common}>
        <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20h-7A1.5 1.5 0 0 1 10 18.5V17" />
        <path d="M4 12h10M7 9l-3 3 3 3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.8C19 14.6 12 19 12 19z" />
    </svg>
  );
}

/** Circular first-screen actions on Conta. Same routes as the section list. */
export function AccountShortcuts({
  items,
  onLogout,
}: {
  items: AccountShortcut[];
  onLogout?: () => void;
}) {
  return (
    <nav className="account-hub-shortcuts" aria-label="Atalhos da conta">
      {items.map((item) => {
        const inner = (
          <>
            <span className="account-hub-shortcut-ico">
              <ShortcutIcon id={item.id} />
            </span>
            <span className="account-hub-shortcut-label">{item.label}</span>
          </>
        );
        if (item.action === 'logout') {
          return (
            <button key={item.id} type="button" className="account-hub-shortcut" onClick={onLogout}>
              {inner}
            </button>
          );
        }
        return (
          <Link key={item.id} href={item.href} className="account-hub-shortcut">
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
