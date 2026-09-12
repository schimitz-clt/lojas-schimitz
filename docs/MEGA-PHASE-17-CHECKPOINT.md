# MEGA Phase 17 — technical SEO (JSON-LD)

**Data:** 2026-09-12 ~20:20 America/Sao_Paulo (UTC-3)  
**Base git:** `bed92a2` (Phase 16 checkpoint SHA docs).  
**Escopo:** JSON-LD Product (PDP) + BreadcrumbList (categoria/PDP); auditoria Phase 5 sitemap/robots/canonicals apex; sem conteúdo fake de produto; sem cobranças.

## FASE / STATUS

| Campo | Valor |
|-------|--------|
| **FASE** | MEGA Phase 17 — technical SEO JSON-LD |
| **STATUS** | DONE (helpers + unit tests; robots/sitemap já corretos) |
| **COMMIT** | _(preenchido após push)_ |
| **PRODUÇÃO** | Deploy Next ativa `<script type="application/ld+json">` no SSR |
| **RISCOS** | Baixo — markup aditivo; dados só da API pública |
| **BLOQUEIOS** | Nenhum interno |

## Auditoria Phase 5 (antes → depois)

| Área | Antes (Phase 5 / live) | Depois Phase 17 | Nota |
|------|------------------------|-----------------|------|
| **siteOrigin www→apex** | `storefront.ts` | Inalterado | Canonicals / OG / sitemap / robots |
| **Root canonical** | `layout.tsx` `/` + `metadataBase` apex | Inalterado | |
| **PDP canonical + OG** | `produto/[slug]/page.tsx` | + Product + Breadcrumb JSON-LD | Sem inventar campos |
| **Departamento SEO** | `generateMetadata` + canonical | + BreadcrumbList JSON-LD | |
| **robots** | disallow conta/checkout/admin/pedidos/carrinho/favoritos; sitemap apex | Verificado OK — sem mudança | Live: `Sitemap: https://lojasschimitz.com.br/sitemap.xml` |
| **sitemap** | static + categories + products (`pageSize` 100) apex | Verificado OK — sem mudança | Live locs só apex |
| **www 301** | Cloudflare + middleware defense-in-depth | Confirmado 301 → apex | Sem duplicate content www |

### Live curls (2026-09-12)

```
GET https://lojasschimitz.com.br/robots.txt
→ Allow /; Disallow /conta /checkout /admin /pedidos /carrinho /favoritos
→ Sitemap: https://lojasschimitz.com.br/sitemap.xml

GET https://lojasschimitz.com.br/sitemap.xml
→ <loc>https://lojasschimitz.com.br/…</loc> (sem www)

GET https://www.lojasschimitz.com.br/
→ HTTP/2 301 location: https://lojasschimitz.com.br/
```

## Feito

| Item | Onde | Nota |
|------|------|------|
| Product JSON-LD | `json-ld.ts` + PDP `page.tsx` | name, description, sku, image(s), Offer BRL, availability, brand/seller; AggregateRating só se `ratingCount > 0` |
| BreadcrumbList PDP | idem | Início → categoria (ou Produtos) → produto |
| BreadcrumbList departamento | `departamento/[slug]/page.tsx` | Início → Produtos → categoria |
| `fetchProductMeta` | `storefront.ts` | Campos reais da API (price/sku/stock/category/seller/ratings) p/ JSON-LD |
| `JsonLd` component | `components/JsonLd.tsx` | `application/ld+json` + escape `</` |
| Unit | `json-ld.spec.ts` | price/availability/breadcrumb/product/stringify |
| Docs | este arquivo | |

## Explicitamente NÃO feito

- Conteúdo/produto inventado ou placeholders no schema  
- Cobrança Mercado Pago / Play  
- Alteração ampla de robots/sitemap (já corretos no apex)  
- Organization/WebSite JSON-LD global (fora do escopo Product/Breadcrumb)  
- Migrar para `next/image`  

## TESTES

- `npx tsx src/lib/json-ld.spec.ts`  
- `npx tsx src/lib/storefront.spec.ts` (www → apex)  
- `apps/web` `npm test` inclui `json-ld.spec.ts`

## Arquivos

- `apps/web/src/lib/json-ld.ts`  
- `apps/web/src/lib/json-ld.spec.ts`  
- `apps/web/src/lib/storefront.ts`  
- `apps/web/src/components/JsonLd.tsx`  
- `apps/web/src/app/produto/[slug]/page.tsx`  
- `apps/web/src/app/departamento/[slug]/page.tsx`  
- `apps/web/package.json`  
- `docs/MEGA-PHASE-17-CHECKPOINT.md`  
