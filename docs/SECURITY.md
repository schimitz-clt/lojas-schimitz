# Segurança — SCH-001

- Senhas: argon2id
- Tokens: JWT access curto + refresh persistido com hash
- Secrets somente em `.env` (não versionado)
- CORS allowlist
- Validação de entrada (class-validator)
- Filter global: nunca devolver stack em produção
- Rate limit (Throttler) global + por rota (ex.: chat 20/min)
- Brute-force em `/auth/login` e `/auth/register`: além do Throttler (8 req/min),
  contador de **falhas** por IP e por e-mail — 5 em 15 minutos → HTTP 429
  (`RATE_LIMITED`, mensagem em PT-BR). Login/cadastro bem-sucedido zera o contador.
  Janela deslizante (sem bloqueio permanente). Em memória no processo da API (v1).
- Helmet
- Roles: customer / admin (seller reservado)
- Multi-admin: qualquer `role=admin` + `status=active` acessa o painel; desativar = `status=blocked` (não apaga). Não desativa a si mesmo nem o último admin ativo. Senhas com argon2 (igual ao login).
- Logs com request-id; sem senha/token
- HTTPS obrigatório em staging e production

- Password reset: `POST /auth/forgot-password` + `POST /auth/reset-password`.
  Token opaco (32 bytes hex) enviado por e-mail; no DB só SHA-256.
  Expira em 1h; uso único; ao resetar, revoga todos os refresh tokens.
  Resposta de forgot sempre genérica (sem enumerar e-mail).
  Rate limit: Throttler + contador in-memory (IP/e-mail, janela 15 min).
  Sem SMTP: token é persistido; em development o MailService registra o link no log da API (não na resposta HTTP).


## SCH-005

- OpenAPI/Swagger: default OFF em production/staging; `SWAGGER_ENABLED` sobrescreve. Sem secrets no documento.
- Pagamentos: `allowNullPaymentSimulate()` sempre false em prod/staging; null provider exige `ALLOW_NULL_PROVIDER_IN_PROD=true`.
- IDOR: `createIntent` / `getPayment` de outro usuário → **404** (não 403) — evita enumeração.
- Addresses/orders já filtrados por `userId`; mutações de endereço com Throttle.
- Admin CRM clientes: somente leitura (`GET /admin/customers`); role=customer only.


## SCH-006 — Sessão (refresh cookie) + jobs multi-réplica

### Refresh token
- **Modo dual (default no código):** a API devolve `refreshToken` no JSON **enquanto**
  `REFRESH_JSON_TOKEN_ENABLED` estiver unset/`true` (compat localhost, clientes que ainda
  leem o body). Em paralelo seta cookie HttpOnly `sch_refresh`
  (`Path=/`, `SameSite` configurável, `Secure` em prod/staging).
- **Cookie-only JSON (opt-in Railway):** `REFRESH_COOKIE_ENABLED` (default true) **e**
  `REFRESH_JSON_TOKEN_ENABLED=false` → login/register/refresh **omitem** `refreshToken` no
  JSON; `Set-Cookie` continua. Merge de código **não** ativa isso em prod.
- `POST /auth/refresh` aceita cookie HttpOnly **ou** body (cookie tem precedência; body é
  fallback no servidor — não removido).
- `POST /auth/logout` limpa o cookie e revoga o refresh; access JWT é opcional (se expirado, ainda revoga via cookie/body).
- Web (`apps/web`): `credentials: 'include'` em fetch; **não** persiste access/refresh JWT em
  `localStorage` nem `sessionStorage` (só o perfil `sch_user`). Hosts cookie-first
  (`lojasschimitz.com.br`, Android WebView) enviam cookies HttpOnly `sch_refresh` + `sch_access`
  e **não** mandam Bearer nem body `refreshToken`. Localhost ainda pode mandar Bearer/body a
  partir da **memória** da aba (API cross-origin `:3001`).
- **Limite honesto:** em localhost web:3000 → api:3001 o cookie cross-site pode não colar
  sem HTTPS + `SameSite=None`. Em produção o proxy same-origin `/api/v1` cola o cookie no
  host da loja (`REFRESH_COOKIE_DOMAIN` no Nest é opcional; o proxy remove `Domain`).
- Env: `REFRESH_COOKIE_ENABLED` (default true), `REFRESH_COOKIE_NAME`, `REFRESH_COOKIE_SECURE`,
  `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_DOMAIN`, `REFRESH_COOKIE_MAX_AGE_SEC`,
  `REFRESH_JSON_TOKEN_ENABLED` (default **true**).

### expireReservations multi-réplica
- Job ainda é `setInterval` in-process (cada réplica agenda).
- Transições de pedido já são DB-safe (UPDATE condicional `awaiting_payment`).
- SCH-006: lease em tabela `SchedulerLock` (CREATE IF NOT EXISTS) para só uma réplica
  executar o ciclo — evita `cancelIntent`/logs duplicados. Sem Redis.


## MEGA Phase 8

Checklist + hardening seguro: ver `docs/MEGA-PHASE-8-SECURITY.md`.
- Filtro global: em prod/staging, HTTP ≥500 sempre `Erro interno` (sem stack/details).
- Storefront: headers baseline (HSTS/XFO/nosniff/…) + `poweredByHeader: false` + **CSP gradual** (`storefront-csp.ts`: `'self'` + `'unsafe-inline'`/`'unsafe-eval'` para Next + hosts Mercado Pago Brick/SDK + `img-src https:` para uploads). **Não** é nonce-strict.
- Dual-mode refresh **mantido no default do código**. `REFRESH_JSON_TOKEN_ENABLED` default **true**.
  Cookie-only JSON é opt-in: ver checklist abaixo (Railway, serviço da API).


## MEGA Phase 9

IDOR/BOLA + refresh cookie-prefer: ver `docs/MEGA-PHASE-9-CHECKPOINT.md`.
- Orders/addresses: ownership por `userId`; cross-user → **404** (`ORDER_NOT_FOUND` / `ADDRESS_NOT_FOUND`).
- PATCH `/me`: somente `name`/`phone` (sem escalada de role).
- Admin: `RolesGuard` + `@Roles('admin')` (customer → 403).
- Refresh: cookie HttpOnly tem precedência; body fallback **no servidor**; JSON `refreshToken` dual (default).
- Cookie-only JSON: `REFRESH_JSON_TOKEN_ENABLED=false` no serviço **API** (Railway), com cookie enabled.
  Merge **não** flipa prod. Rollback = unset / `true`.
- CSRF: SameSite=Lax via proxy mitiga POST cross-site; residual se `SameSite=None` direto na API.

### Flip checklist — cookie-only JSON (`REFRESH_JSON_TOKEN_ENABLED=false`)

O default no código permanece **true** (unset = compat). Ativar é um passo de **env no Railway**,
depois do merge, com OK explícito do dono. **Não** alterar variáveis de produção neste PR.

1. Merge deste código (API + web) e aguardar deploy Railway (API **e** web).
2. Confirmar Set-Cookie `sch_refresh` (HttpOnly) em login/register/refresh via
   `https://lojasschimitz.com.br/api/v1/...` (proxy same-origin; `credentials: include`).
3. No serviço **API** (não no web): setar `REFRESH_JSON_TOKEN_ENABLED=false`.
   Redeploy/restart do serviço API se o Railway não recarregar env sozinho.
4. Smoke **web** (`lojasschimitz.com.br` + Admin `/admin`):
   - Login → JSON **sem** `data.refreshToken`; resposta tem `Set-Cookie: sch_refresh`.
   - Refresh (access expirado ou `POST /auth/refresh` com body `{}`) → novo access; cookie rotaciona.
   - Logout → cookie `Max-Age=0`; chamada protegida pede login.
   - DevTools: **sem** `sch_refresh` nem `sch_access` em `localStorage`/`sessionStorage`.
5. Smoke **Android WebView** (same-origin `lojasschimitz.com.br`): CookieManager first-party on;
   login → uso autenticado → logout. Esperado: cookie HttpOnly, sem body refresh.
6. **Rollback instantâneo:** no serviço API, `REFRESH_JSON_TOKEN_ENABLED=true` ou **unset**
   (volta a incluir `refreshToken` no JSON). Cookie continua sendo setado.

Residual aceito após o flip: body refresh ainda **aceito**
no servidor se enviado (localhost/legado); CSRF SameSite residual se alguém chamar a API
Railway direto com `SameSite=None`. Access JWT sai do web storage — cookie HttpOnly `sch_access`
+ Bearer só em memória no localhost.

## MASTER LOTE 4 — residual security audit (P0/P1)

Auditoria 2026-09-16: superfície já sólida — **sem mudança de código**.

| Controle | Status | Evidência |
|----------|--------|-----------|
| Helmet (API) | OK | `main.ts` — Helmet default + CORP `cross-origin` (uploads); CSP off só se Swagger on |
| Storefront headers | OK | `storefront-security-headers.ts` + `next.config.ts` (`poweredByHeader: false`) |
| CORS allowlist | OK | `CORS_ORIGINS` split → `enableCors({ origin, credentials: true })`; sem `*` |
| Cookie `sch_refresh` | OK | HttpOnly, Path=/, SameSite, Secure em prod/staging (ou se SameSite=None), Domain opcional |
| Rate limit | OK (in-memory) | Global Throttler 100/min + `@Throttle` auth/admin/chat/payments; brute-force login in-process. **Sem Redis** (não inventar). Multi-réplica = limite por processo (já documentado Phase 8 M5). |
| Admin `GET /orders?q=` | OK | Classe `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')`; `@Throttle(30/min)`; `q` `@MaxLength(120)`; take≤50; source locks no spec |

Residual aceito: body refresh ainda aceito no servidor (fallback; JSON omit é o flip), Throttler in-memory multi-réplica, CSRF SameSite residual na API direta, CSP nonce-strict no Next (fase futura).

## 2026-09-18 — reinforcement (Security Pass + LOTE 4)

Código fail-closed + headers + specs. Relatório: `docs/SECURITY-HARDENING-2026-09-18.md`.

| Controle | Status |
|----------|--------|
| Simulate / null webhook em prod | **Fail-closed** — `NODE_ENV`/`RAILWAY_ENVIRONMENT` + strip `NEXT_PUBLIC_*` no `next build` |
| Storefront Permissions-Policy / COOP / CORP | **OK** — COEP **não** (Brick) |
| CSP storefront | Gradual enforce (já Phase A); nonce-strict **deferred** |
| Android `allowFileAccess` | **false** (android_asset offline page intacta) |
| Cookie `sch_refresh` precede body; logout limpa cookie | **Locked** em specs; dual-mode JSON **não** flipado |
| IDOR 404 payments/orders | **Locked** em specs |
| Throttle extra | logout 30/min; PATCH `/me` 20/min; admin uploads 40/min; Redis **deferred** |
| Filtro 4xx/5xx prod-like | Sem stack/paths; Railway conta como prod |
| Redis throttler / rotação de secrets | **Deferred** |

Railway (humano): no serviço **web** confirmar ausência de `NEXT_PUBLIC_ALLOW_PAYMENT_SIMULATE` e `NEXT_PUBLIC_NULL_WEBHOOK_SECRET`. No serviço **API**: `PAYMENTS_PROVIDER=mercadopago` + webhook secret forte; não setar `ALLOW_NULL_*`.

## 2026-09-19 — Phase B (CSP + FRAGILE)

Relatório: `docs/SECURITY-CSP-2026-09-19.md`.

| Controle | Status |
|----------|--------|
| CSP storefront enforce | Gradual **produção** (sem localhost; `js.mercadopago.com`; `upgrade-insecure-requests`; `report-uri`) |
| CSP Report-Only | Probe sem `'unsafe-eval'` — **não** bloqueia. Não promover sem smoke PIX/Brick |
| Collector | `POST /api/v1/security/csp-report` → 204 + log `csp_violation` |
| HSTS | `preload` + `includeSubDomains` |
| OptionalJwt + seller IDOR + inventory/reviews públicos | Fail-closed / 404 / sem `qtyReserved` / sem `user.id` |
| Null provider em Railway production | Override `ALLOW_NULL_PROVIDER_IN_PROD` **ignorado** |
| Cookie-only / Conta / PIX math | **Inalterados** |
| API JSON body (hotfix pós-#60) | `bodyParser: false` + `applyHttpBodyParsers` (json 1mb + urlencoded + CSP types). Sem isso login/register 400 IsEmail |

