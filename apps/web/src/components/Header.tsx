'use client';
import Link from 'next/link';
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { api, userAccountLabel, waLink } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';
import { cardInstallmentClaim } from '@/lib/pricing';
import { CompareHeaderLink } from '@/components/compare/CompareHeaderLink';
import { SearchBox } from '@/components/SearchBox';
import { HomeDeliveryBar } from '@/components/HomeDeliveryBar';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import { formatWishlistBadge } from '@/lib/wishlist-ui';
import { accountAddressToEdit, type AccountAddressRecord } from '@/lib/account-menu';
import { deliveryBarCopy } from '@/lib/home-ux';
import {
  STOREFRONT_CEP_KEY,
  formatCepInput,
  isCompleteCep,
  persistStoredCep,
  readStoredCep,
} from '@/lib/pdp-trust';
import { IconBell, IconCart, IconHeart, IconSparkles, IconUser } from '@/components/icons/StorefrontIcons';
import { N5_BRAND } from '@/components/brand/SchimitzMark';
import {
  catalogSearchBackHref,
  isCatalogSearchResults,
} from '@/lib/storefront-pro';
import { chromeNeedsVvHeight, chromeStackHeight, chromeVisualTop, SEARCH_RESULTS_CLASS } from '@/lib/search-chrome';
import { configuredPromoLines } from '@/lib/retail-home';

/**
 * Mirrors ?q= into the header (catalog search-results mode). Isolated because useSearchParams()
 * makes everything up to the nearest Suspense boundary client-only on statically rendered pages.
 * Same logic/deps as the previous inline effect.
 */
function CatalogSearchSync({
  pathname,
  onSync,
}: {
  pathname: string;
  onSync: (q: string, results: boolean) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const fromUrl = (searchParams.get('q') || '').trim();
    const onCatalog = pathname.startsWith('/produtos');
    if (onCatalog && isCatalogSearchResults(fromUrl)) onSync(fromUrl, true);
    else onSync('', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);
  return null;
}

export function Header() {
  const pathname = usePathname() || '/';
  const { user } = useSessionUser();
  const [qInit, setQInit] = useState('');
  const [searchResults, setSearchResults] = useState(false);
  const [unread, setUnread] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [cep, setCep] = useState('');
  const [editingCep, setEditingCep] = useState(false);
  const [cepDraft, setCepDraft] = useState('');
  const [addresses, setAddresses] = useState<AccountAddressRecord[]>([]);
  const [customPromo, setCustomPromo] = useState<string[] | null>(null);
  const { count: favCount } = useFavorites();
  const favBadge = formatWishlistBadge(favCount);
  const chromeRef = useRef<HTMLDivElement>(null);

  const onCatalogSearchSync = (q: string, results: boolean) => {
    setQInit(q);
    setSearchResults(results);
  };

  useLayoutEffect(() => {
    const el = chromeRef.current;
    const applyHeight = () => {
      const h = chromeStackHeight(el?.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--site-chrome-h', `${h}px`);
    };
    applyHeight();
    document.documentElement.classList.toggle(SEARCH_RESULTS_CLASS, searchResults);
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(applyHeight) : null;
    if (el && ro) ro.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.classList.remove(SEARCH_RESULTS_CLASS);
    };
  }, [searchResults]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let raf = 0;
    let lastTop = Number.NaN;
    let lastHeight = Number.NaN;
    // Só escreve na raiz quando o valor MUDA e no máximo 1x por frame: setProperty em :root invalida o
    // estilo da página toda, e a barra de endereço do celular dispara resize/scroll do visualViewport
    // a cada frame durante a rolagem.
    const apply = () => {
      raf = 0;
      const top = chromeVisualTop(vv.offsetTop);
      if (top !== lastTop) {
        lastTop = top;
        if (top > 0) root.style.setProperty('--vv-top', `${top}px`);
        else root.style.removeProperty('--vv-top');
      }
      const height = chromeNeedsVvHeight(window.innerHeight, vv.height) ? chromeStackHeight(vv.height) : 0;
      if (height !== lastHeight) {
        lastHeight = height;
        if (height > 0) root.style.setProperty('--vv-height', `${height}px`);
        else root.style.removeProperty('--vv-height');
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    vv.addEventListener('scroll', schedule);
    vv.addEventListener('resize', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener('scroll', schedule);
      vv.removeEventListener('resize', schedule);
    };
  }, []);

  useEffect(() => {
    api<{ promoLines?: unknown }>('/store/settings')
      .then((settings) => setCustomPromo(configuredPromoLines(settings?.promoLines)))
      .catch(() => setCustomPromo(null));
  }, []);

  useEffect(() => {
    try {
      const saved = readStoredCep(localStorage);
      setCep(saved);
      setCepDraft(saved);
    } catch {
      /* ignore */
    }
    api<{ itemCount?: number }>('/cart')
      .then((d) => setCartCount(d.itemCount || 0))
      .catch(() => setCartCount(0));
    const onCart = () => {
      api<{ itemCount?: number }>('/cart')
        .then((d) => setCartCount(d.itemCount || 0))
        .catch(() => {});
    };
    window.addEventListener('sch-cart-updated', onCart);
    return () => {
      window.removeEventListener('sch-cart-updated', onCart);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setAddresses([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      api<AccountAddressRecord[]>('/me/addresses')
        .then((list) => {
          if (cancelled) return;
          const rows = Array.isArray(list) ? list : [];
          setAddresses(rows);
          const saved = accountAddressToEdit(rows);
          const next = formatCepInput(saved?.cep || '');
          if (!isCompleteCep(next)) return;
          setCep(next);
          setCepDraft((draft) => (editingCep ? draft : next));
          persistStoredCep(next, localStorage);
        })
        .catch(() => {
          if (!cancelled) setAddresses([]);
        });
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, [user, editingCep]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    api<{ unreadCount: number }>('/notifications?limit=1')
      .then((d) => setUnread(d.unreadCount || 0))
      .catch(() => setUnread(0));
  }, [user]);

  function saveCep(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const next = formatCepInput(cepDraft);
    const digits = next.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCep(next);
    setCepDraft(next);
    try {
      localStorage.setItem(STOREFRONT_CEP_KEY, next);
    } catch {
      /* ignore */
    }
    setEditingCep(false);
  }

  function focusVisibleCep() {
    window.setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('[data-cep-input]');
      for (const el of inputs) {
        if (el.offsetParent !== null) {
          el.focus();
          break;
        }
      }
    }, 0);
  }

  const delivery = deliveryBarCopy({ addresses, storedCep: cep });

  return (
    <div className="site-chrome" ref={chromeRef}>
      {/* Only this null-rendering child reads ?q=, so the header itself is server-rendered on
          static routes (was client-only → popped in after JS: CLS 0.14 + late LCP on /produtos). */}
      <Suspense fallback={null}>
        <CatalogSearchSync pathname={pathname} onSync={onCatalogSearchSync} />
      </Suspense>
      <div className="topbar" aria-label="Benefícios">{customPromo?.map((line, i) => <span key={i}>{i ? ' · ' : ''}{line}</span>) ?? <><span>Frete grátis em POA</span><span className="topbar-sep" aria-hidden>·</span><span>5% OFF no PIX</span><span className="topbar-sep" aria-hidden>·</span><span>{cardInstallmentClaim()}</span></>}</div>
      <div className={`site-chrome-head${searchResults ? ' is-search-results' : ''}`}>
      <header className="header">
        <div className="wrap">
          <div className="header-row">
            {searchResults ? (
              <Link
                href={catalogSearchBackHref()}
                className="hdr-search-back"
                aria-label="Voltar ao início"
                prefetch={true}
              >
                <span aria-hidden>←</span>
              </Link>
            ) : null}
            <Link
              href="/"
              className={`logo${searchResults ? ' logo-search-hide' : ''}`}
              aria-label="Lojas Schimitz — início"
              prefetch={true}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={N5_BRAND.symbolOnNavy}
                width={38}
                height={36}
                alt=""
                aria-hidden
                className="logo-mark logo-mark-n5"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={N5_BRAND.lockupOnNavy}
                width={170}
                height={34}
                alt="Lojas Schimitz"
                className="logo-lockup"
              />
            </Link>

            <SearchBox initialQuery={qInit} />

            {editingCep ? (
              <form className="hdr-cep-form hdr-hide-sm" onSubmit={saveCep}>
                <input
                  data-cep-input
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cepDraft}
                  onChange={(e) => setCepDraft(formatCepInput(e.target.value))}
                  aria-label="Informe seu CEP"
                />
                <button type="submit">OK</button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCep(false);
                    setCepDraft(cep);
                  }}
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="hdr-cep hdr-hide-sm"
                onClick={() => {
                  setEditingCep(true);
                  focusVisibleCep();
                }}
                aria-label="Informar CEP para frete"
              >
                <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 11 }}>
                  Informe seu CEP
                </span>
                <strong>{cep || 'Calcular frete'}</strong>
              </button>
            )}

            <div className="actions">
              <button
                type="button"
                className="hdr-link hdr-ai"
                aria-label="Abrir Schimitz AI"
                onClick={() => window.dispatchEvent(new Event('sch-ai-toggle'))}
              >
                <span className="hdr-link-ico" aria-hidden>
                  <IconSparkles size={17} />
                </span>
                <span className="hdr-link-label">AI</span>
              </button>
              <Link className="hdr-link hdr-hide-sm" href={user ? '/conta' : '/entrar'} prefetch={true}>
                <span className="hdr-link-ico" aria-hidden>
                  <IconUser size={17} />
                </span>
                {user ? userAccountLabel(user) : 'Entrar'}
              </Link>
              <Link className="hdr-link hdr-hide-sm" href="/conta/salvos" prefetch={true}>
                <span className="hdr-link-ico" aria-hidden>
                  <IconHeart size={17} />
                </span>
                Salvos
                {favBadge ? <span className="hdr-badge">{favBadge}</span> : null}
              </Link>
              <CompareHeaderLink />
              <Link className="hdr-link" href="/carrinho" prefetch={true}>
                <span className="hdr-link-ico" aria-hidden>
                  <IconCart size={17} />
                </span>
                <span className="hdr-link-label">Carrinho</span>
                {cartCount > 0 ? (
                  <span className="hdr-badge">{cartCount > 99 ? '99+' : cartCount}</span>
                ) : null}
              </Link>
              {user ? (
                <Link className="hdr-link hdr-hide-sm" href="/notificacoes" title="Notificações" prefetch={true}>
                  <span className="hdr-link-ico" aria-hidden>
                    <IconBell size={17} />
                  </span>
                  Avisos
                  {unread > 0 ? (
                    <span className="hdr-badge">{unread > 99 ? '99+' : unread}</span>
                  ) : null}
                </Link>
              ) : null}
              <a className="btn wa hdr-hide-sm" href={waLink()} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </div>
          </div>
          <HomeDeliveryBar
            view={delivery}
            loggedIn={Boolean(user)}
            editing={editingCep}
            draft={cepDraft}
            onDraft={(value) => setCepDraft(formatCepInput(value))}
            onSubmit={saveCep}
            onCancel={() => {
              setEditingCep(false);
              setCepDraft(cep);
            }}
            onEdit={() => {
              setEditingCep(true);
              focusVisibleCep();
            }}
          />
        </div>
        <div className="nav-depts">
          <div className="wrap">
            <nav className="nav" aria-label="Departamentos">
              <Link href="/produtos" className="nav-hot" prefetch={true}>
                Todas as categorias
              </Link>
              <Link href="/departamento/ofertas" prefetch={true}>
                Ofertas
              </Link>
              <Link href="/departamento/celulares" prefetch={true}>
                Celulares
              </Link>
              <Link href="/departamento/eletrodomesticos" prefetch={true}>
                Eletrodomésticos
              </Link>
              <Link href="/departamento/informatica" prefetch={true}>
                Informática
              </Link>
              <Link href="/departamento/eletro" prefetch={true}>
                TVs e Áudio
              </Link>
              <Link href="/departamento/casa" prefetch={true}>
                Casa
              </Link>
              <Link href="/departamento/esporte" prefetch={true}>
                Esporte
              </Link>
              <Link href="/marketplace" prefetch={true}>
                Marketplace
              </Link>
            </nav>
          </div>
        </div>
      </header>
      </div>
    </div>
  );
}
