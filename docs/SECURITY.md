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
- **Modo dual (intencional):** a API continua devolvendo `refreshToken` no JSON (mobile TWA,
  clientes legados, fallback cross-origin). Em paralelo, seta cookie HttpOnly `sch_refresh`
  (`Path=/`, `SameSite` configurável, `Secure` em prod/staging).
- `POST /auth/refresh` aceita body **ou** cookie (body tem precedência).
- `POST /auth/logout` limpa o cookie e revoga o refresh; access JWT é opcional (se expirado, ainda revoga via cookie/body).
- Web (`apps/web`): `credentials: 'include'` em fetch; access curto permanece em localStorage;
  refresh em localStorage fica como fallback se o cookie cross-site não for enviado.
- **Limite honesto:** em localhost web:3000 → api:3001 o cookie cross-site pode não colar
  sem HTTPS + `SameSite=None`. Em produção use domínio compartilhado
  (`REFRESH_COOKIE_DOMAIN=.lojasschimitz.com.br`) ou proxy same-site.
- Env: `REFRESH_COOKIE_ENABLED` (default true), `REFRESH_COOKIE_NAME`, `REFRESH_COOKIE_SECURE`,
  `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_DOMAIN`, `REFRESH_COOKIE_MAX_AGE_SEC`.

### expireReservations multi-réplica
- Job ainda é `setInterval` in-process (cada réplica agenda).
- Transições de pedido já são DB-safe (UPDATE condicional `awaiting_payment`).
- SCH-006: lease em tabela `SchedulerLock` (CREATE IF NOT EXISTS) para só uma réplica
  executar o ciclo — evita `cancelIntent`/logs duplicados. Sem Redis.


## MEGA Phase 8

Checklist + hardening seguro: ver `docs/MEGA-PHASE-8-SECURITY.md`.
- Filtro global: em prod/staging, HTTP ≥500 sempre `Erro interno` (sem stack/details).
- Storefront: headers baseline (HSTS/XFO/nosniff/…) + `poweredByHeader: false`.
- Dual-mode refresh **mantido**.

