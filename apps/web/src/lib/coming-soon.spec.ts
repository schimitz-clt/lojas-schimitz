import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { waLink } from './api';
import {
  COMING_SOON_PRODUCTS,
  activeProductCountFromCatalog,
  comingSoonBadgeLabel,
  comingSoonCardNote,
  comingSoonDisclaimer,
  comingSoonSubtitle,
  comingSoonTitle,
  comingSoonWhatsAppText,
  shouldShowComingSoonShelf,
} from './coming-soon';

const EXPECTED = [
  { name: 'Smart TV 55" 4K', category: 'TVs e Áudio', icon: '/cats/eletro.svg' },
  { name: 'Smartphone 128GB', category: 'Celulares', icon: '/cats/celulares.svg' },
  { name: 'Notebook i5 16GB 512SSD', category: 'Informática', icon: '/cats/informatica.svg' },
  { name: 'Ar-condicionado Aiwa', category: 'Eletrodomésticos', icon: '/cats/eletrodomesticos.svg' },
  { name: 'Geladeira Frost Free 400L', category: 'Eletrodomésticos', icon: '/cats/eletrodomesticos.svg' },
];

assert.equal(COMING_SOON_PRODUCTS.length, 5);
assert.deepEqual(
  COMING_SOON_PRODUCTS.map((p) => ({ name: p.name, category: p.category, icon: p.icon })),
  EXPECTED,
);
assert.equal(new Set(COMING_SOON_PRODUCTS.map((p) => p.id)).size, 5);

const publicDir = join(__dirname, '../../public');
for (const item of COMING_SOON_PRODUCTS) {
  assert.ok(existsSync(join(publicDir, item.icon)), `icon exists ${item.icon}`);
  assert.ok(!/placehold\.co/i.test(item.icon));
  assert.ok(!item.icon.startsWith('http'));
}

assert.equal(comingSoonTitle(), 'Em breve');
assert.ok(/whatsapp/i.test(comingSoonSubtitle()));
assert.equal(comingSoonBadgeLabel(), 'Em breve');
assert.ok(/sem preço/i.test(comingSoonCardNote()));
assert.ok(/não estão à venda/i.test(comingSoonDisclaimer()));
assert.ok(!/r\$\s*\d/i.test(comingSoonDisclaimer()));
assert.ok(!/r\$\s*\d/i.test(comingSoonCardNote()));
assert.ok(comingSoonWhatsAppText().length > 20);

assert.equal(shouldShowComingSoonShelf(0), true);
assert.equal(shouldShowComingSoonShelf(1), false);
assert.equal(shouldShowComingSoonShelf(3), false);
assert.equal(shouldShowComingSoonShelf(Number.NaN), false);

assert.equal(activeProductCountFromCatalog({ items: [], total: 0 }), 0);
assert.equal(activeProductCountFromCatalog({ items: [{ id: 'a' }], total: 1 }), 1);
assert.equal(activeProductCountFromCatalog({ items: [], total: 4 }), 4);
assert.equal(activeProductCountFromCatalog({ items: [{ id: 'a' }, { id: 'b' }] }), 2);
assert.equal(activeProductCountFromCatalog([{ id: 'a' }]), 1);
assert.equal(activeProductCountFromCatalog(null), 0);
assert.equal(shouldShowComingSoonShelf(activeProductCountFromCatalog({ items: [], total: 0 })), true);
assert.equal(shouldShowComingSoonShelf(activeProductCountFromCatalog({ items: [], total: 1 })), false);
assert.equal(
  shouldShowComingSoonShelf(activeProductCountFromCatalog({ items: [], total: 100, demoTotal: 100, sellableTotal: 0 })),
  false,
  '100 DEMO ativos escondem Em breve; vendável continua separado no payload',
);

const href = waLink(comingSoonWhatsAppText());
assert.ok(href.startsWith('https://wa.me/'), 'CTA uses wa.me');
assert.ok(href.includes('text='));
assert.ok(decodeURIComponent(href).includes('Lojas Schimitz'));

const srcRoot = join(__dirname, '..');
const page = readFileSync(join(srcRoot, 'app/home-client.tsx'), 'utf8');
assert.ok(page.includes('<ComingSoonShelf'), 'home renders the teaser');
assert.ok(page.includes('shouldShowComingSoonShelf'), 'home hides the teaser from the live count');
assert.ok(page.includes('HomeShortcuts'), 'shortcuts stay');
assert.ok(page.includes('HomeShelves'), 'product shelves stay');
assert.ok(page.includes('HomeBanners'), 'hero stays');
assert.ok(page.includes('homeCatalogEmptyCopy'), 'empty home uses the catalog empty helper');
assert.ok(page.includes('StorefrontEmpty'), 'empty home uses the shared panel');
assert.ok(!page.includes('Nenhuma oferta no momento'), 'empty home no longer points at an empty ofertas shelf');

const shelf = readFileSync(join(srcRoot, 'components/ComingSoonShelf.tsx'), 'utf8');
assert.ok(shelf.includes('waLink'), 'WhatsApp reuses the storefront helper');
assert.ok(!/5551\d{8,}/.test(shelf), 'component does not hardcode a store number');
assert.ok(!shelf.includes('ProductCard'), 'teaser does not reuse the buy card');
assert.ok(!shelf.includes('Adicionar à sacola'), 'no bag CTA');
assert.ok(!shelf.includes('/cart/items'), 'no cart add');
assert.ok(!shelf.includes('/produto/'), 'no fake PDP');
assert.ok(!/placehold\.co/i.test(shelf));
assert.ok(!/href=\{`\/produto/.test(shelf));
assert.ok(!shelf.includes('brl('), 'no invented price');
assert.ok(shelf.includes('comingSoonDisclaimer'), 'shelf states the preview is not for sale');

console.log('coming-soon unit tests ok');
