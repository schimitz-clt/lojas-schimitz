# Security Phase B — CSP + hardenings (2026-09-19)

**Pedido:** aproximar segurança de “100% hardened” **incluindo CSP**, sem quebrar PIX / Card Brick / webhooks.  
**Base:** `main` (enforce CSP Phase A já no ar em `https://lojasschimitz.com.br`).  
**Sem:** DNS, wipe de DB, Play, `ALLOW_LIVE` split MP, flip `REFRESH_JSON_TOKEN_ENABLED`, math de PIX.

## Scorecard (~80% → ~95%)

| Área | Antes (audit 18/09 + live 19/09) | Depois deste PR |
|------|----------------------------------|-----------------|
| CSP storefront | Enforce gradual **já live**; `connect-src` com localhost; sem `report-uri` | **Prod:** sem localhost; `upgrade-insecure-requests`; `js.mercadopago.com` + apex MP; `report-uri` + `Reporting-Endpoints` |
| CSP monitoramento | Ausente | **Report-Only** (sem `'unsafe-eval'`) + `POST /api/v1/security/csp-report` (204, throttle 60/min) |
| Headers extra | HSTS sem preload; sem `X-Permitted-Cross-Domain-Policies` na loja | HSTS `preload`; `X-Permitted-Cross-Domain-Policies: none` |
| F3 localhost em prod | Presente | Removido só no enforce de **production** (`next dev` intacto) |
| F6 seller IDOR | Produto de outro vendedor → 403 | **404** `PRODUCT_NOT_FOUND` |
| F7 OptionalJwt | JWT sem lookup de `status` | Bloqueado/inexistente = **guest** (cart/chat) |
| F8 refresh race | `update` sem predicado | CAS `updateMany` `revokedAt IS NULL` |
| F11 chat status | `privateTools: ["getOrderStatus",…]` | `privateTools: []` (campo estável) |
| F12 catálogo público | `inventory.qtyOnHand` / `qtyReserved` | Só `{ available }` + `stock` |
| F13 reviews públicas | `user.id` | Só `user.name` |
| F14 null provider | Override `ALLOW_NULL_PROVIDER_IN_PROD` em prod-like | **Railway production ignora o override** |
| PIX / Brick | QR `data:` + SDK v2 | Allowlist comprovada no bundle `sdk.mercadopago.com/js/v2` (19/09) |

**Ainda ~5% residual (explícito, não neste PR):** nonce-strict CSP (quebraria Next + Brick), Redis throttler, access JWT em memória/`localStorage` (cookie-first já no host da loja), CSRF Origin na API direta, janela `ts` do webhook MP (retries de dias — **não** aplicar ±5 min).

## Diretivas CSP (enforce produção)

| Diretiva | Valor / hosts | Por quê |
|----------|---------------|---------|
| `default-src` | `'self'` | Fallback fechado |
| `base-uri` / `object-src` / `frame-ancestors` | `'self'` / `none` / `'self'` | Anti-injection / plugin / clickjacking |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'` + SDK hosts | Next hydration + Brick. **Não** nonce-only. |
| `script-src` hosts | `sdk.mercadopago.com`, `js.mercadopago.com`, `http2.mlstatic.com`, `*.mlstatic.com`, `applepay.cdn-apple.com` | Entry v2 + chunks + Apple Pay referenciado no SDK |
| `style-src` | `'self' 'unsafe-inline'` + mlstatic | Next + estilos do Brick |
| `img-src` | `'self' data: blob: https:` | Uploads, PIX QR (`data:`), logos do Brick |
| `font-src` | `'self' data:` | next/font |
| `connect-src` | `'self'` + API MP / ML / mlstatic / ViaCEP | Brick XHR + CEP. **Sem** localhost em prod |
| `frame-src` | `'self'` + Secure Fields + `*.mercadopago.com(.br)` + apex + mlstatic | PCI iframes. 3DS ACS de banco é residual (popup COOP) |
| `form-action` | `'self'` + hosts MP BR/apex | Redirect/form do Brick |
| `worker-src` | `'self' blob:` | Next / Brick workers |
| `upgrade-insecure-requests` | (prod) | HTTPS only |
| `report-uri` / `report-to` | `/api/v1/security/csp-report` | Monitoramento |

**Report-Only:** igual ao enforce **sem** `'unsafe-eval'`. Não bloqueia. Promover só depois de reports limpos + smoke PIX/Brick.

## PIX / Brick — como verificar (obrigatório antes de merge se mudar enforce)

Não cobrar de verdade. Não ligar `ALLOW_LIVE`.

1. `curl -sI https://lojasschimitz.com.br/` → `content-security-policy` **e** `content-security-policy-report-only`. Prod **sem** `localhost` no enforce.
2. Checkout / pedido unpaid **cartão:** Brick monta (`sdk.mercadopago.com/js/v2` 200; iframe `secure-fields.mercadopago.com`). Console sem `Refused to frame` / `Refused to load script` de MP.
3. Pedido unpaid **PIX:** QR (`data:image/png;base64`) + copia-e-cola. Sem script MP. `img-src data:` cobre.
4. `POST /api/v1/webhooks/mercadopago` sem sig → **401** (inalterado).
5. DevTools → Network: `POST /api/v1/security/csp-report` pode aparecer (204). Logs API: `csp_violation` sem cookies.

**Não mesclar um corte futuro de `'unsafe-eval'` no enforce até o smoke acima passar.** Este PR já envia esse corte só em Report-Only.

## Rollback

1. **CSP quebrou Brick/PIX:** no `storefront-security-headers.ts`, remover o header `Content-Security-Policy` (manter Report-Only + HSTS). Redeploy **web**.
2. **Report-Only barulho:** remover `Content-Security-Policy-Report-Only` + `Reporting-Endpoints`.
3. **Collector:** desregistrar `SecurityModule` ou a rota `POST security/csp-report`.
4. Demais F6/F7/F12/F13/F14: revert do commit (não afetam checkout).

## O que NÃO foi feito (de propósito)

- Janela `ts` ±5 min no webhook HMAC — MP reenvia o mesmo `ts` por dias; quebraria liquidação.
- `frame-src https:` amplo — só se 3DS de emissor falhar ao vivo (não evidenciado; Report-Only avisa).
- COEP, nonce-strict, flip cookie-only JSON, Redis, multer 2.x, Play.

## Testes

```bash
cd apps/api && npm run test:security
cd apps/web && npm run test:security
```
