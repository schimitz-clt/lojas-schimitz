import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'Marketplace Lojas Schimitz — catálogo de produtos e vendedores parceiros em Porto Alegre.',
};

export default function MarketplacePage() {
  return (
    <div style={{ padding: '22px 0', maxWidth: 760 }}>
      <h1>Marketplace</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Compre na Lojas Schimitz com o mesmo checkout, frete e pagamento de sempre. Produtos
        podem ser da loja própria ou de vendedores parceiros — sempre com a etiqueta{' '}
        <strong style={{ color: 'var(--text)' }}>Vendido por</strong> na página do produto.
      </p>

      <section className="hero" style={{ padding: 22, marginBottom: 18 }} aria-label="Catálogo">
        <h2 style={{ marginTop: 0, fontSize: 20 }}>Catálogo</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Eletro, celulares, informática, eletrodomésticos, casa e esporte. Ofertas no padrão das
          grandes, com PIX 5% off e até 12x sem juros.
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

      <section
        className="card"
        style={{ marginBottom: 18 }}
        aria-label="Vendedores parceiros"
      >
        <div className="body">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Vendedores parceiros</h2>
          <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
            O marketplace v1 já conecta o catálogo a vendedores. Cada anúncio mostra quem vende.
            Checkout, frete e pagamento continuam unificados na Lojas Schimitz.
          </p>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            É vendedor e já tem acesso? Entre no{' '}
            <Link href="/vendedor" style={{ color: 'var(--primary-dark)' }}>
              portal do vendedor
            </Link>
            .
          </p>
        </div>
      </section>

      <p className="muted" style={{ fontSize: 14 }}>
        Dúvidas? <Link href="/suporte">Suporte</Link> · chat no site · WhatsApp (51) 99625-3766
      </p>
    </div>
  );
}
