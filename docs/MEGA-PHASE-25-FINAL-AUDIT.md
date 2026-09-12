# MEGA Phase 25 — FINAL independent audit

**Data:** 2026-09-12 ~20:35 America/Sao_Paulo (UTC-3)  
**Auditor:** Grok Bot (executor) — independente dos checkpoints de implementação  
**Base git (repo `main`):** `4011d10` (`docs: set MEGA Phase 19-23 checkpoint commit SHA`)  
**Código de features 19–23:** `60b2a8d`  
**Escopo:** leitura de código + `docs/MEGA-PHASE-*.md` + smoke **read-only** em produção.  
**Não feito nesta auditoria:** cobranças MP, Play publish, fake photos, secrets, mutations em prod.

---

## Legenda de maturidade

| Tag | Significado |
|-----|-------------|
| **IMPLEMENTADO** | Código no repo (e/ou docs) cobre o comportamento |
| **TESTADO LOCAL** | Unit/chaos/specs ou build local documentados (muitos `*.db.spec` SKIP sem Postgres no box) |
| **TESTADO PRODUÇÃO** | Evidência live (curl) nesta auditoria ou em checkpoint anterior com curl |
| **BLOQUEIO EXTERNO** | Depende de dono / conta / DNS / Play / provedor — não é bug de código |

---

## Resumo executivo

A loja **pode receber um pedido e um PIX/cartão via Mercado Pago** do ponto de vista de arquitetura (intent + webhook HMAC + CAS paid + estoque + e-mail). Em produção, o catálogo público ainda está **majoritariamente com fotos placeholder**, o fulfillment é **manual** (carrier `propria`), marketplace **não faz split**, Schimitz+ **não tem campanha**, chat roda **sem LLM**, e o Android **não está em Play production**.

**Gap de deploy:** o repo em `4011d10` inclui `GET /health/ready` (Phase 23), mas a API live ainda responde **404** nessa rota — produção está **atrás** do `main` para o lote 19–23. Liveness `/health`, webhook, admin 401 e catálogo respondem.

**Veredito:** pronta para **venda operacional assistida** (dono no admin + fotos reais + smoke de cobrança controlada), **não** para “marketplace automático / app Play / logística API / campanha Schimitz+” sem ações do dono e fases futuras.

---

## 1. O que ainda pode quebrar numa venda real?

| Risco | Por quê | Mitigação atual | Maturidade |
|-------|---------|-----------------|------------|
| Cliente desiste ao ver `placehold.co` / produto sem foto | Live: **8/9** produtos ativos com placeholder ou imagem ausente; só **1** com upload real (`Ar-condicionado aiwa`) | Admin CSV `GET /admin/ops/products-needing-photos` (código Phase 19; precisa auth + deploy) | IMPLEMENTADO checklist · **BLOQUEIO EXTERNO** fotos |
| Frete errado / CEP sem regra | Cotação = regras CEP locais, **não** API de transportadora | Admin shipping rules; default fee | IMPLEMENTADO · TESTADO LOCAL (regras) · **não** cotação live com Correios |
| Rastreio some / cliente sem código | Carrier default `propria`; Melhor Envio = stub que **nunca** finge sucesso | Admin informa `trackingCode` ao marcar Em trânsito | IMPLEMENTADO manual · **BLOQUEIO EXTERNO** token + wire HTTP |
| Pagamento aprovado sem e-mail | Resend domínio/DNS | Live `mailConfigured: true`; Phase 6 ainda exige DNS Verified no painel Resend | IMPLEMENTADO · TESTADO PRODUÇÃO (presença) · **BLOQUEIO EXTERNO** DNS |
| Duplo crédito / webhook replay | Race MP | CAS `awaiting_payment→paid` + `PaymentEvent` idempotency | IMPLEMENTADO · TESTADO LOCAL (chaos/unit) · **NÃO** TESTADO PRODUÇÃO com cobrança real nesta auditoria |
| PIX 5% vs total do pedido | Display vs autoridade | `pixChargeAmount` na API; approve aplica desconto | IMPLEMENTADO · TESTADO LOCAL · **não** cobrança live aqui |
| Estoque oversell | Concorrência | CAS reserve/commit (Phase 11) | IMPLEMENTADO · TESTADO LOCAL unit · DB race **SKIP** no box |
| Admin não avança fila | Pós-pago fica em `paid` até clique | Buckets ops + hint organizing (Phase 7/13) | IMPLEMENTADO · UI |
| WhatsApp “não chegou” | Só `wa.me` click-to-chat | Sem Cloud API | IMPLEMENTADO por desenho · **BLOQUEIO EXTERNO** se quiser auto-send |
| Cartão sem `cardToken` | MP exige token do Brick/SDK | 400 claro se faltando | IMPLEMENTADO |
| Upload some no redeploy | Disco efêmero sem volume Railway | Docs `DEPLOY.md` volume `/data/uploads` | **BLOQUEIO EXTERNO** ops |
| Deploy parcial (ready 404) | Prod ≠ `main` Phase 23 | Redeploy API após merge | **BLOQUEIO EXTERNO** / ops deploy |

---

## 2. Módulos ainda parcialmente fake / stub

| Módulo | Estado honesto | Tag |
|--------|----------------|-----|
| **Melhor Envio `CarrierProvider`** | Stub: sem token → `NOT_CONFIGURED`; com token → `CARRIER_LIVE_NOT_WIRED` (sem HTTP) | STUB · IMPLEMENTADO interface |
| **Entrega própria** | Real-operacional mas **manual** (não sync) | IMPLEMENTADO |
| **Marketplace split / OAuth MP** | Ledger + portal + CSV repasse **manual PIX**; **sem** split automático | PARCIAL (v1 ledger) · Phase 22 prep |
| **`commissionPercent` no seller** | Usado no ledger; comentário DTO “stub v2” = **não** entra no checkout split | IMPLEMENTADO ledger · stub só no sentido “sem payout API” |
| **Schimitz+ campanha (Phase 21)** | Ledger `/me/loyalty` + earn/redeem existem; **sem** campanha/UI ativar pontos/% prod | PARCIAL prep |
| **Chat LLM** | Opcional; live `llm: false` (FAQ/catálogo/WhatsApp) | IMPLEMENTADO fallback · OpenAI opcional |
| **WhatsApp** | Só `wa.me` — **não** Cloud API | IMPLEMENTADO · não é fake de envio (nunca finge) |
| **Null payment simulate** | Bloqueado em prod sem override | IMPLEMENTADO seguro |
| **Fotos produto** | Seed/`placehold.co` ainda no catálogo live | Dados · não código fake de venda |
| **Chaos Phase 24** | Plano + unit; sem chaos em prod | TESTADO LOCAL unit |

---

## 3. Riscos remanescentes de endpoints

| Endpoint | Risco | Evidência live (2026-09-12) | Tag |
|----------|-------|------------------------------|-----|
| `POST /api/v1/webhooks/mercadopago` | Sem assinatura deve falhar | **401** `WEBHOOK_SIGNATURE_INVALID` / `Assinatura ausente` | TESTADO PRODUÇÃO |
| `GET /api/v1/admin/ops` | Sem JWT | **401** `Token ausente` | TESTADO PRODUÇÃO |
| `GET /api/v1/health` | Expõe `env` + `mailConfigured` (aceito) | **200** `env=production`, `mailConfigured=true`, `meta.requestId` | TESTADO PRODUÇÃO |
| `GET /api/v1/health/ready` | No **repo**; ausente na **API live** | **404** `Cannot GET /api/v1/health/ready` | IMPLEMENTADO no git · **não** TESTADO PRODUÇÃO (deploy lag) |
| `POST /api/v1/chat` | Custo LLM se chave ligada; abuso | **201** FAQ `llm:false`; throttle 20/min no código | TESTADO PRODUÇÃO fallback |
| `POST /api/v1/payments/intents` | Cobrança real se MP live | **Não** exercitado nesta auditoria (sem charge) | IMPLEMENTADO · **NÃO** TESTADO PRODUÇÃO aqui |
| `GET /api/v1/products` | Placeholder URLs públicas | **200**; 9 itens; 8 placeholder/missing | TESTADO PRODUÇÃO |
| Refresh dual-mode / localStorage JWT | XSS residual (Phase 8/9) | Docs only | IMPLEMENTADO mitigação parcial |
| Throttler in-memory | Multi-réplica fraco | Docs SECURITY | CONHECIDO |
| Swagger `/docs` | Deve estar off | Checkpoint 8: 404 | TESTADO PRODUÇÃO (fase 8) |

**Path correto do webhook:** `/api/v1/webhooks/mercadopago` (não `/payments/webhook`).

---

## 4. O que ainda precisa de intervenção manual?

1. **Fotos reais** de produto (substituir placehold.co / preencher ausentes) via admin upload.  
2. **Fila de pedidos:** após pago, avançar `paid → organizing → … → in_transit` (+ tracking manual).  
3. **Repasse sellers:** PIX manual + marcar commission `paid` com referência.  
4. **Play Console:** 12 testers, App Signing SHA em `assetlinks.json`, publish (quando quiser).  
5. **Redeploy API** para pegar Phase 19–23 (`/health/ready`, CSV fotos, structured log).  
6. **Volume Railway** `/data/uploads` (se ainda não montado).  
7. **Confirmar Resend** domínio Verified + `MAIL_FROM` do domínio.  
8. **Smoke de cobrança real** (PIX sandbox/prod controlado) — dono.  
9. **Regras CEP / frete** alinhadas à operação real.  
10. **Não** setar `CARRIER_PROVIDER=melhor_envio` até HTTP live existir.

---

## 5. Integrações que são stubs (ou semi-stubs)

| Integração | Stub? | Notas |
|------------|-------|-------|
| Mercado Pago payments | **Não** (adapter real) | Simulate null bloqueado em prod |
| Mercado Pago Marketplace split | **Sim / não built** | Só ledger manual |
| Melhor Envio | **Sim** | `CARRIER_LIVE_NOT_WIRED` |
| OpenAI / Chat LLM | **Opcional** | Live sem LLM |
| WhatsApp Cloud API | **Não implementado** | `wa.me` only |
| Resend HTTP | **Implementado** | DNS = externo |
| Correios/Jadlog diretos | **Não** | — |
| R2/S3 uploads | **Futuro** | Disco local + volume |

---

## 6. O que NÃO foi testado em produção (nesta auditoria)

- Cobrança PIX/cartão real (criar intent → pagar → webhook approve → estoque commit)  
- Refund admin live  
- Login/checkout E2E completo no browser  
- `/admin/ops` autenticado + CSV fotos (401 sem token — esperado)  
- `GET /health/ready` (404 — deploy)  
- Race de estoque / webhook duplicate sob carga  
- App Android WebView em device + Asset Links com Play App Signing SHA  
- Seller portal com segundo vendedor real  
- Schimitz+ redeem ponta a ponta com saldo real  
- E-mail deliverability (SPF/DKIM inbox) além do flag `mailConfigured`  
- Chaos DB-down readiness em staging  

---

## 7. Live smoke (2026-09-12 ~20:30 BRT)

```
GET  https://lojasschimitz.com.br/api/v1/health
  → 200  env=production  mailConfigured=true  meta.requestId=…

GET  https://lojasschimitz.com.br/api/v1/health/ready
  → 404  Cannot GET /api/v1/health/ready   ← prod atrás do main

GET  https://www.lojasschimitz.com.br/
  → 301  location: https://lojasschimitz.com.br/

GET  https://lojasschimitz.com.br/
  → 200  (+ HSTS, XFO, nosniff, referrer-policy — Phase 8 web)

POST https://lojasschimitz.com.br/api/v1/webhooks/mercadopago  {}
  → 401  WEBHOOK_SIGNATURE_INVALID / Assinatura ausente

GET  https://lojasschimitz.com.br/api/v1/admin/ops
  → 401  Token ausente

GET  https://lojasschimitz.com.br/api/v1/products?page=1&pageSize=60
  → 200  total=9
     placeholder placehold.co: 7
     image missing: 1  (duplicata “Ar-condicionado aiwa” sem image)
     upload real: 1   (Ar-condicionado aiwa → /api/v1/uploads/518992fa-….png)

POST https://lojasschimitz.com.br/api/v1/chat  {"message":"horario"}
  → 201  llm=false  FAQ + wa.me
```

Storefront security headers: **presentes** no apex (Phase 8). API Helmet/CSP: **presentes**.

---

## 8. Matriz por fase MEGA (1–25)

| Fase | Tema | Código | Local | Produção | Bloqueio externo |
|------|------|--------|-------|----------|------------------|
| 1–2 | www / upload rewrite / low stock | IMPLEMENTADO | — | www 301 live | Cloudflare www (mitigado) |
| 3 | Admin ops badges | IMPLEMENTADO | unit | admin 401 | — |
| 4 | Upload + placeholders ops | IMPLEMENTADO | unit | uploads path live | Fotos dono |
| 5 | SEO apex | IMPLEMENTADO | — | robots/sitemap (fase 17) | — |
| 6 | Mail harden | IMPLEMENTADO | unit | mailConfigured true | Resend DNS |
| 7 | Filas fulfillment | IMPLEMENTADO | unit | — | Carrier API |
| 8 | Security headers | IMPLEMENTADO | — | TESTADO PRODUÇÃO | — |
| 9 | IDOR / refresh | IMPLEMENTADO | unit | refresh path docs | — |
| 10 | Pricing / webhook idem | IMPLEMENTADO | unit | — | Charge real |
| 11 | Inventory CAS | IMPLEMENTADO | unit; DB SKIP | — | — |
| 12 | Order SM | IMPLEMENTADO | unit; DB SKIP | — | — |
| 13 | Ops command center | IMPLEMENTADO | unit | — (auth) | — |
| 14 | CarrierProvider | IMPLEMENTADO + stub ME | unit | propria default | Token ME |
| 15 | Notifications lifecycle | IMPLEMENTADO | unit | — | Resend |
| 16 | Perf indexes | IMPLEMENTADO | tsc | migrate ops | — |
| 17 | JSON-LD | IMPLEMENTADO | unit | SEO curls fase 17 | — |
| 18 | Android WebView 1.0.3 | IMPLEMENTADO AAB | gradle | **não** Play prod | 12 testers + SHA |
| 19 | Catalog photos CSV | IMPLEMENTADO | unit | **deploy lag?** | Fotos |
| 20 | Chat harden | IMPLEMENTADO | unit | chat llm=false | OpenAI opcional |
| 21 | Schimitz+ | PARCIAL prep | — | loyalty API exists | Regras campanha |
| 22 | Marketplace activation | PARCIAL prep | — | ledger only | MP split / KYC |
| 23 | Observability / ready | IMPLEMENTADO | unit | health OK; **ready 404** | Redeploy |
| 24 | Chaos plan | Plano + unit | unit | **não** | — |
| **25** | **Final audit** | **este doc** | — | smoke acima | Owner list |

---

## 9. Ações do dono (OWNER) — checklist

| # | Ação | Prioridade p/ venda |
|---|------|---------------------|
| 1 | **Fotos** — substituir placeholders; usar admin upload + volume Railway | **Crítica** |
| 2 | **Real charge OK** — 1 PIX (e se possível 1 cartão) controlado; confirmar webhook → `paid` + e-mail + estoque | **Crítica** |
| 3 | **Play 12 testers** — preencher faixa closed antes de promover | App (não bloqueia web) |
| 4 | **Play signing SHA** — App Signing cert → `assetlinks.json` (manter upload key) | App / TWA |
| 5 | **Carrier token** — Melhor Envio (ou outro) só no Railway; **não** ativar `CARRIER_PROVIDER=melhor_envio` até HTTP wired | Logística futura |
| 6 | **OpenAI optional** — só se quiser LLM no chat; billing OWNER; chat já funciona sem | Opcional |
| 7 | Resend DNS Verified + smoke forgot-password no e-mail do dono | Alta |
| 8 | Redeploy API (`main` ≥ `60b2a8d`) para `/health/ready` + CSV fotos | Alta ops |
| 9 | Confirmar volume `/data/uploads` | Alta se uploads |
| 10 | Definir regras Schimitz+ / sellers KYC antes de “ativar marketplace” | Estratégico |

---

## 10. Explicitamente fora / seguro nesta auditoria

- Sem cobranças, sem Play publish, sem gerar fotos fake, sem secrets no git  
- Sem “corrigir” stub Melhor Envio fingindo sucesso  
- Sem ativar Phase 21/22  
- Nenhum bug crítico seguro exigindo hotfix de código encontrado além do **lag de deploy** (ops) e **dados de catálogo** (dono)

---

## 11. Fontes

- `docs/MEGA-PHASE-1-2` … `19-23`, `21-22-PREP`, `8-SECURITY`, `CHAOS-TEST-PLAN`  
- `docs/MARKETPLACE.md`, `CHAT.md`, `WHATSAPP.md`, `PIX-DISCOUNT.md`, `DEPLOY.md`, `API.md`, `SECURITY.md`  
- Código: `health.controller.ts`, `melhor-envio.carrier.ts`, `chat.service.ts`, `payments.controller.ts` (`webhooks/mercadopago`), `admin-ops.ts`, `commissions/*`, `loyalty/*`  
- Curls live listados na §7  

## COMMIT

| Campo | Valor |
|-------|--------|
| **Doc** | `docs/MEGA-PHASE-25-FINAL-AUDIT.md` |
| **Author** | schimitz-clt \<schimitzclaiton@gmail.com\> |
| **Base** | `4011d10` |
