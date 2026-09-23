import Link from 'next/link';

/**
 * Unknown routes and notFound() (missing products) share this page.
 * Replaces the English Next.js default, which also forced a full-viewport
 * blank and pushed the storefront footer below the fold.
 */
export default function NotFound() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <title>Página não encontrada</title>
      <p className="not-found-kicker">404</p>
      <h1 id="not-found-title">Página não encontrada</h1>
      <p>
        Esse endereço não existe ou o produto saiu do ar. Volte para a loja ou procure no catálogo.
      </p>
      <div className="not-found-actions">
        <Link className="btn" href="/">
          Ir para o início
        </Link>
        <Link className="btn ghost" href="/produtos">
          Ver produtos
        </Link>
      </div>
    </section>
  );
}
