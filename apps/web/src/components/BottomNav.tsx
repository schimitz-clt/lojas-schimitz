'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import { formatWishlistBadge, isWishlistPath } from '@/lib/wishlist-ui';
import { BottomNavGlyph, type BottomNavIconId } from '@/components/icons/StorefrontIcons';

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon?: BottomNavIconId;
  iconSrc?: string;
  badge?: number;
};

export function BottomNav() {
  const path = usePathname() || '/';
  const [cartCount, setCartCount] = useState(0);
  const { count: favCount } = useFavorites();
  const favBadge = formatWishlistBadge(favCount);
  const favBadgeNum = favBadge ? favCount : 0;

  useEffect(() => {
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

  const contaHref = '/conta';

  const items: NavItem[] = [
    {
      href: '/',
      label: 'Início',
      icon: 'home',
      match: (p) => p === '/',
    },
    {
      href: '/produtos',
      label: 'Buscar',
      icon: 'search',
      match: (p) =>
        p.startsWith('/produtos') ||
        p.startsWith('/departamento') ||
        p.startsWith('/marketplace'),
    },
    {
      href: '/carrinho',
      label: 'Sacola',
      icon: 'cart',
      badge: cartCount,
      match: (p) => p.startsWith('/carrinho') || p.startsWith('/checkout'),
    },
    {
      href: '/conta/salvos',
      label: 'Favoritos',
      icon: 'heart',
      badge: favBadgeNum,
      match: (p) => isWishlistPath(p),
    },
    {
      href: contaHref,
      label: 'Conta',
      iconSrc: '/android-chrome-192x192.png',
      match: (p) =>
        (p.startsWith('/conta') && !isWishlistPath(p)) ||
        p.startsWith('/entrar') ||
        p.startsWith('/cadastro') ||
        p.startsWith('/pedidos'),
    },
  ];

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav-dock">
      {items.map((item) => {
        const active = item.match(path);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={active ? 'bottom-nav-item active' : 'bottom-nav-item'}
            aria-current={active ? 'page' : undefined}
            prefetch={true}
          >
            <span className="bottom-nav-ico" aria-hidden>
              {item.iconSrc ? (
                <img
                  className="bottom-nav-brand-ico"
                  src={item.iconSrc}
                  alt=""
                  width={28}
                  height={28}
                />
              ) : item.icon ? (
                <BottomNavGlyph id={item.icon} active={active} />
              ) : null}
              {item.badge && item.badge > 0 ? (
                <span className="bottom-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
              ) : null}
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
