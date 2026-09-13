'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api, currentUser } from '@/lib/api';

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  ico: string;
  badge?: number;
};

export function BottomNav() {
  const path = usePathname() || '/';
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState<ReturnType<typeof currentUser>>(null);

  useEffect(() => {
    setUser(currentUser());
    api<{ itemCount?: number }>('/cart')
      .then((d) => setCartCount(d.itemCount || 0))
      .catch(() => setCartCount(0));
    const onCart = () => {
      api<{ itemCount?: number }>('/cart')
        .then((d) => setCartCount(d.itemCount || 0))
        .catch(() => {});
    };
    window.addEventListener('sch-cart-updated', onCart);
    return () => window.removeEventListener('sch-cart-updated', onCart);
  }, []);

  const contaHref = user ? '/conta' : '/entrar';

  const items: NavItem[] = [
    {
      href: '/',
      label: 'Início',
      ico: '⌂',
      match: (p) => p === '/',
    },
    {
      href: '/produtos',
      label: 'Buscar',
      ico: '⌕',
      match: (p) =>
        p.startsWith('/produtos') ||
        p.startsWith('/departamento') ||
        p.startsWith('/marketplace'),
    },
    {
      href: '/carrinho',
      label: 'Carrinho',
      ico: '🛒',
      badge: cartCount,
      match: (p) => p.startsWith('/carrinho') || p.startsWith('/checkout'),
    },
    {
      href: '/favoritos',
      label: 'Favoritos',
      ico: '♥',
      match: (p) => p.startsWith('/favoritos'),
    },
    {
      href: contaHref,
      label: 'Conta',
      ico: '👤',
      match: (p) =>
        p.startsWith('/conta') ||
        p.startsWith('/entrar') ||
        p.startsWith('/cadastro') ||
        p.startsWith('/pedidos'),
    },
  ];

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map((item) => {
        const active = item.match(path);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={active ? 'bottom-nav-item active' : 'bottom-nav-item'}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav-ico" aria-hidden>
              {item.ico}
              {item.badge && item.badge > 0 ? (
                <span className="bottom-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
              ) : null}
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
