import Link from 'next/link';
import type { Metadata } from 'next';
import { interestFreeInstallmentClaim } from '@/lib/pricing';
import {
  MARKETPLACE_PHASE1_NOTE,
  MARKETPLACE_PHASE2_NOTE,
  MARKETPLACE_PHASE3_NOTE,
  MARKETPLACE_V1_NOT_BUILT,
  marketplaceEmptySellersCopy,
  marketplaceIntro,
  marketplaceSellersHeading,
  sellerProductCountLabel,
} from '@/lib/marketplace-copy';
import { StorefrontEmpty } from '@/components/storefront/StorefrontEmpty';
import { fetchPublicSellers } from '@/lib/storefront';
import { MARKETPLACE_SEO, storefrontPageMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = storefrontPageMetadata(MARKETPLACE_SEO);

export default async function MarketplacePage() {
  const sellers = await fetchPublicSellers();
  const heading = marketplaceSellersHeading(sellers);
  const intro = marketplaceIntro(sellers);

  return (
    <div style={{ padding: '22px 0', maxWidth: 760 }}>
      <h1>Marketplace</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        {intro} PIX 5% off e {interestFreeInstallmentClaim().toLowerCase()} no checkout único da
        loja.
      </p>

      <section className="hero" style={{ padding: 22, marginBottom: 18 }} aria-label="Catálogo">
        <h2 style={{ marginTop: 0, fontSize: 20 }}>Catálogo</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Eletro, celulares, informática, eletrodomésticos, casa e esporte. O pedido, o frete e o
          pagamento (PIX ou cartão) continuam unificados — um carrinho, um pedido.
        </p>
        <div className="actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link className="btn" href="/produtos">
            Ver produtos
          </Link>
          <Link className="btn ghost" href="/departamento/ofertas">
            Ofertas
          </Link>
          <Link className="btn ghost" href="/">
            Início
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }} aria-label={heading}>
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{heading}</h2>
          {sellers.length ? (
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, lineHeight: 1.7 }}>
              {sellers.map((s) => {
                const countLabel = sellerProductCountLabel(s.productCount);
                return (
                  <li key={s.id}>
                    <Link href={`/produtos?seller=${encodeURIComponent(s.slug)}`} style={{ color: 'var(--primary-dark)' }}>
                      {s.name}
                    </Link>
                    {countLabel ? <span className="muted"> · {countLabel}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <StorefrontEmpty
              kicker="Marketplace"
              title={marketplaceEmptySellersCopy().title}
              body={marketplaceEmptySellersCopy().body}
              actions={[
                { href: '/produtos', label: 'Ver produtos' },
                { href: '/suporte', label: 'Falar com a loja', variant: 'ghost' },
              ]}
            />
          )}
          <p className="muted" style={{ lineHeight: 1.6, marginBottom: 0 }}>
            É vendedor e já tem acesso? Entre no{' '}
            <Link href="/vendedor" style={{ color: 'var(--primary-dark)' }}>
              portal do vendedor
            </Link>
            . Novos parceiros entram só pelo admin (criar vendedor + vincular dono) — não criamos
            vendedores fictícios no catálogo.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }} aria-label="O que o marketplace v1 faz">
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>O que já funciona (v1)</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Etiqueta <strong style={{ color: 'var(--text)' }}>Vendido por</strong> no catálogo e na página do produto</li>
            <li>Admin: criar / listar / ativar / suspender vendedores e vincular dono</li>
            <li>Portal /vendedor: meus produtos, pedidos e comissões (só os seus)</li>
            <li>Ledger de comissão no pedido pago + repasse PIX manual (aprovar / marcar pago / CSV)</li>
            <li>Checkout com um vendedor por pedido (carrinho misto bloqueado)</li>
          </ul>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }} aria-label="O que o v1 não faz">
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>O que o v1 não faz</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {MARKETPLACE_V1_NOT_BUILT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="muted" style={{ lineHeight: 1.6, marginBottom: 0, marginTop: 12 }}>
            {MARKETPLACE_PHASE1_NOTE} {MARKETPLACE_PHASE2_NOTE} {MARKETPLACE_PHASE3_NOTE} O
            repasse v1 (PIX manual) continua para linhas sem application_fee.
          </p>
        </div>
      </section>

      <p className="muted" style={{ fontSize: 14 }}>
        Dúvidas? <Link href="/suporte">Suporte</Link> · chat no site · WhatsApp (51) 99625-3766
      </p>
    </div>
  );
}
