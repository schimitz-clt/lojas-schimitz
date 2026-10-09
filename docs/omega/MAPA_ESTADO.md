# Lojas Schimitz: mapa do estado real (Fase Zero da diretiva OMEGA)

**Data:** 09/10/2026, por volta de 00:50 UTC (21:50 BRT de 08/10). **Última atualização: 09/10/2026 ~17:20 UTC (seção 8). Main = 8accc39.**
**Base:** `origin/main` = `f842843` (merge do PR #172), inspecionada num worktree separado (`/workspace/ls-omega-mapa`)
**Método:** leitura do código, logs do CI, Railway (somente leitura) e GETs públicos na produção. Também usei duas cotações de frete públicas, que não gravam nada nem cobram. Não houve escrita em produção, cobrança, pedido nem conta nova.

Legenda de status:
- **IMPLEMENTADO+TESTADO**: tem código e teste automatizado verde no CI.
- **OBSERVADO EM PRODUÇÃO**: conferi ao vivo agora.
- **PARCIAL**: falta uma parte.
- **AUSENTE**: não existe.
- **BLOQUEADO**: depende do Hector ou de terceiro.

> A numeração 4.1 a 4.10 é minha. O texto da seção 4 da diretiva chegou truncado para mim, então agrupei os itens da seção 1 ("escopo do ecossistema").

---

## 0. Commits, deploys e branches

| Item | Evidência |
|---|---|
| Commit em produção (API e web) | Railway production: deploys `40d554dc` (API) e `281a15ac` (web), SUCCESS, **commit f842843 (= main)**, de 09/10 00:10 UTC |
| Banco de produção | Postgres 18 (`postgres-ssl:18`), Online |
| db-backup (cron) | Ready. Últimos BACKUP_OK em 02/10, 03/10, 04/10 (com cópia semanal), 05/10 e 06/10. **Não houve backup em 07/10 nem 08/10**, porque o Railway ficou suspenso por falta de pagamento (container parado em 06/10 15:04 UTC). O próximo esperado é hoje às 06:15 UTC (03:15 BRT). |
| Staging | API e web Online, mas **ainda fazem deploy da branch `feat/elite-storefront-zero-demo`** (commits 1a76825/9f46654), não do main. O staging está defasado em relação à produção. |
| Patch pendente no Railway (prod) | `eaf2d14d`, "staged", 0 mudanças, de 23/09. É resíduo inofensivo, mas aparece como "pending work". |
| Avisos no deploy | Web: `"next start" does not work with "output: standalone"`. API: aviso de que `package.json#prisma` está obsoleto (vai quebrar no Prisma 7). |
| CI (GitHub Actions `ci.yml`) | Run 37863437038 em main: **verde**. API: build, `migrate deploy`, `npm test` (153 specs), `test:finance`, `test:security` e `test:sch003` com Postgres 16. Web: `tsc`, `next build` (44 páginas) e `npm test` (88 specs). **Não existe teste E2E de navegador nem job Android no CI.** |
| PRs abertos | #173 (importação por planilha, outra frente em andamento). #134, #136 e #138 (cadastro com CPF/e-mail já usado), de 24/09: **obsoletos**, porque o main já tem `CPF_ALREADY_REGISTERED` e `EMAIL_ALREADY_REGISTERED` (auth.service.ts:135-136). Proposta: fechar os três, com OK do Hector. |
| Branches | São 80 remotas. Todas as que estão à frente do main têm PR já MERGED (squash), exceto `cursor/admin-ops-mail-recon-alerts-05b5` (#39) e `cursor/mercado-pago-checkout-fa00` (#9), que têm PR CLOSED e são antigas e superadas. `feat/elite-storefront-zero-demo` já foi integrada (#169). Proposta: limpeza de branches, só com OK. |

## 1. Matriz de subsistemas

### 4.1 Loja virtual (web, Next 15.5.27)
| Item | Status | Evidência |
|---|---|---|
| Rotas públicas | OBSERVADO EM PRODUÇÃO | `/`, `/produtos`, `/produto/[slug]`, `/carrinho`, `/termos`, `/privacidade`, `/sitemap.xml` e `/robots.txt` respondem 200 em ~0,3-0,5 s. `/checkout` responde 307 (redireciona para login). |
| SSR da página de produto | OBSERVADO EM PRODUÇÃO | O `<title>` e o nome do produto vêm no HTML. |
| **Sitemap** | **FALHA (média)** | A produção serve só 6 URLs estáticas, **sem nenhum produto nem categoria** (`x-nextjs-cache: HIT`). Causa provável: `app/sitemap.ts` engole o erro do fetch (`catch → staticEntries`) e o Next guarda esse resultado degradado em cache por até 1 h. O build roda em paralelo ao redeploy da API. |
| Página de ofertas | PARCIAL | `app/produtos/page.tsx` é `"use client"`, então os produtos não vêm no HTML (SEO). |
| Avisos de copy | PARCIAL | Mensagem de busca vazia e texto de estado vazio duplicado. "3x sem juros" aparece fixo em `home-ux.ts:119`, `app/page.tsx:16` e `pdp-offer.ts:63`. |
| CSP | PARCIAL | Em produção: `script-src` com `'unsafe-eval'` (a versão Report-Only já roda sem ele). `frame-src`/`connect-src` não incluem `*.mercadolivre.com`/`*.mercadolibre.com` (iframe), domínios usados pelo device fingerprint/antifraude do MP. **A verificar** nos relatórios de CSP (`/api/v1/security/csp-report`) antes de mexer. |
| Cabeçalhos de segurança | OBSERVADO EM PRODUÇÃO | HSTS preload, nosniff, XFO, COOP, CORP e Permissions-Policy presentes. |

### 4.2 Aplicativo Android
| Item | Status | Evidência |
|---|---|---|
| Projeto | IMPLEMENTADO | `apps/mobile`: Kotlin + WebView. `:app` (`com.lojasschimitz.app`, versionCode 13 / versionName 1.0.12, min 24 / target 36) e `:admin` (`com.lojasschimitz.admin`, 1.0.0). |
| **Build debug** | **COMPROVADO NO BOX** | JDK 21 + SDK 36 instalados no box. `./gradlew :app:assembleDebug :admin:assembleDebug` gerou `app-debug.apk` (6,2 MB) e `admin-debug.apk` (5,5 MB). Log em `/workspace/omega/android-build.log`. |
| Testes unitários Android | AUSENTE | `testDebugUnitTest` roda 0 testes, porque não existe nenhum. |
| Build release (AAB assinado) | BLOQUEADO | Depende do keystore de upload do Hector, que não está no box nem deve estar. |
| Publicação | BLOQUEADO (Hector/Google) | A conta da Play está pronta e passou pela fase de testadores; aguarda o prazo. O app `:admin` **não** está na Play. |
| App Links | OBSERVADO EM PRODUÇÃO | `/.well-known/assetlinks.json` responde 200 com `com.lojasschimitz.app` e 2 fingerprints. |
| Push FCM | IMPLEMENTADO | O app funciona sem `google-services.json`. Para envio real, o arquivo de Firebase do dono tem de entrar no build release. |
| Pequeno defeito | — | `apps/mobile/admin/build/` não está no `.gitignore` (só `app/build` está). |

### 4.3 Backend/API (NestJS 10 + Prisma 6) e banco
| Item | Status | Evidência |
|---|---|---|
| Saúde | OBSERVADO EM PRODUÇÃO | `/api/v1/health` ok. `/api/v1/health/payments`: `configured:true`, `providerReachable:true` (MP com HTTP 200 em 202 ms), 0 falhas de webhook em 15 min. |
| Escopo | IMPLEMENTADO | 27 módulos (~30 mil linhas), 45 modelos Prisma e migrações até `20260927_financial_core`. |
| Testes | IMPLEMENTADO+TESTADO | 153 specs no `npm test`, incluindo `*.db.spec` contra Postgres real no CI. |
| Dependências | PARCIAL | 3 vulnerabilidades moderadas em `@nestjs/core` (SSE, que a loja não usa). A correção exige NestJS 11. |
| Swagger | OBSERVADO EM PRODUÇÃO | `/api/docs` responde 404 em produção (fechado, intencional). |

### 4.4 Painel administrativo
| Item | Status | Evidência |
|---|---|---|
| Rotas | IMPLEMENTADO | `/admin` com avaliações, catálogo, clientes, cupons, equipe, financeiro, frete, marketplace, notificações, pedidos, vendas e vitrine. |
| Proteção | OBSERVADO EM PRODUÇÃO | API admin sem login responde 401. RBAC coberto por `roles.guard.spec` e `finance-admin.rbac.spec`. |
| Importação em lote | EM ANDAMENTO | PR #173, outra frente. |

### 4.5 Catálogo, preços e estoque
| Item | Status | Evidência |
|---|---|---|
| Reserva de estoque | IMPLEMENTADO+TESTADO | `UPDATE … WHERE qtyOnHand - qtyReserved >= qty` atômico (`inventory.service.ts:56`), com journal `InventoryMovement`, expiração em 30 min com scheduler-lock e specs de concorrência/reserva (`concurrency.spec`, `inventory.db.spec`, `reservations-expiry`). |
| **Catálogo em produção** | **RISCO CRÍTICO DE NEGÓCIO** | São **100 produtos ativos, todos com `isDemo=false`, `sellableTotal=100`, 0 com foto e ~10 unidades cada (998 no total)**. Todos foram criados em 22/09 e nenhum está no seed do repo. A trava anti-compra de demo (`cart.service.ts:328`) não se aplica a eles. **Um cliente real consegue pagar hoje por um "Drone com câmera HD" de R$ 899,90.** Se esse estoque não existe fisicamente até o fim do mês, é venda sem estoque. |
| Peso e dimensões | PARCIAL | As cotações em produção voltam com `assumedPackage:true` (os produtos não têm peso/medidas), então o frete de itens grandes sai subestimado. Depende do catálogo real. |

### 4.6 Contas, autenticação e clientes
| Item | Status | Evidência |
|---|---|---|
| Sessão | IMPLEMENTADO+TESTADO | Argon2. Access e refresh em cookie HttpOnly, refresh com jti e rotação. Bloqueio por tentativas (`login-attempt.spec`). Specs de IDOR para orders, addresses, users e payments. Throttler em 35 pontos. |
| `REFRESH_JSON_TOKEN_ENABLED` | BLOQUEADO (Hector) | **A variável existe no serviço API de produção**, mas não consigo ler o valor. Pelo código (`refresh-cookie.ts:49`), **qualquer valor que não seja `false`/`0`/`off` liga** o refresh no JSON. Com ela vazia, o padrão é seguro. |
| Cadastro | IMPLEMENTADO | Responde 409 para CPF ou e-mail já cadastrado. Isso permite enumerar contas, mas é uma decisão de produto já assumida (`register-enumeration.spec`). |

### 4.7 Busca, favoritos, carrinho, cupons, promoções e cashback
| Item | Status | Evidência |
|---|---|---|
| Busca, favoritos e carrinho | IMPLEMENTADO+TESTADO | Specs `catalog.query`, `favorites.*`, `cart-merge.db`, `search-*`. |
| Cupons | IMPLEMENTADO+TESTADO | Reserva atômica de uso com `maxUses` (`inventory.service.ts:115`). |
| Cashback Schimitz+ | IMPLEMENTADO+TESTADO | O débito é atômico (`UPDATE … WHERE cashbackBalance >= amt`, `loyalty.service.ts:81`), sem gasto duplo. **Não existe campanha ativa**, o que é decisão de negócio. |
| Desconto PIX 5% | IMPLEMENTADO+TESTADO | `pix-discount.db.spec`. |

### 4.8 Checkout, PIX, cartão, pedidos e conciliação
| Item | Status | Evidência |
|---|---|---|
| Valor cobrado | IMPLEMENTADO+TESTADO | Calculado no servidor (`order.total`/`chargeAmount`), nunca vem do cliente. |
| Webhook | IMPLEMENTADO+TESTADO | HMAC `x-signature`. IPN legado sem assinatura é ignorado. Tem idempotência, máquina de estados com transições proibidas, conciliação, órfãos e `AMOUNT_MISMATCH`. Specs `payment.*`, `finance.*` e chaos. |
| Chamadas ao MP | IMPLEMENTADO+TESTADO | `X-Idempotency-Key` nas chamadas ao MP. Estorno com corrida coberta (`finance.refund-race.db.spec`). |
| **Pagamento real ponta a ponta** | **NÃO COMPROVADO** | Nenhum PIX ou cartão real registrado nas auditorias (`MEGA-PHASE-25` diz "não exercitado"). Só há mocks e fakes no CI. `test:sandbox` existe, mas não roda porque não há credencial de teste. |
| "Até 3x sem juros (a loja absorve)" | **A VERIFICAR (Hector)** | A API só repassa `installments`. Os juros são definidos pela **configuração da conta Mercado Pago** (parcelamento sem acréscimo). Se não estiver configurado, a promessa da loja é falsa (CDC). |
| Split de marketplace | IMPLEMENTADO com flags | `MP_MARKETPLACE_SPLIT_ENABLED`/`ALLOW_LIVE` existem em produção. Não consigo ler os valores. |

### 4.9 Separação, expedição e entrega
| Item | Status | Evidência |
|---|---|---|
| Cotação de frete | OBSERVADO EM PRODUÇÃO | CEP 01310-100: Jadlog R$ 21,24 em 4 dias. CEP 90010-000: grátis em POA (custo de SEDEX de R$ 14,67 subsidiado). |
| Etiqueta e rastreio automáticos | AUSENTE (por decisão) | `melhor-envio.carrier.ts:20`: `createLabel`/`track` estão NOT_WIRED. Hoje a etiqueta é manual. Desde o #191 o admin salva/corrige o rastreio num bloco próprio e o cliente é avisado (e-mail + notificação) quando o código muda. Etiqueta via API: ver seção 8. |
| Status do pedido | IMPLEMENTADO+TESTADO | Timeline e matriz de status (`order-status.matrix.spec`, `tracking.db.spec`). |

### 4.10 Notificações, e-mail, atendimento, IA e WhatsApp
| Item | Status | Evidência |
|---|---|---|
| E-mail (Resend) | IMPLEMENTADO+TESTADO | DNS conferido: DKIM `resend._domainkey`, SPF/MX em `send.`, DMARC `p=reject`. **O domínio raiz tem MX nulo (`0 .`)**, então não existe caixa de entrada @lojasschimitz.com.br (item de negócio). |
| Push FCM | IMPLEMENTADO+TESTADO | Variáveis do Firebase presentes em produção. Specs de push e limpeza de tokens mortos. Android 12-: consentimento no app a partir da 1.0.13 (#194, depende de novo AAB). |
| Chat/IA | IMPLEMENTADO+TESTADO | Modo `alfa` por padrão, com ferramentas (busca, produto, comparação, políticas). Usa LLM se `OPENAI_API_KEY` estiver presente (a variável existe em produção), com specs `ai.security` e `ai.tools`. |
| WhatsApp | PARCIAL (por desenho) | Só clique para conversar (`wa.me`). **Não há** WhatsApp Cloud API nem envio automático (`docs/WHATSAPP.md`). Uma "extensão operacional administrativa" no WhatsApp exigiria conta Meta Business, que é do Hector. |

### Transversal: segurança, backups, monitoramento e infraestrutura
| Item | Status | Evidência |
|---|---|---|
| Backups | OBSERVADO EM PRODUÇÃO | age + bucket Railway, diário com cópia semanal, 47 tabelas e uploads referenciados. A restauração completa já foi testada antes. **Hoje há um buraco entre 07/10 e 08/10.** |
| Monitoramento de queda | ATIVO | Rotina externa a cada 30 min. `infra/uptime-monitor` existe no repo, mas **não está implantado** no Railway (foi uma decisão). |
| Observabilidade | IMPLEMENTADO | Logs estruturados com request-id, redação de PII, ops-alerts e métricas financeiras. |
| Uploads | IMPLEMENTADO | Volume Railway, com specs de durabilidade. |
| CI e regras | PARCIAL | Proteção de branch não configurada (precisa de OK). Avisos: a imagem `ubuntu-latest` passa para Ubuntu 26 a partir de 19/10. |

## 2. Comprovado x só escrito
- **Comprovado em produção agora:** site e API no ar com o commit do main, saúde do MP, cotação de frete real, App Links, DNS de e-mail, cabeçalhos/CSP, 401 no admin, backups até 06/10.
- **Comprovado por teste automatizado (CI verde):** estoque e concorrência, idempotência de pedido e pagamento, webhook e assinatura, conciliação, estorno, cupons, cashback, IDOR e RBAC, auth.
- **Comprovado no box:** build debug dos dois apps Android.
- **Só escrito ou nunca exercitado de verdade:** pagamento real com PIX e cartão, estorno real, split de marketplace live, e-mail transacional após pagamento real, push real num aparelho, build release e publicação.

## 3. Bloqueios que dependem do Hector (ação exata)
1. **Catálogo em produção (crítico).** Decidir se os 100 produtos de 22/09 (sem foto, ~10 unidades cada) podem ser vendidos agora.
   - Se não podem, há duas saídas: (a) zerar o estoque ou desativar pelo admin; (b) eu preparo um PR com um "modo vitrine" (vender = desligado) para ele aprovar.
   - Consequência de não agir: um cliente pode pagar por um item que não existe.
2. **`REFRESH_JSON_TOKEN_ENABLED`.** No Railway, abrir o serviço lojas-schimitz e depois a aba Variables. Mudar o valor para `false` ou apagar a variável. Isso causa um redeploy.
3. **Parcelamento sem juros.** No painel do Mercado Pago, em Seu negócio → Custos → Parcelamento, confirmar que até 3x está "sem acréscimo para o comprador". Se não estiver, eu mudo o texto da loja.
4. **Teste de pagamento real.** Fazer 1 PIX e 1 cartão de valor pequeno, e depois o estorno pelo admin. Precisa da autorização dele e custa a tarifa do MP.
5. **Proteção de branch** no GitHub (exigir os 2 checks do CI). Precisa de OK para mudar a configuração do repo.
6. **Staging:** autorizar que o deploy de staging passe a seguir `main` (hoje segue `feat/elite-storefront-zero-demo`).
7. **Fechar PRs obsoletos** (#134, #136 e #138) e limpar branches já integradas.
8. **Itens de negócio:** CNPJ e endereço no admin (`StoreSettings.cnpj`), caixa de e-mail no domínio, keystore e AAB de release, catálogo real (fim de outubro), conta WhatsApp Business (se quiser automação).

## 4. Plano de correções (PRs por gravidade). Itens 2–9 viraram PRs e foram mesclados (ver seção 5); item 1 dispensado pelo Hector.
1. **[Alta] Trava de venda sem estoque real.** Só se o Hector quiser por código e não pelo admin. Seria uma flag `StoreSettings.salesEnabled` (ou equivalente), que bloqueia a criação de pedido e a intenção de pagamento e mostra "em breve" no PDP. Teria spec com banco.
2. **[Média] Sitemap sem produtos.** Parar de gravar em cache o resultado degradado: lançar o erro ou usar revalidação curta no fallback. Usar `API_PROXY_TARGET` no fetch do servidor. Incluir spec.
3. **[Média] Web standalone.** Fazer o `start` usar `node .next/standalone/server.js`, com cópia de `public` e `.next/static`, ou tirar o `output: 'standalone'`. Validar com `next build` e start local.
4. **[Média] CSP.** Ler os relatórios de CSP nos logs. Incluir os domínios de antifraude do MP (`*.mercadolivre.com`, `*.mercadolibre.com`) em `frame-src`/`connect-src` se aparecerem. A remoção do `unsafe-eval` fica preparada, mas só deve ser integrada depois do teste real de cartão.
5. **[Média] SEO da página de ofertas.** Render no servidor com a lista inicial, mantendo a interação no cliente. Fallback do título de ofertas e ajuste de `offerDealIds`.
6. **[Baixa] Copy.** Busca vazia, estado vazio duplicado e "3x sem juros" vindo de uma constante única de `pricing.ts`, condicionado à confirmação do item 3 da seção 3.
7. **[Baixa] Higiene.** `prisma.config.ts` (preparação para o Prisma 7). Fixar `runs-on: ubuntu-24.04` no CI antes de 19/10. `.gitignore` de `apps/mobile/admin/build`. Campos do `/health` no `docs/API.md`.
8. **[Baixa] CI Android.** Job `assembleDebug` dos dois apps, mais um teste unitário mínimo da allowlist de URLs do WebView.
9. **[Opcional] Teste E2E local** (Playwright) do fluxo carrinho → checkout → PIX, com MP fake e Postgres local.

## 5. Progresso da fase de correções (atualizado em 09/10/2026, ~02:00 UTC)

Pré-checagem (só leitura): deploy do 2b99476 (#173) em produção com SUCCESS (API 6210b616, web e9086bd1). `/`, `/produtos` e `/admin` respondem 200; `/health` ok; `/health/payments` ok, com o provedor alcançável.

| Item | PR | O que resolve | CI | Prova |
|---|---|---|---|---|
| 2 | #174 | Sitemap não fica preso no resultado degradado (sem produtos) quando a API falha no build: agora `force-dynamic`, `no-store`, log `SITEMAP_CATALOG_DEGRADED` | verde | `next build` com a API fora e rota ƒ; em runtime: API fora → 6 locs, de volta → 12 na hora. Produção pós-2b99476 tinha 118 locs, o que confirma a causa |
| 3 | #175 | Tira `output: 'standalone'`: o Railway usa `next start`, então some o aviso do deploy | verde | build e start locais com rotas 200, sem aviso; spec falha no main |
| 4 | #176 | Evidência de que a CSP **não** bloqueia o antifraude do MP; spec que trava os hosts observados | verde | Chrome na origem real emulada: 0 violações com e sem unsafe-eval; Brick pronto, BIN/parcelas ok (cartão de teste). Nenhum domínio novo foi necessário |
| 4b | #177 (DRAFT) | Remove `unsafe-eval` em produção | verde | 12 rotas, 0 violações. **NÃO MESCLAR antes de um teste real de cartão (3DS não foi exercitado)** |
| 5 | #178 | Ofertas: SSR (produtos no HTML), título com fallback "Ofertas", filtro `compareAtPrice > price` numa query só (sai offerDealIds) | verde | página 200, título "Ofertas \| Lojas Schimitz", 5 produtos no HTML, 0 requests de /products no cliente; spec com Postgres real |
| 6 | #179 | "sem juros" de uma fonte só (texto mantido); busca vazia cita o termo; frases duplicadas removidas; cópia de departamento vazio centralizada | verde | spec guarda; mutação falha |
| 7 | #180 | CI em ubuntu-24.04; .gitignore admin/build; docs de /health, /health/ready e /health/payments; spec docs↔código. prisma.config.ts **adiado** (só dá para provar em deploy real) | verde (já em ubuntu-24.04) | mutação falha |
| 8 | #181 | Job Android no CI + primeiro teste JVM (PushRegisterPolicy) | verde (web, api, android) | 7 testes locais; mutação falha |
| 9 | #182 | E2E de navegador carrinho → checkout → PIX → webhook → pago, com MP falso e Postgres local, rodando no CI (job ~2 min) | verde (web, api, e2e) | local ~6 s; mutação (MP não aprova) falha |

Merges autorizados pelo Hector ("Autorizo todos os merges.", mensagem t36u de 09/10 às 01:16 UTC, repassada pelo agente principal). Item 1 resolvido pelo Hector ("Pode deixar vendendo, eu tenho esse estoque"): não haverá trava de vendas.
Antes de cada merge, o CI do head estava verde. Merge normal, sem force push. Quando havia conflito, a branch recebia o main (juntando as listas de teste do package.json) e o CI rodava de novo.

| Ordem | PR | Commit de merge | Deploy API | Deploy web | Home e /api/v1/health |
|---|---|---|---|---|---|
| 1 | #176 | aee9561 | SKIPPED (sem mudança) | 161387ac SUCCESS | 200 / 200 |
| 2 | #174 | f56665a | SKIPPED | b12f436c SUCCESS | 200 / 200; sitemap com 118 locs |
| 3 | #175 | 3ec4793 | SKIPPED | 6761cad4 SUCCESS: log `next start`, "Ready in 401ms", **sem o aviso de standalone**; 8 rotas e os assets 200 | 200 / 200 |
| 4 | #178 | 72c566a | 364a5dfd SUCCESS | 0c5db7a9 SUCCESS | 200 / 200; Ofertas com 24 produtos no HTML |
| 5 | #179 | b0b2fca | SKIPPED | 958c2134 SUCCESS | 200 / 200; "3x sem juros" igual |
| 6 | #180 | 3274635 | ae1d74d9 SUCCESS | SKIPPED | 200 / 200; /health/payments ok |
| 7 | #181 | 034995c | SKIPPED | SKIPPED | 200 / 200 |
| 8 | #182 | b1a787e | f07ad318 SUCCESS | SKIPPED | 200 / 200 |

Smoke final (03:35 UTC, só leitura):
- home: 200.
- busca: `/produtos?q=` 200; `/?q=Alarme` 200; API `q=Alarme` total 1.
- produto: `/produto/alarme-residencial-sem-fio` 200, com título próprio.
- ofertas: 200, título "Ofertas | Lojas Schimitz", 24 links de produto no HTML.
- sitemap: 200, 118 locs (100 de produto).
- /api/v1/health: 200 ok; /health/payments: 200 ok; /admin: 200.

#177 (sem unsafe-eval) segue em DRAFT: **não mesclar** antes de um teste real de cartão.
Pendente: prisma.config.ts (adiado de propósito, junto com o Prisma 7). PRs antigos (#134, #136, #138) e limpeza de branches só com OK do Hector.
Conflitos (simulação local da ordem acima): #174, #175, #178 e #179 acrescentam specs na mesma linha `"test"` de apps/web/package.json. Depois de cada merge, o PR web seguinte precisa de merge do main na branch (resolver juntando as specs das duas versões) e de CI verde de novo. #176, #180, #181 e #182 entram sem conflito.

## 6. Rodada final (09/10/2026, 03:55–04:30 UTC), autorizada pelo Hector (t47u, "Todos!!!")

1. **Staging segue o main.** O staging tem Postgres próprio (serviço ffbcb6ed, volume próprio). O `postgres.railway.internal` resolve dentro da rede privada de cada ambiente. A troca de branch foi feita *staged* só no staging, com accept-deploy só no staging (`connect-service-source` sem staged aplicaria a todos os ambientes). Deploys de staging: API 57d6394e SUCCESS ("No pending migrations to apply", 32 migrations) e web 869f63c2 SUCCESS, ambos em b1a787e. Health da API de staging 200; web de staging `/`, `/produtos`, `/departamento/ofertas` e `/sitemap.xml` 200.
2. **Home no HTML do servidor.** PR #183, merge 2f4cb30. Deploy do web 5a4bc17c SUCCESS (API SKIPPED). Produção: home 200 com 23 links `/produto/` no HTML (antes eram 0); /api/v1/health 200.
3. **Limpeza.** PRs #134, #136 e #138 fechados com comentário. Foram apagadas 75 branches remotas (PR mesclado ou contida no main); a lista com os SHAs está em `/workspace/omega/branches-apagadas.tsv`. Mantidas: main, feat/csp-sem-unsafe-eval (#177), feat/elite-storefront-zero-demo, #9 e #39, as de #134/#136/#138 (não integradas) e 5 de PR mesclado que têm commits **depois** do merge: #53 conta-magalu-menu, #67 storefront-search-suggest, #68 home-product-shelves, #69 pdp-trust-related, #137 signup-existing-email.
4. **Proteção do main.** Exige os 4 checks (Web, API, Android, E2E) e PR, com 0 aprovações; sem force push, sem deleção; enforce_admins=false.
Obs.: o CI do push do #182 no main falhou num erro transitório do `next/font` (download de fonte). Rerodei e ficou verde, sem mudança de código.

## 7. Incidente de estorno (09/10/2026) — PR #184
- Caso: SCH-MV0VVAOC-0183DE, PIX R$ 47,40, pagamento 7f635d2f-…
  - 11:36:36: PATCH status (paid → provavelmente organizing).
  - 11:42:44: POST refund → 500 após 10.777 ms.
  - 11:42:51 e 11:42:56: webhooks; o refunded foi aplicado.
  - 11:43:45: retry → 201 em 8 ms (idempotente).
- Causa: mpFetch sem timeout e sem tratamento; adminRefund deixava qualquer erro do MP virar 500 sem reconsultar o MP. Não havia mutex. A chave `sch-refund-<externalId>` já era estável.
- Correção (#184, merge a41303a):
  - timeout MP_HTTP_TIMEOUT_MS (20 s);
  - reconsulta no MP → 201 / 202 "em processamento" / 422 PROVIDER_REFUND_REJECTED;
  - mutex por pagamento;
  - motivo obrigatório no admin.
- Testes: admin-refund.resilience.db.spec (R01–R08) e refund-outcome.spec; contra o código antigo, 6/8 falham.
- Estoque: não há log de inventário em produção. Pelo código, commitSale ao pagar e restock no estorno se o status era paid/organizing/packing/separating. Não foi observado.

## 8. Rodada "OMEGA AUTONOMOUS COMPLETION" (09/10/2026, 16:25–17:30 UTC)

Regras: merge só com CI verde (4 checks); conferir cada deploy (SUCCESS, health 200, logs sem erro, smoke). #177 não foi tocado.

| PR | O que muda | Commit de merge | Deploy API | Deploy web | Conferência |
|---|---|---|---|---|---|
| #188 | Política: logs só no Railway pelo prazo do plano (sai "6 meses"/Marco Civil) | 29d976b | SKIPPED | afa4814a SUCCESS | smoke 200; texto "revisão 2" no ar |
| #189 | Job apaga produtos vistos e lembretes > 90 dias (a cada 6 h, em lotes, idempotente) | d28ed59 | 399e2f7f SUCCESS | — | logs limpos, "Push FCM: job a cada 30s"; smoke 200 |
| #191 | Admin: bloco "Rastreio" (`PATCH /admin/orders/:id/tracking`), aviso por e-mail + in-app só quando o código muda; auditoria | 214c071 | cce8e321 SUCCESS | dc5c23d8 SUCCESS | rota responde 401 sem sessão; logs limpos |
| #193 | `/health/payments` público sem `recent15m` (volume de vendas) em produção | ce5e29c | 5ab44317 SUCCESS | SKIPPED | corpo sem `recent15m`, status ok |
| #190 | Avaliações públicas: "Maria S.", sem userId; checagem estática corrigida | b9ca568 | abcdf30c SUCCESS | (no deploy seguinte) | /store/reviews 200; logs limpos |
| #194 | Android 12-: pergunta "Receber notificações?" antes de enviar o token; "não" desativa o token; 1.0.13 (versionCode 14); política atualizada | f378c9f | SKIPPED | 7d6cbe18 SUCCESS | /privacidade com "Maria S.", "1.0.13", "90 dias" |
| #192 | Admin: alerta "produtos ativos sem peso/medidas" em /admin/ops + bloco em Importação/Lote com contagem e CSV reimportável (campos vazios, nada inventado) | 8accc39 | 80b65ac6 SUCCESS (rota `ops/products-missing-shipping-data` mapeada) | d1f02fc6 SUCCESS | rota 401 sem sessão; logs limpos |
| #195 | e2e (HTTP) de cartão aprovado e desafio 3DS pendente→aprovado / pendente→recusado com MP falso | f4414c7 | (spec só) | — | CI verde |

**Comprovado:**
- Em produção: deploys SUCCESS, health 200, smoke público 200, logs sem erro, `/health/payments` sem contadores, textos da política no ar.
- Por teste (CI): retenção de 90 dias, rastreio manual e aviso ao cliente, nome abreviado, consentimento Android (JVM), cenários de cartão/3DS, alerta de peso/medidas.

**Só testado (não exercitado de verdade):**
- O job de 90 dias em produção: roda no primeiro tick, mas não loga quando não apaga nada.
- O e-mail de rastreio para um cliente real.
- O diálogo do Android num aparelho: precisa do AAB 1.0.13.
- O 3DS real.

**Etiqueta Melhor Envio via API (item 1b): não implementada, de propósito.** O código não tem as peças:
- dados do remetente (nome, CPF/CNPJ, endereço, telefone, e-mail);
- o `serviceId` não é guardado no `freightSnap`;
- não há nota fiscal nem declaração de conteúdo.

O checkout do ME debita a carteira. Variáveis a criar só quando o Hector decidir (não criadas): `ME_LABEL_ENABLED=false`, `MELHOR_ENVIO_SENDER_NAME`, `MELHOR_ENVIO_SENDER_DOCUMENT` (CPF) ou `MELHOR_ENVIO_SENDER_COMPANY_DOCUMENT` (CNPJ), `MELHOR_ENVIO_SENDER_STATE_REGISTER`, `MELHOR_ENVIO_SENDER_PHONE`, `MELHOR_ENVIO_SENDER_EMAIL`, `MELHOR_ENVIO_SENDER_ADDRESS`, `MELHOR_ENVIO_SENDER_NUMBER`, `MELHOR_ENVIO_SENDER_COMPLEMENT`, `MELHOR_ENVIO_SENDER_DISTRICT`, `MELHOR_ENVIO_SENDER_CITY`, `MELHOR_ENVIO_SENDER_UF`. O token precisa dos escopos `cart-write`, `shipping-checkout`, `shipping-generate`, `shipping-print` e `shipping-tracking`.

**Observações:**
- Cada deploy da API derruba a API por alguns segundos: houve um 502 às ~17:00 UTC. Provavelmente é porque o serviço tem volume, e o Railway não sobrepõe réplicas com volume.
- O E2E do CI falha às vezes ao baixar fontes do Google (`next/font`). Rerodar resolve. Corrigir de vez = fontes locais.
- `STORE_NOTIFY_EMAIL` existe no serviço da API (conferido só pelo nome).

**Smoke final (17:15 UTC, só leitura, main 8accc39, API 80b65ac6 e web d1f02fc6 SUCCESS):**
- Todas estas rotas responderam 200: home, busca (`/produtos?q=Alarme`), produto (`/produto/alarme-residencial-sem-fio`), ofertas (`/departamento/ofertas`), `/privacidade`, `/excluir-conta`, `/api/v1/health`, `/health/ready` e `/health/payments`.
- O sitemap respondeu 200, com 119 `<loc>`.
- Logs do API e do web sem erros.

**Contagem de produtos sem peso/medidas:** não dá para ver de fora. A API pública não expõe peso e eu não acesso o banco de produção. O número aparece para o Hector em **Admin → Importação/Lote → "Conferir produtos sem peso/medidas"** e no alerta do painel de operações.
