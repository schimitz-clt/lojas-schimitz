import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CATALOG_PAGE_SIZE,
  catalogPageCount,
  catalogPageRange,
  catalogPageSearch,
  parseCatalogPage,
} from './catalog-pagination';
import {
  SITEMAP_MAX_PAGES,
  SITEMAP_PAGE_SIZE,
  SITEMAP_STATIC_PAGES,
  sitemapAcceptsProduct,
  sitemapCategoryPath,
  sitemapLastModified,
  sitemapProductPath,
  sitemapShouldFetchNext,
  sitemapStaticEntries,
} from './catalog-sitemap';
import { batchSelectionError, catalogImportFileError, toggleSkuSelection } from './catalog-import-ui';

{
  assert.equal(parseCatalogPage(null), 1);
  assert.equal(parseCatalogPage('0'), 1);
  assert.equal(parseCatalogPage('2'), 2);
  assert.equal(CATALOG_PAGE_SIZE, 24);
  assert.equal(catalogPageCount(0), 1);
  assert.equal(catalogPageCount(24), 1);
  assert.equal(catalogPageCount(25), 2);
  assert.equal(catalogPageCount(500, 24), 21);
  const range = catalogPageRange(2, 50, 24);
  assert.equal(range.start, 25);
  assert.equal(range.end, 48);
  assert.equal(range.pages, 3);
  const params = new URLSearchParams('q=tv&category=eletro');
  assert.equal(catalogPageSearch(params, 1), 'q=tv&category=eletro');
  assert.equal(catalogPageSearch(params, 3), 'q=tv&category=eletro&page=3');
  console.log('catalog-pagination — PASSOU');
}

{
  assert.equal(
    sitemapShouldFetchNext({ page: 1, pageSize: 60, received: 60, total: 120 }),
    true,
  );
  assert.equal(
    sitemapShouldFetchNext({ page: 2, pageSize: 60, received: 60, total: 120 }),
    false,
  );
  assert.equal(
    sitemapShouldFetchNext({ page: 1, pageSize: 60, received: 0, total: 0 }),
    false,
  );
  assert.equal(
    sitemapShouldFetchNext({ page: SITEMAP_MAX_PAGES, pageSize: SITEMAP_PAGE_SIZE, received: 60, total: 99999 }),
    false,
  );
  assert.equal(sitemapProductPath('lampada-led'), '/produto/lampada-led');
  assert.equal(sitemapProductPath(''), null);
  assert.equal(sitemapProductPath('a b'), null);
  assert.equal(sitemapCategoryPath('eletro'), '/departamento/eletro');
  assert.equal(sitemapCategoryPath('a b'), null);
  assert.equal(sitemapAcceptsProduct({ slug: 'tv', isDemo: false, active: true }), true);
  assert.equal(sitemapAcceptsProduct({ slug: 'tv' }), true);
  assert.equal(sitemapAcceptsProduct({ slug: 'demo-sku', isDemo: true }), false);
  assert.equal(sitemapAcceptsProduct({ slug: 'tv', active: false }), false);
  assert.equal(sitemapAcceptsProduct({ slug: '' }), false);
  assert.equal(sitemapLastModified('2026-09-22T03:48:45.837Z')?.toISOString(), '2026-09-22T03:48:45.837Z');
  assert.equal(sitemapLastModified('nao-e-data'), undefined);
  assert.equal(sitemapLastModified(''), undefined);
  const staticUrls = sitemapStaticEntries('https://lojasschimitz.com.br').map((entry) => entry.url);
  assert.ok(staticUrls.includes('https://lojasschimitz.com.br/'));
  assert.ok(staticUrls.includes('https://lojasschimitz.com.br/produtos'));
  assert.ok(staticUrls.includes('https://lojasschimitz.com.br/suporte'));
  assert.equal(staticUrls.some((url) => url.endsWith('/entrar') || url.endsWith('/cadastro')), false);
  assert.ok(SITEMAP_STATIC_PAGES.every((page) => page.path !== '/entrar' && page.path !== '/cadastro'));
  assert.equal(SITEMAP_PAGE_SIZE, 60);
  console.log('catalog-sitemap — PASSOU');
}

{
  assert.match(catalogImportFileError('   ') || '', /Nada foi enviado/);
  assert.equal(catalogImportFileError('sku;nome\nFICT-001;Lanterna\n'), null);
  assert.match(catalogImportFileError('x'.repeat(450_001)) || '', /Nada foi enviado/);
  assert.deepEqual(toggleSkuSelection(['FICT-001'], 'FICT-002'), ['FICT-001', 'FICT-002']);
  assert.deepEqual(toggleSkuSelection(['FICT-001'], 'FICT-001'), []);
  assert.match(batchSelectionError(0) || '', /Marque ao menos um SKU/);
  assert.equal(batchSelectionError(2), null);
  const section = readFileSync(
    join(__dirname, '../components/admin/sections/AdminCatalogoSection.tsx'),
    'utf8',
  );
  assert.ok(section.includes('AdminCatalogImportPanel'));
  assert.ok(section.includes('id="admin-product-form"'));
  const produtos = readFileSync(join(__dirname, '../app/produtos/page.tsx'), 'utf8');
  assert.ok(produtos.includes('CatalogPager'));
  assert.ok(produtos.includes('pageSize'));
  console.log('catalog-import-ui — PASSOU');
}

console.log('catalog-pagination.spec ok');
