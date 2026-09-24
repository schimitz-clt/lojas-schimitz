import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CADASTRO_SEO,
  ENTRAR_SEO,
  PRODUTOS_SEO,
  SUPORTE_SEO,
  missingPageMetadata,
  pageUrl,
  storefrontPageMetadata,
} from './seo-metadata';

const origin = 'https://lojasschimitz.com.br';

assert.equal(pageUrl(origin, '/'), origin);
assert.equal(pageUrl(origin, '/produtos'), `${origin}/produtos`);

const produtos = storefrontPageMetadata(PRODUTOS_SEO);
assert.equal(produtos.title, 'Produtos');
assert.equal(produtos.description, PRODUTOS_SEO.description);
assert.match(String(produtos.description), /Porto Alegre/);
assert.equal((produtos.alternates as { canonical: string }).canonical, '/produtos');
assert.deepEqual(produtos.robots, { index: true, follow: true });
const og = produtos.openGraph as {
  url: string;
  locale: string;
  images: { url: string; width: number; alt: string }[];
};
assert.equal(og.url, '/produtos');
assert.equal(og.locale, 'pt_BR');
assert.equal(og.images[0].url, '/og-loja.png');
assert.equal(og.images[0].width, 1200);
assert.match(og.images[0].alt, /Lojas Schimitz/);
assert.equal((produtos.twitter as { card: string }).card, 'summary_large_image');
assert.equal(String(produtos.description).includes('DEMO'), false);

const absolute = storefrontPageMetadata({ ...PRODUTOS_SEO, origin });
const absoluteOg = absolute.openGraph as { url: string; images: { url: string }[] };
assert.equal(absoluteOg.url, `${origin}/produtos`);
assert.equal(absoluteOg.images[0].url, `${origin}/og-loja.png`);

const suporte = storefrontPageMetadata(SUPORTE_SEO);
assert.equal((suporte.alternates as { canonical: string }).canonical, '/suporte');
assert.match(String(suporte.description), /99625-3766/);

const entrar = storefrontPageMetadata(ENTRAR_SEO);
assert.equal((entrar.alternates as { canonical: string }).canonical, '/entrar');
assert.deepEqual(entrar.robots, { index: false, follow: true });
assert.notEqual((entrar.alternates as { canonical: string }).canonical, '/');

const cadastro = storefrontPageMetadata(CADASTRO_SEO);
assert.equal((cadastro.alternates as { canonical: string }).canonical, '/cadastro');
assert.deepEqual(cadastro.robots, { index: false, follow: true });

const missing = missingPageMetadata();
assert.equal(missing.title, 'Página não encontrada');
assert.equal(missing.alternates, undefined);
assert.deepEqual(missing.robots, { index: false, follow: true });
assert.equal((missing.openGraph as { url?: string }).url, undefined);

const src = join(__dirname, '..');
const robots = readFileSync(join(src, 'app/robots.ts'), 'utf8');
assert.ok(robots.includes("allow: '/'"), 'catalog stays crawlable');
assert.ok(robots.includes('sitemap'), 'robots points at the sitemap');
assert.equal(robots.includes("'/produtos'"), false, 'robots does not block the catalog');
assert.ok(robots.includes("'/conta'"));

const sitemap = readFileSync(join(src, 'app/sitemap.ts'), 'utf8');
assert.ok(sitemap.includes('sitemapAcceptsProduct'), 'demo and inactive products stay out of the sitemap');
assert.ok(sitemap.includes('sitemapStaticEntries'));
assert.ok(sitemap.includes('sitemapLastModified'));
assert.equal(sitemap.includes("'/entrar'"), false);
assert.equal(sitemap.includes("'/cadastro'"), false);

const productPage = readFileSync(join(src, 'app/produto/[slug]/page.tsx'), 'utf8');
assert.ok(productPage.includes('resolveProductShareImage'), 'product share image is absolute');
assert.ok(productPage.includes('missingPageMetadata'), 'missing product does not canonical to home');
assert.ok(productPage.includes('notFound()'), 'missing product still 404s from the page');

const department = readFileSync(join(src, 'app/departamento/[slug]/page.tsx'), 'utf8');
assert.ok(department.includes('!cat.listed'), 'unknown department is not an indexable page');
assert.ok(department.includes('notFound()'), 'unknown department 404s');

console.log('seo-metadata unit tests ok');
