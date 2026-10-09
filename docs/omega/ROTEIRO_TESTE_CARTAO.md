# Roteiro: teste real de cartão com 3DS + estorno (para o Hector)

**Objetivo:** provar que um cartão real, com desafio 3DS, paga e estorna na loja de verdade. Só depois disso o PR #177 (CSP sem `unsafe-eval`) pode ser mesclado.

**O que isto custa:** uma compra real de R$ 24,90 no seu cartão. Depois você estorna pelo admin. O Mercado Pago pode reter a tarifa da venda. Eu **não** faço este teste: ele cobra de verdade e precisa do seu cartão.

## Antes de começar (2 minutos)
- Use o **seu** cartão de crédito (de preferência de um banco que costuma pedir 3DS: Nubank, Itaú, Bradesco, Santander...). Tenha o celular do banco à mão.
- Use um navegador **comum** no computador (Chrome), com o site aberto em https://lojasschimitz.com.br. Não use aba anônima com bloqueador de pop-up.
- Me avise "vou começar". Eu fico olhando os logs da API (só leitura) durante o teste.
- Produto mais barato hoje: **Anel de apoio para celular** (SKU SCH-CEL-RING), **R$ 24,90**, 10 em estoque: https://lojasschimitz.com.br/produto/anel-de-apoio-para-celular
  - Se o frete deixar o total muito mais alto, escolha um CEP de Porto Alegre (frete grátis na capital, segundo o mapa de estado).

## Passo a passo
1. Entre na sua conta (ou crie uma com o seu e-mail e o seu CPF).
2. Abra o produto acima, clique em **Adicionar à sacola**, depois **Sacola → Finalizar compra**.
3. Escolha o endereço (o seu), confirme o frete e clique em **Confirmar pedido e pagar**.
4. Na página do pedido, escolha **cartão** (não PIX). O formulário do Mercado Pago aparece.
5. Digite o cartão e escolha **1x** (à vista). Clique em pagar.
6. **O que deve acontecer na tela:**
   - Pode abrir uma janela ou quadro do seu banco (3DS) pedindo senha, biometria ou código do app. **Esse é o ponto principal do teste.** Aprove.
   - Volta para a página do pedido. Primeiro pode aparecer "Processando pagamento no cartão…" e, em poucos segundos, **"Pagamento no cartão: Aprovado"**.
   - O status do pedido muda para **Pago**. Chega o e-mail de confirmação.
7. **Se algo estranho acontecer, não tente de novo.** Tire print da tela (e do console, se souber: F12 → Console) e me avise:
   - quadro do banco em branco ou que não abre;
   - mensagem do Chrome sobre "bloqueado" ou "Refused to ...";
   - página parada em "Processando" por mais de 2 minutos.

## Estornar pelo admin (fluxo corrigido no #184)
1. Entre em **Admin → Pedidos** e abra o pedido que você acabou de pagar.
2. No bloco de pagamento, clique em **Estornar pagamento**.
3. Escreva o motivo (é obrigatório), por exemplo: `teste real de cartão 3DS`.
4. Clique em **Confirmar estorno**. Pode demorar alguns segundos (o limite é 20 s).
5. **O que esperar:**
   - "estorno concluído": tudo certo.
   - "estorno em processamento" (código 202): o Mercado Pago ainda está processando. **Não clique de novo**; espere 1 minuto e recarregue. O sistema não duplica o estorno (a mesma chave de idempotência é usada).
   - Erro 422 (recusado pelo MP): me avise com o print.
6. Confira o pedido: deve ficar **Reembolsado** e o estoque do produto volta de 9 para 10.
7. No app do seu banco, o estorno aparece na fatura em alguns dias (depende do banco).

## O que eu confiro nos logs (leitura apenas, no Railway)
- API: `payment.intent` do pedido, a chamada de criação do pagamento (sem erro), o webhook assinado do MP chegando, o pedido indo para `paid` e **um só** `COMMIT` de estoque.
- Nenhum `HTTP_5XX`, `WEBHOOK_FETCH_FAILED` ou `payment.intent_failed` no período.
- No estorno: uma só chamada de estorno ao MP, webhook de `refunded`, pedido `refunded`, estoque devolvido.
- `csp_violation` na API: **zero** durante o 3DS (isso é o que o #177 mudaria, então o ideal é ver zero violações **antes** de mesclar, no relatório "Report-Only").
- `/health/payments` continua `ok`.
- Depois eu escrevo o resultado em `docs/omega/MAPA_ESTADO.md`.

## Checklist para você autorizar o merge do #177
Marque (ou me diga) cada item:
- [ ] A compra no cartão com 3DS foi **aprovada** e o pedido ficou **Pago**.
- [ ] O quadro/janela do banco (3DS) **abriu e funcionou** normalmente.
- [ ] O estorno pelo admin **concluiu** (ou ficou em processamento e depois concluiu).
- [ ] Estoque voltou para 10 e o pedido ficou Reembolsado.
- [ ] Eu confirmei nos logs: sem 5xx, sem `csp_violation` e sem webhook com falha.
- [ ] Você escreve para mim: **"Autorizo o merge do #177"**.

**Depois do merge do #177:** eu confiro o deploy do web (SUCCESS, home 200), repito uma abertura do formulário de cartão e acompanho `csp_violation` por alguns dias. **Rollback:** reverter o PR (um clique no GitHub) ou, em emergência, remover só o cabeçalho `Content-Security-Policy` (o Report-Only continua).

## O que este teste NÃO prova
- Cartões de outros bancos (cada emissor tem o seu 3DS).
- Parcelamento em 2x ou 3x. O site já não promete "sem juros": os juros de 2x/3x são os do Mercado Pago (ver `PARCELAS_MERCADO_PAGO.md`).
