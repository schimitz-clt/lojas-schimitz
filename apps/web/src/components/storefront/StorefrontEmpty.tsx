import Link from 'next/link';
import type { ReactNode } from 'react';

export type StorefrontEmptyAction = {
  href: string;
  label: string;
  external?: boolean;
  variant?: 'primary' | 'ghost';
};

/**
 * Shared empty shelf. Real routes and WhatsApp only — no invented products.
 */
export function StorefrontEmpty({
  kicker,
  title,
  body,
  actions,
  children,
}: {
  kicker?: string;
  title: string;
  body: string;
  actions?: StorefrontEmptyAction[];
  children?: ReactNode;
}) {
  return (
    <div className="catalog-empty sf-catalog-empty sf-empty-panel" role="status">
      {kicker ? <p className="sf-empty-kicker">{kicker}</p> : null}
      <p className="sf-catalog-empty-title">{title}</p>
      <p className="muted sf-catalog-empty-body">{body}</p>
      {actions && actions.length > 0 ? (
        <div className="sf-catalog-empty-actions">
          {actions.map((action) => {
            const className = `btn${action.variant === 'ghost' ? ' ghost' : ''}`;
            if (action.external) {
              return (
                <a
                  key={`${action.href}-${action.label}`}
                  className={className}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {action.label}
                </a>
              );
            }
            return (
              <Link key={`${action.href}-${action.label}`} className={className} href={action.href}>
                {action.label}
              </Link>
            );
          })}
        </div>
      ) : null}
      {children}
    </div>
  );
}
