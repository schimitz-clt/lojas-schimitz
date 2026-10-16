# Fechamento — itens que dependem só de nós (16/10/2026)

## 1. Regressão em navegador real (PRODUÇÃO)
Chrome headless (playwright-core) a partir do box, desktop 1366×900 e celular Pixel 7, em https://lojasschimitz.com.br.
| Passo | Desktop | Celular |
|---|---|---|
| Home | 200 | 200 |
| /produtos | 200 | 200 |
| Página de produto (`/produto/alarme-residencial-sem-fio`) | 200 | 200 |
| Busca (`/produtos?q=camisa`) | 200, 1 resultado | 200, 1 resultado |
| "Adicionar à sacola" | ok | ok |
| /carrinho | 200, "Sacola (1)", subtotal R$ 249,90 / PIX R$ 237,41 | idem |
| /checkout sem login | redireciona para `/entrar?next=%2Fcheckout` (esperado) | idem |
| /entrar | 200, formulário de e-mail | idem |
- Erros JS (pageerror): **0**. Nenhum POST de pedido/pagamento disparado.
- Rede 4xx/5xx: só `POST /api/v1/auth/refresh → 401` em cada página. É a restauração da sessão por cookie para o visitante sem login (`ensureHydratedSession`), por isso aparece 1 erro de console por página. Não quebra nada. Tirar isso exige um cookie-pista não-HttpOnly e mexe no fluxo de sessão do WebView, então ficou fora deste pacote.
- Sitemap: 119 URLs, **119 × 200**.
- **NÃO COMPROVADO:** checkout depois do login até a etapa de pagamento em produção. Não há conta de teste em produção, e criar uma seria criar dados reais. Essa parte é coberta pelos e2e do CI (`test:e2e:browser`, `test:e2e:journey`, com MP falso).
- Evidência (no box): `/workspace/ls-final-evidence/*.png`, `report.json`, `sitemap-status.txt`.

## 6. NestJS — vulnerabilidades moderadas (adiado, documentado)
`npm audit --omit=dev` (apps/api): 3 moderadas, todas da mesma origem:
- `@nestjs/core` ≤ 11.1.17 — GHSA-36xv-jgw5-4q75: injeção de quebra de linha no `SseStream` (Server-Sent Events).
- `@nestjs/platform-express` e `@nestjs/swagger` só aparecem por dependerem de `@nestjs/core`.
- **Exposição real: nenhuma.** A API não usa SSE (`@Sse`, `text/event-stream` e `MessageEvent` não aparecem em `apps/api/src`).
- **Correção:** só a partir do NestJS 11.1.18 (o `npm audit fix` propõe a 12.x). As duas são versões major, com mudanças de quebra (Express 5, rotas curinga, swagger 11+). Isso não é "não-quebrante", então ficou **adiado** para uma janela própria com a suíte completa e o e2e.

## 7. Tolerância de timestamp do webhook (aceito, sem mudança)
- `verifyWebhook` (Mercado Pago) confere o HMAC de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com o segredo. **O valor de `ts` entra na assinatura, mas a idade dele não é conferida** (não existe janela de tolerância).
- Por que é aceitável: (1) sem o segredo não dá para forjar; (2) o reenvio de um evento legítimo é idempotente (`PaymentEvent` por `x-request-id`); (3) o estado do pagamento é sempre **reconsultado no Mercado Pago** (`fetchPayment`), nunca lido do corpo. Um replay só repete uma verdade que já existe.
- Se um dia for preciso: recusar `|agora − ts| > 10 min`. Antes, conferir se as retentativas do MP reutilizam o mesmo `ts` (NÃO COMPROVADO), senão retentativas legítimas tardias seriam recusadas.

## Checkout logado até o pagamento (STAGING)
Conta de teste **só no staging** (`qa-omega-…@example.com`, endereço de teste em POA), desktop + celular com UA de WebView Android:
- O login pela tela `/entrar` funciona. O POST `/cart/items` com sessão por cookie volta 201, sem 403 CSRF, então o navegador continua passando depois do 7b.
- `/checkout` chega à etapa 03 PAGAMENTO, com o botão **"Confirmar pedido e pagar"**. **Não cliquei** e nenhum pedido foi criado.
- Achado de configuração do staging, não alterado: `POST /shipping/quote → 422` ("Configure a cotação (MELHOR_ENVIO_TOKEN)"). O staging não tem token do Melhor Envio.
- Evidência: `/workspace/ls-final-evidence/staging/`.

## Achados 7a/7b/7c e estorno — produção e staging depois do deploy
| Item | PR / merge | Deploy API (staging + produção) | Prova no ar |
|---|---|---|---|
| 7a cookie Domain | #216 `1264008` | `fb554ff5` / `442224cf` SUCCESS | Logout direto na API de staging: antes `Domain=.lojasschimitz.com.br`, agora sem Domain. Loja (`lojasschimitz.com.br`): Set-Cookie igual ao de antes. Login direto na API de staging: cookies host-only |
| 7b sem Origin | #216 | idem | Cookie sem Origin: antes chegava ao handler (400 de validação), agora **403 CSRF_ORIGIN**. Com Origin da loja: passa. Webhook MP e `/push/tokens` sem Origin: não bloqueados |
| Estorno: motivo | #216 | idem | Coberto por testes (0 chamadas ao MP sem motivo). Não testei em produção porque exige admin e pagamento real |
| 7c logout | #217 `c4bc594` | `fcfe65ec` / `9136c9c8` SUCCESS; migração `20261016_revoked_access_token` aplicada | Staging: access com `jti`. `GET /me` → 200; logout; mesmo access → **401 "Sessão encerrada"** |
- Health `/api/v1/health` 200 em staging e produção depois de cada deploy. A regressão em produção depois dos deploys deu o mesmo resultado de antes (0 erros JS; só o 401 do refresh de visitante).
- Logs de produção depois do deploy: nenhum `HTTP_5XX`, `ACCESS_REVOKE_FAILED` ou `CSRF_ORIGIN_BLOCKED` além dos meus testes com curl.
- **NÃO COMPROVADO:** o app Android real (aparelho) depois do 7b. Comprovado só por código (o WebView usa `fetch`, que manda Origin; o POST nativo de push está isento) e por Chrome com UA de WebView.

## 8. Varredura rápida
- Testes fora dos scripts: só `apps/api/src/modules/payments/payment.live-pix.db.spec.ts`, que fica **de fora de propósito** porque cria um PIX REAL de R$ 2 no Mercado Pago. Todos os outros `*.spec.ts` da API e da web estão em algum script de teste.
- Sitemap de produção: 119/119 URLs com 200. Página de produto, busca, carrinho e login sem erro de JS.
- Console: o único erro recorrente é o `401` do `/auth/refresh` para visitante sem login (explicado no item 1).
