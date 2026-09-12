# MEGA Phase 1–2 (safe / additive) — checkpoint

**Data:** 2026-09-12 (America/Sao_Paulo)  
**Escopo:** www mitigation no Next + rewrite de URLs de upload + placeholder + sinal de estoque baixo. Sem cobrança MP, sem migration destrutiva, sem Play publish, sem secrets.

## Feito

| Item | Onde | Nota |
|------|------|------|
| www → apex 301 | `apps/web/src/middleware.ts` + `lib/www-redirect.ts` | Só se o request chegar no Next |
| Upload URL pública | `apps/api/src/common/public-upload-url.ts` na serialização (catálogo, banner, cart, seller, POST /admin/uploads) e eco no web | Ship porque curl apex = Railway (mesmo PNG) |
| Placeholder | `apps/web/src/lib/placeholder-image.ts` — admin + cards + banners + PDP | empty / placehold.co / placehold.it / via.placeholder.com |
| Estoque baixo ops | `GET /admin/ops` + UI admin já existente + `?lowStock=` | Usa `Inventory.qtyOnHand` |
| Dual-mode refresh | **intacto** (`auth-session.ts` / body `{ refreshToken }` se localStorage) | |
| Paleta | **intacto** (preto + amarelo `#FFD100`) | |

## Curl — rewrite de upload (evidência)

Produto conhecido: `518992fa-c11b-4ca5-8113-18e5a1e6c6db.png`

```
GET https://lojas-schimitz-production.up.railway.app/api/v1/uploads/518992fa-c11b-4ca5-8113-18e5a1e6c6db.png
→ HTTP/2 200  content-type: image/png  content-length: 1782491
   etag: W/"1b32db-1a0871cfdb9"  PNG magic 89 50 4E 47

GET https://lojasschimitz.com.br/api/v1/uploads/518992fa-c11b-4ca5-8113-18e5a1e6c6db.png
→ HTTP/2 200  content-type: image/png  1782491 bytes  mesmo etag  bytes idênticos
   (via proxy Next /api/v1)
```

Sem essa igualdade o rewrite **não** teria sido commitado.

## BLOQUEIO restante — www infra

```
GET https://www.lojasschimitz.com.br/
→ HTTP/2 404
   server: cloudflare
   x-railway-fallback: true
   body: {"status":"error","code":404,"message":"Application not found"}
```

O middleware Next **não roda**. OWNER precisa:

1. Railway → serviço web → Custom Domain `www.lojasschimitz.com.br` (mesmo app do apex), **ou**
2. Cloudflare Redirect Rule: `www.lojasschimitz.com.br/*` → `https://lojasschimitz.com.br/$1` (301)

## Fora deste slice

- Cobrança real Mercado Pago
- Publish Play production
- Volume/R2 se uploads sumirem no redeploy (já documentado em DEPLOY.md)
- Trocar `PUBLIC_API_URL` no Railway (opcional; serialize já reescreve)
