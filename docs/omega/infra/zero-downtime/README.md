# Deploy sem queda (Railway)

Sonda: `probe.mjs` — a cada 0,5 s GET `/` da loja; a cada 1 s alterna `/api/v1/health` via loja (proxy Next)
e direto no domínio da API (≤ 60 req/min/IP: o throttler da API é 100/min/IP — a 1ª tentativa a 4 req/s levou 429 e foi descartada).

## Antes (produção, redeploy do mesmo build)
- **Web** (redeploy 7f767455): loja `/` 0 falhas em 480. O web já troca sem queda (healthcheck `/`, sem volume).
- **API** (redeploy 7d9458e5, timeout 5 s): 5 falhas seguidas em ~5 s (timeouts) — 3/150 via loja, 2/150 direto.
- **API** (redeploy ff735ac8, timeout 30 s): 5 falhas em ~5 s (502 do edge) — 2/120 via loja, 3/120 direto.

Causa: a API tem volume (`/data/uploads`). Serviço com volume não roda duas versões ao mesmo tempo no Railway:
a antiga para, a nova sobe (container → Nest pronto ≈ 1 s; `prisma migrate deploy` sem pendências < 1 s), e o
edge responde 502 nesse intervalo. Além disso o processo antigo (PID 1, sem handler de SIGTERM) morria sem
terminar requisições nem rodar os hooks de shutdown (flush final das métricas financeiras, `$disconnect`).

## Mudanças
- API `main.ts`: SIGTERM/SIGINT → `app.close()` (drena requisições, roda hooks) com limite de 8 s; `railway.toml` `drainingSeconds = 10`.
- Web `railway.toml`: `overlapSeconds = 20`, `drainingSeconds = 15` (next start já fecha com graça no SIGTERM).
- Proxy `/api/v1` da loja: GET/HEAD com 502/504/erro de rede tenta de novo (0,5→2 s, até 11 s). Nunca repete POST/PUT/PATCH/DELETE. API não emite 502/504.
- Migrações continuam no start (medidas < 1 s; mover para preDeploy não compensa o risco).
