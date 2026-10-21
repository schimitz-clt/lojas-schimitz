# 07 — SEO e velocidade: produto e departamento

## Diagnóstico (produção, 21/10)
- Já havia: title/description/canonical/og por página, JSON-LD Product (Offer BRL, InStock, NewCondition) e BreadcrumbList, sitemap (119 URLs) e robots.txt corretos.
- **Problema real:** o Next 15 envia os metadados por streaming no `<body>` para navegadores **e para o Googlebot**.
  `curl -A Googlebot` em /produto/...: `<head>` sem `<title>`, sem canonical e sem JSON-LD. O Google ignora `rel=canonical` fora do `<head>`; o Lighthouse acusava "sem meta description" (SEO 92).
- Paginação (?page=2) apontava canonical para a página 1; busca (?q=) era indexável.
- Departamento e /produtos sem ItemList.

## Mudanças
- `next.config.ts`: `htmlLimitedBots: /.*/` → metadados no `<head>` para todos.
- `listingSeoFor`: página 2+ canônica de si mesma; `?q=` → `noindex, follow`.
- JSON-LD `ItemList` (só produtos reais mostrados) em /departamento/* e /produtos; BreadcrumbList em /produtos.
- Visual intocado.

## Lighthouse 12 (mobile, mesmo box, build local contra a API de produção, 2 rodadas)
| Página | Antes (main) | Depois |
|---|---|---|
| Produto | perf 86/86 · SEO 92 · LCP 4,2 s | perf 86/82 · SEO **100** · LCP 4,2/4,9 s |
| Departamento | perf 81/88 · SEO 92 · LCP 5,1/3,9 s | perf 87/87 · SEO **100** · LCP 4,0 s |
Produção (antes, via CDN): produto perf 91/95 SEO 92; departamento perf 94/95 SEO 92.

## Não feito / limites
- Produtos sem foto: o JSON-LD Product fica sem `image` (exigida para resultado rico do Google). Não inventamos imagem.
- `brand` = "Lojas Schimitz" no Product já existia; o certo é a marca do fabricante quando o catálogo trouxer.
- Ícone de 192 px usado a 28 px na barra inferior (5 KiB) e ordem de títulos nos cards: não alterados (visual).
- Rollback: reverter o merge (só front).
