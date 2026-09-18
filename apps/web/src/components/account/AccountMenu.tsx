'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AccountIconId, AccountMenuItem, AccountMenuSection } from '@/lib/account-menu';

function Icon({ name }: { name: AccountIconId }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'orders':
      return (
        <svg {...common}>
          <path d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5 4H3" />
          <circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="18" cy="20" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'recent':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5L15 15" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19.2c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <path d="M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.8C19 14.6 12 19 12 19z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 16h12l-1.2-2.2V11a4.8 4.8 0 0 0-9.6 0v2.8L6 16z" />
          <path d="M10 18.5a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20h-7A1.5 1.5 0 0 1 10 18.5V17" />
          <path d="M4 12h10M7 9l-3 3 3 3" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...common}>
          <path d="M12 4.5a7.5 7.5 0 0 0-6.5 11.2L5 19.5l3.9-.9A7.5 7.5 0 1 0 12 4.5z" />
          <path d="M9.4 9.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .5.4l.6 1.5c.1.3 0 .5-.2.7l-.4.4c-.2.2-.2.4 0 .6.3.5.8 1 1.4 1.4.2.2.4.2.6 0l.4-.4c.2-.2.4-.3.7-.2l1.5.6c.3.1.4.3.4.5v.5c0 .3 0 .5-.5.7A3.6 3.6 0 0 1 12 16.4 4.4 4.4 0 0 1 9.4 9.6z" />
        </svg>
      );
    case 'support':
      return (
        <svg {...common}>
          <path d="M4.8 13a7.2 7.2 0 0 1 14.4 0" />
          <path d="M4.8 13v3.2A1.8 1.8 0 0 0 6.6 18H8v-5H4.8z" />
          <path d="M19.2 13v3.2A1.8 1.8 0 0 1 17.4 18H16v-5h3.2z" />
          <path d="M12 20.2v-2.2" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4.5v2.2M12 17.3V19.5M4.5 12h2.2M17.3 12H19.5M6.4 6.4l1.6 1.6M16 16l1.6 1.6M17.6 6.4 16 8M8 16l-1.6 1.6" />
        </svg>
      );
    case 'seller':
      return (
        <svg {...common}>
          <path d="M4 10.5 6.2 5h11.6L20 10.5v7A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-7z" />
          <path d="M4 10.5h16" />
          <path d="M9 19v-4h6v4" />
        </svg>
      );
    default:
      return null;
  }
}

function Chevron() {
  return (
    <svg
      className="account-hub-chevron"
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function RowInner({ item }: { item: AccountMenuItem }) {
  return (
    <>
      <span className="account-hub-ico" aria-hidden>
        <Icon name={item.icon} />
      </span>
      <span className="account-hub-label">{item.label}</span>
      <Chevron />
    </>
  );
}

export function AccountMenu({
  sections,
  onLogout,
}: {
  sections: AccountMenuSection[];
  onLogout?: () => void;
}) {
  return (
    <div className="account-hub-sections">
      {sections.map((section) => (
        <section key={section.id} className="account-hub-section" aria-labelledby={`account-sec-${section.id}`}>
          <h2 id={`account-sec-${section.id}`} className="account-hub-sec-title">
            {section.title}
          </h2>
          <div className="account-hub-card">
            {section.items.map((item) => {
              if (item.action === 'logout') {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="account-hub-row"
                    onClick={onLogout}
                  >
                    <RowInner item={item} />
                  </button>
                );
              }
              const extra: { target?: string; rel?: string } = item.external
                ? { target: '_blank', rel: 'noreferrer' }
                : {};
              const row: ReactNode = <RowInner item={item} />;
              return (
                <Link key={item.id} href={item.href} className="account-hub-row" {...extra}>
                  {row}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
