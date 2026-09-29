import Link from 'next/link';
import type { Metadata } from 'next';
import { interestFreeInstallmentClaim } from '@/lib/pricing';
import {
  marketplaceIntro,
  marketplaceSellersHeading,
} from '@/lib/marketplace-copy';
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
        <h2 style={{ marginTop: 0, fontSize: 20 }}>Como comprar</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Eletro, celulares, informática, eletrodomésticos, casa e esporte. O pedido, o frete e o
          pagamento (PIX ou cartão) ficam juntos — um carrinho, um pedido.
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
              {sellers.map((s) => (
                <li key={s.id}>
                  <Link href={`/produtos?seller=${encodeURIComponent(s.slug)}`} style={{ color: 'var(--primary-dark)' }}>
                    {s.name}
                  </Link>
                  {s.productCount != null ? (
                    <span className="muted"> · {s.productCount} produto(s)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              Nenhum vendedor ativo listado no momento.
            </p>
          )}
          <p className="muted" style={{ lineHeight: 1.6, marginBottom: 0 }}>
            Cada anúncio mostra <strong style={{ color: 'var(--text)' }}>Vendido por</strong>. Já é
            parceiro? Entre no{' '}
            <Link href="/vendedor" style={{ color: 'var(--primary-dark)' }}>
              portal do vendedor
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }} aria-label="Compra unificada">
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>O que você encontra aqui</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Quem vende aparece no catálogo e na página do produto</li>
            <li>Um checkout para PIX ou cartão</li>
            <li>Frete calculado no pedido, com regra de Porto Alegre</li>
            <li>Pedidos e atendimento pela Lojas Schimitz</li>
          </ul>
        </div>
      </section>

      <p className="muted" style={{ fontSize: 14 }}>
        Dúvidas? <Link href="/suporte">Suporte</Link> · chat no site · WhatsApp (51) 99625-3766
      </p>
    </div>
  );
}
