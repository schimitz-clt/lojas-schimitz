import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectCatalogSitemap, type SitemapFetchJson } from './catalog-sitemap';

const origin = 'https://lojasschimitz.com.br';
const api = 'http://api.internal/api/v1';

function product(i: number, extra: Record<string, unknown> = {}) {
  return { slug: `produto-${i}`, updatedAt: '2026-10-01T00:00:00.000Z', isDemo: false, active: true, ...extra };
}

function fakeApi(opts: { total: number; failProductsPage?: number; failCategories?: boolean; pageSize: number }) {
  const calls: string[] = [];
  const fetchJson: SitemapFetchJson = async (url) => {
    calls.push(url);
    if (url.endsWith('/categories')) {
      if (opts.failCategories) throw new Error('HTTP 502');
      return { ok: true, data: [{ slug: 'eletronicos' }, { slug: 'eletronicos' }, { slug: 'casa' }] };
    }
    const page = Number(new URL(url).searchParams.get('page'));
    if (opts.failProductsPage === page) throw new Error('fetch failed');
    const start = (page - 1) * opts.pageSize;
    const items = [];
    for (let i = start; i < Math.min(start + opts.pageSize, opts.total); i++) items.push(product(i));
    return { ok: true, data: { items, total: opts.total } };
  };
  return { calls, fetchJson };
}

async function main() {
  // 1. API ok: 100 produtos em 2 páginas de 60 + 2 categorias (dedupe) → completo.
  {
    const f = fakeApi({ total: 100, pageSize: 60 });
    const r = await collectCatalogSitemap({ origin, apiBase: api, fetchJson: f.fetchJson });
    assert.equal(r.complete, true);
    assert.deepEqual(r.errors, []);
    assert.equal(r.products.length, 100);
    assert.equal(r.categories.length, 2);
    assert.equal(r.products[0].url, `${origin}/produto/produto-0`);
    assert.equal(r.categories[0].url, `${origin}/departamento/eletronicos`);
    assert.ok(r.products[0].lastModified instanceof Date);
    assert.equal(f.calls[0], `${api}/products?page=1&pageSize=60`);
    assert.equal(f.calls.filter((c) => c.includes('/products')).length, 2);
  }

  // 2. API fora do ar: categorias falham E produtos falham → incompleto, com erros; não lança.
  {
    const down: SitemapFetchJson = async () => {
      throw new Error('fetch failed');
    };
    const r = await collectCatalogSitemap({ origin, apiBase: api, fetchJson: down });
    assert.equal(r.complete, false);
    assert.equal(r.products.length, 0);
    assert.equal(r.categories.length, 0);
    assert.equal(r.errors.length, 2);
  }

  // 3. Falha só nas categorias: produtos continuam no sitemap; resultado marcado incompleto.
  {
    const f = fakeApi({ total: 10, pageSize: 60, failCategories: true });
    const r = await collectCatalogSitemap({ origin, apiBase: api, fetchJson: f.fetchJson });
    assert.equal(r.complete, false);
    assert.equal(r.products.length, 10);
    assert.equal(r.categories.length, 0);
    assert.match(r.errors[0], /^categories:/);
  }

  // 4. Falha na página 2: mantém a página 1, marca incompleto.
  {
    const f = fakeApi({ total: 100, pageSize: 60, failProductsPage: 2 });
    const r = await collectCatalogSitemap({ origin, apiBase: api, fetchJson: f.fetchJson });
    assert.equal(r.complete, false);
    assert.equal(r.products.length, 60);
    assert.match(r.errors[0], /^products:/);
  }

  // 5. Demo e inativos ficam de fora; envelope ok:false conta como falha.
  {
    const fetchJson: SitemapFetchJson = async (url) =>
      url.endsWith('/categories')
        ? { ok: false }
        : { ok: true, data: { items: [product(1), product(2, { isDemo: true }), product(3, { active: false })], total: 3 } };
    const r = await collectCatalogSitemap({ origin, apiBase: api, fetchJson });
    assert.deepEqual(r.products.map((p) => p.url), [`${origin}/produto/produto-1`]);
    assert.equal(r.complete, false);
  }

  // 6. A rota é dinâmica (não congela no build) e usa o upstream do proxy, não a URL do browser.
  {
    const src = readFileSync(join(__dirname, '..', 'app', 'sitemap.ts'), 'utf8');
    assert.match(src, /export const dynamic = 'force-dynamic'/);
    assert.match(src, /resolveApiProxyTarget\(\)/);
    assert.doesNotMatch(src, /catch\s*\{\s*return staticEntries/);
    assert.match(src, /SITEMAP_CATALOG_DEGRADED/);
  }

  console.log('catalog-sitemap.spec OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
