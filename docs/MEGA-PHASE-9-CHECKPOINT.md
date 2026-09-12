# MEGA Phase 9 — deep security (IDOR/BOLA + refresh)

**Data:** 2026-09-12 ~19:55 America/Sao_Paulo (UTC-3)  
**Base git:** `069fa65` (Phase 8)  
**Escopo:** IDOR/BOLA (orders/addresses/me), admin authz tests, dual-mode refresh hardening (cookie-prefer + deprecation path). Sem cobrança MP, sem migration destrutiva, sem Play publish, sem rotação de secrets.

## FASE
Phase 9 — deep security

## STATUS
Concluída (código + unit specs + docs). Cookie-only JSON omit **não** ativado em prod (deprecation path apenas).

## COMMIT
Preenchido no relatório pós-push (git rev-parse HEAD).

## DEPLOY
Push `main` → Railway redeploy automático esperado (API + web). Sem migration.

## TESTES
- Unit (sem DB): `ownership`, `roles.guard`, `orders.idor`, `addresses.idor`, `users.idor`, `payment.idor`, `refresh-cookie`, web `auth-session` + suite web.
- Suite API relevante via `npm test -w @schimitz/api` (specs `.db.spec` exigem Postgres localhost — **não** rodados sem DB local; nenhum DATABASE_URL de prod usado).
- Smoke pós-push: health 200, admin 401, webhook 401, logout/refresh clear cookie.

## RESULTADOS
| Área | Resultado |
|------|----------|
| Orders IDOR | Já scoped `publicId+userId`; NotFound agora com `ORDER_NOT_FOUND`; spec contract |
| Addresses IDOR | `findFirst`/`updateMany`/`deleteMany` com `{id,userId}`; `ADDRESS_NOT_FOUND`; spec |
| PATCH /me | DTO só `name`/`phone`; service não escreve role/email/status; spec |
| Admin authz | `JwtAuthGuard`+`RolesGuard`+`@Roles('admin')` confirmado; customer → 403 contract |
| Refresh | Cookie **preferido** sobre body; body fallback; JSON `refreshToken` **mantido** (default) |
| CSRF cookie POST | Documentado (abaixo); **sem** Origin/Referer novo (não havia padrão seguro) |
| Bugs reais | Nenhum IDOR aberto encontrado além de hardening defense-in-depth / códigos 404 |

## PRODUÇÃO
- Web já cookie-first (não grava `sch_refresh` em localStorage fora de localhost).
- Android = WebView same-origin → cookies + `credentials: 'include'` devem funcionar.
- `REFRESH_JSON_TOKEN_ENABLED` default **true** (compat). Só desligar após prova Set-Cookie em login/refresh/logout web+Android.

## RISCOS
1. **CSRF residual em refresh/logout** se cookie `SameSite=None` (API direta cross-site). Mitigação prática: proxy Next same-origin reescreve para **Lax** → POST cross-site não envia cookie. CORS allowlist impede leitura da resposta por origens estranhas; side-effect CSRF em `SameSite=None` direto na API ainda é residual (rotação/revogação). Origin/Referer **não** adicionados nesta fase (sem padrão existente; risco de quebrar WebView/proxy).
2. **Access JWT** ainda em localStorage (XSS) — residual Phase 8 A2; fora do cookie-only access.
3. **Omitir `refreshToken` do JSON** cedo demais quebraria localhost e clientes que ainda leem body — por isso default permanece true.
4. Precedência cookie>body: cliente com cookie stale + body fresco usaria cookie — aceitável; web prod não manda body.

## PENDÊNCIAS
- Ativar `REFRESH_JSON_TOKEN_ENABLED=false` só após e2e Set-Cookie (login→refresh→logout) web prod + Android WebView.
- Opcional futuro: Origin check em `/auth/refresh` alinhado a `CORS_ORIGINS` se API for chamada cross-site com `SameSite=None`.
- Redis throttler multi-réplica (Phase 8 M5).
- CSP estrito Next (Phase 8 M6).

## BLOQUEIOS
- Cloud Agents indisponíveis → trabalho local.
- Sem Postgres localhost neste ambiente → `.db.spec` não executados aqui.
- Sem cobrança MP / sem Play publish (explícito).

## Refresh migration (julgamento)

| Passo | Feito? | Nota |
|-------|--------|------|
| (1) Parar de gravar refresh em localStorage (não-localhost) | Sim (já Phase 8; reforçado comentários/tipos opcionais) | Android WebView herda same-origin |
| (2) API aceita body; prefere cookie | Sim | `resolveRefreshToken` cookie-first |
| (3) Omitir JSON quando cookie enabled | **Path only** | `shapeAuthSessionPayload` + `REFRESH_JSON_TOKEN_ENABLED` default true — full cookie-only JSON omit **adiado** (risco logout/refresh/localhost) |

**Por que não cookie-only JSON neste turn:** sem e2e Set-Cookie comprovado neste ambiente para login+refresh+logout em web proxy e Android WebView; localhost ainda depende de body; mobile/legado podem ler JSON. Hardening + deprecation é o caminho seguro.

## CSRF — cookie refresh POST

- `SameSite=Lax` (dev default / proxy rewrite): cookie **não** vai em POST cross-site → CSRF clássico mitigado.
- `SameSite=None; Secure` (default Nest prod quando Secure): cookie pode ir em fetch cross-site com `credentials`; CORS bloqueia leitura; side-effect (refresh rotation / logout) é o residual.
- Não adicionamos Origin/Referer nesta fase (sem padrão prévio em auth; WebView/proxy podem omitir ou variar Referer).

## Arquivos
- `apps/api/src/common/ownership.ts` (+ spec)
- `apps/api/src/common/guards/roles.guard.spec.ts`
- `apps/api/src/modules/orders/orders.idor.spec.ts` / `orders.service.ts` (codes)
- `apps/api/src/modules/addresses/addresses.idor.spec.ts` / `addresses.service.ts`
- `apps/api/src/modules/users/users.idor.spec.ts`
- `apps/api/src/modules/auth/refresh-cookie.ts` (+ spec) / `auth.controller.ts`
- `apps/web/src/lib/api.ts`
- `docs/SECURITY.md`, `.env.example`, `apps/api/package.json`
- `docs/MEGA-PHASE-9-CHECKPOINT.md`
