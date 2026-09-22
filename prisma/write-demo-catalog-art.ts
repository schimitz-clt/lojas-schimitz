/**
 * Gera os SVG do catálogo demonstrativo em apps/web/public/demo-catalog.
 * Rode de novo se o catálogo mudar. Não fala com o banco.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DEMO_CATALOG } from '../apps/api/src/modules/catalog/demo-catalog.data';
import { renderDemoCatalogSvg } from '../apps/api/src/modules/catalog/demo-catalog-art';

const outDir = join(__dirname, '../apps/web/public/demo-catalog');
mkdirSync(outDir, { recursive: true });

for (const item of DEMO_CATALOG) {
  const svg = renderDemoCatalogSvg({
    title: item.name,
    sku: item.sku,
    art: item.art,
    bg: item.bg,
    accent: item.accent,
  });
  if (/placehold\.co|placehold\.it|<script/i.test(svg)) {
    throw new Error(`SVG inseguro em ${item.sku}`);
  }
  writeFileSync(join(outDir, `${item.sku}.svg`), svg, 'utf8');
}

console.log(`wrote ${DEMO_CATALOG.length} svg → ${outDir}`);
