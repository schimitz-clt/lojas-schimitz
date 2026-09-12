# MEGA Phase 5 (safe / additive) — checkpoint

**Data:** 2026-09-12 19:18 America/Sao_Paulo (UTC-3)  
**Escopo:** SEO canônicos / Open Graph + www→apex no `siteOrigin` + micro-perf LCP no banner. Smoke read-only. Sem cobrança MP, sem migration destrutiva, sem Play publish, sem secrets.

## Feito

| Item | Onde | Nota |
|------|------|------|
| `siteOrigin` www→apex | `apps/web/src/lib/storefront.ts` | `www.lojasschimitz.com.br` → `https://lojasschimitz.com.br` |
| Root canonical | `layout.tsx` | `alternates.canonical: '/'` + `metadataBase` apex |
| PDP canonical + OG url + twitter | `produto/[slug]/page.tsx` | path `/produto/{slug}`; twitter herda título do produto |
| Departamento SEO | `departamento/[slug]/page.tsx` + `DepartamentoClient.tsx` | `generateMetadata` + `fetchCategoryMeta` (fallback p/ `ofertas`) |
| Páginas estáticas | marketplace / privacidade / termos | `alternates.canonical` |
| robots | `robots.ts` | + `/carrinho` `/favoritos` no disallow |
| sitemap | `sitemap.ts` | `pageSize` 60→100 (catálogo atual ~9) |
| LCP banner | `HomeBanners.tsx` | `loading="eager"` + `fetchPriority="high"` (já lazy nos cards) |
| Unit | `storefront.spec.ts` | www → apex |
| Smoke | `scripts/mega-phase-5-smoke.sh` | health, products, www 301, assetlinks, refresh clear, webhook |

## Curl evidence (live)

### Health

```
GET https://lojasschimitz.com.br/api/v1/health
→ HTTP 200  ok=true  service=lojas-schimitz-api  env=production
```

### Products

```
GET https://lojasschimitz.com.br/api/v1/products?pageSize=1
→ HTTP 200  ok=true  total=9
```

### www 301 (Cloudflare)

```
GET https://www.lojasschimitz.com.br/
→ HTTP/2 301
   location: https://lojasschimitz.com.br/
   server: cloudflare
```

### Digital Asset Links

```
GET https://lojasschimitz.com.br/.well-known/assetlinks.json
→ HTTP 200  package_name=com.lojasschimitz.app
```

### Refresh 401 + cookie clear

Empty body (sem cookie) → controller chama `clearRefreshCookie` antes do 401:

```
POST https://lojasschimitz.com.br/api/v1/auth/refresh
Content-Type: application/json
{}

→ HTTP/2 401
   set-cookie: sch_refresh=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure
   body: code=UNAUTHORIZED  "Refresh token inválido"
```

### Webhook 401

```
POST https://lojasschimitz.com.br/api/v1/webhooks/mercadopago
→ HTTP 401  code=WEBHOOK_SIGNATURE_INVALID  "Assinatura ausente"
```

### Smoke script

```
bash scripts/mega-phase-5-smoke.sh
→ all PASS (fail=0) @ 2026-09-12T22:18:16Z
```

## Notas

- Cards já usavam `loading=lazy` / `decoding=async`; sem migrar para `next/image` (evita config de remotePatterns / redesign).
- Middleware www→apex permanece defense-in-depth; CF 301 é o caminho primário.
- SEO canônicos no apex: deploy deste commit ativa metadata nova no Next; curls de health/www acima são independentes do deploy.

## Fora deste slice

- Cobrança real Mercado Pago / Play production
- Substituir placehold.co (ação do dono; ids no ops Phase 4)
- Paginação completa do sitemap além de pageSize 100
