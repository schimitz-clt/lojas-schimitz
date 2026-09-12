# MEGA Phase 8 — security checklist / safe hardening

**Data:** 2026-09-12 ~19:35 America/Sao_Paulo (UTC-3)  
**Base git:** `84e1659` (Phase 7)  
**Escopo:** auditoria CRÍTICA/ALTA/MÉDIA/BAIXA com evidência em código + curls live; só hardening seguro/não-quebrante. **Sem** rotação de secrets, **sem** remover dual-mode refresh, **sem** cobrança MP, **sem** migration destrutiva, **sem** Play publish.

## Resumo executivo

A API em produção já está em bom estado de baseline (Helmet, CORS allowlist, Throttler, webhook HMAC, Swagger OFF, filtro global sem stack). O storefront Next.js **não** enviava headers de segurança equivalentes (evidência live). Phase 8 documenta o inventário e aplica dois hardennings seguros: (1) sanitização reforçada de erros ≥500 em prod-like; (2) headers de segurança + `poweredByHeader: false` no Next.

## Controles já OK (evidência)

| Controle | Evidência |
|----------|-----------|
| Helmet + HSTS/CSP/XFO/nosniff na **API** | Live `GET /api/v1/health` → `strict-transport-security`, `content-security-policy`, `x-frame-options: SAMEORIGIN`, `x-content-type-options: nosniff` |
| Swagger OFF em prod | Live `GET /api/v1/docs` e `/docs-json` → **404** `NOT_FOUND` |
| Admin sem token | Live `GET /api/v1/admin/ops` → **401** `Token ausente` |
| Upload admin sem token | Live `POST /api/v1/admin/uploads` → **401** |
| Webhook sem/assinatura fraca | Live `POST /api/v1/webhooks/mercadopago` sem sig → **401** `Assinatura ausente`; `x-signature: null-test-secret` → **401** `Assinatura de webhook inválida` |
| CORS allowlist | `Origin: https://evil.example` **não** recebe `access-control-allow-origin`; `https://lojasschimitz.com.br` recebe ACAO |
| Forgot-password anti-enum | Live resposta genérica `accepted: true` + mensagem padrão (HTTP 201) |
| Erros sem stack (live) | 404/401/400 bodies: `{ success, ok, error: { code, message, details } }` — **sem** `stack` |
| Dual-mode refresh (intencional) | `docs/SECURITY.md` + `refresh-cookie.ts` + web `saveSession` — **não removido** nesta fase |
| Uploads: magic-bytes JPG/PNG/WebP + 15 MB | `upload-validate.ts` |
| Senhas argon2id; reset token só SHA-256 no DB | `auth.service.ts` / `docs/SECURITY.md` |
| Rate limit global + auth/chat/payments | `ThrottlerModule` + `@Throttle` nas rotas |
| www → apex | Live `www` → **301** `location: https://lojasschimitz.com.br/` |

## Achados

### CRÍTICA

*Nenhuma encontrada nesta auditoria (código + curls).*  
Webhook null fraco / simulate payment **não** aceitos em prod (401). Swagger fechado. Sem stack em respostas live.

### ALTA

| ID | Achado | Evidência | Ação Phase 8 |
|----|--------|-----------|--------------|
| A1 | Storefront sem headers de segurança (HSTS, XFO, nosniff, Referrer-Policy); expõe `x-powered-by: Next.js` | Live `GET https://lojasschimitz.com.br/` (HTML) — headers de segurança **ausentes**; `x-powered-by: Next.js`. Contraste: API no mesmo host **tem** Helmet. | **Corrigido:** `apps/web/next.config.ts` + `storefront-security-headers.ts` (`poweredByHeader: false` + baseline headers). Efetivo após deploy do web. |
| A2 | Risco residual XSS → session: access JWT (e refresh legado) em `localStorage` | `apps/web/src/lib/api.ts` `sch_access` / dual `sch_refresh` | **Docs only.** Mitigação parcial já existe (cookie HttpOnly dual). Remover body refresh quebraria mobile/TWA — **fora de escopo**. CSP estrito no Next = fase futura (quebra runtime sem nonces). |

### MÉDIA

| ID | Achado | Evidência | Ação Phase 8 |
|----|--------|-----------|--------------|
| M1 | `HttpException` 500 com mensagem interna *poderia* vazar em prod (filtro antigo só genericizava non-HTTP) | `AllExceptionsFilter` pré-fase: ramo Http sempre copiava `message` | **Corrigido:** `buildClientError` força `Erro interno` + `details: []` quando `isProdLikeAppEnv() && status >= 500`. Spec dedicada. |
| M2 | Access token curto em `localStorage` (XSS) | `api.ts` | Docs; cookie-only access = breaking — não nesta fase |
| M3 | Dual-mode: `refreshToken` ainda no JSON de login/register | Intencional (`SECURITY.md` SCH-006) | **Não alterar** (pedido explícito) |
| M4 | Chat público (`POST /chat`) — abuso de custo LLM se chave ligada | Live 200 FAQ fallback `llm: false`; Throttle 20/min | Docs; custo depende de `OPENAI_API_KEY` no Railway |
| M5 | Throttler / brute-force counters in-memory (multi-réplica) | `docs/SECURITY.md` | Docs — Redis compartilhado = fase futura |
| M6 | Sem CSP no storefront (API tem CSP via Helmet) | Live HTML sem `content-security-policy` | Docs; baseline headers **sem** CSP estrito (Next App Router) |

### BAIXA

| ID | Achado | Evidência | Ação Phase 8 |
|----|--------|-----------|--------------|
| B1 | `GET /health` expõe `env: "production"` + `mailConfigured` | Live body | Aceito (ops); sem valores secretos |
| B2 | `server: railway-hikari` | Live headers | Infra; sem ação app |
| B3 | Mensagens de validação em inglês (`email must be an email`) | Live `POST /auth/login` 400 | Docs / i18n futura |
| B4 | `images.remotePatterns` hostname `**` no Next | `next.config.ts` | Amplo por design (CDN uploads); monitorar |
| B5 | Simulate UI gated por `NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE` | `pedidos/[publicId]/page.tsx` | Confirmar env **ausente** em prod web (homepage chunks sem string); API rejeita null secret |

## Hardening implementado (safe / non-breaking)

1. **API** — `apps/api/src/common/filters/http-exception.filter.ts`  
   - Extrai `buildClientError()` testável.  
   - Prod/staging/`prod`: respostas ≥500 sempre genéricas; **nunca** campo `stack`.  
   - Spec: `http-exception.filter.spec.ts`.

2. **Web** — headers de segurança + hide `X-Powered-By`  
   - `apps/web/src/lib/storefront-security-headers.ts`  
   - `apps/web/next.config.ts`  
   - Spec: `storefront-security-headers.spec.ts`.

## Explicitamente NÃO feito

- Rotação de JWT / MP / Resend / DB secrets  
- Remoção do dual-mode refresh (body + cookie)  
- CSP estrito com nonces no Next  
- Redis rate-limit compartilhado  
- Cobrança Mercado Pago / Play publish / DB destrutivo  

## Curls de referência (2026-09-12 UTC)

```text
GET  /api/v1/health          → 200 + Helmet + mailConfigured
GET  /api/v1/docs            → 404
GET  /api/v1/admin/ops       → 401 Token ausente
POST /api/v1/webhooks/mercadopago (sem sig) → 401
POST /api/v1/auth/forgot-password → 201 mensagem genérica
GET  https://lojasschimitz.com.br/ → (pré-deploy) sem security headers; x-powered-by Next.js
```

## Arquivos

- `docs/MEGA-PHASE-8-SECURITY.md`
- `apps/api/src/common/filters/http-exception.filter.ts`
- `apps/api/src/common/filters/http-exception.filter.spec.ts`
- `apps/web/next.config.ts`
- `apps/web/src/lib/storefront-security-headers.ts`
- `apps/web/src/lib/storefront-security-headers.spec.ts`
