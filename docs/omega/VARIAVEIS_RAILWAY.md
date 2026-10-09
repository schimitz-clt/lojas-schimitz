# Variáveis do Railway: o que existe, o que criar, o que muda

Projeto `lojas-schimitz`, ambiente **production**. **Nenhuma variável foi alterada por mim.** Esta lista tem só nomes e valores esperados, nenhum segredo.

Conferi **só os nomes** das variáveis (a API do Railway não mostra valores neste modo). Serviços:
- **API** (`lojas-schimitz`): 47 variáveis definidas.
- **Web** (`lojas-schimitz-web`): 6 variáveis (`API_PROXY_TARGET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP`, `NODE_ENV`).

Como criar: Railway → projeto → serviço → aba **Variables** → **New Variable** → salvar. Aparece "Deploy" para aplicar. Variáveis `NEXT_PUBLIC_*` entram **na hora do build** do web, então precisam de novo deploy (o Railway refaz sozinho ao aplicar).

| # | Variável | Serviço | Existe hoje? | Valor esperado / o que você fornece | Redeploy |
|---|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_STORE_LEGAL_NAME` | **web** | não | Nome do responsável/razão social que aparece na política (ex.: o seu nome ou da empresa). Só o que for verdade. | sim (build do web) |
| 2 | `NEXT_PUBLIC_STORE_CNPJ` | **web** | não | CNPJ com 14 dígitos (só se existir CNPJ). Não crie se não houver. | sim |
| 3 | `NEXT_PUBLIC_STORE_ADDRESS` | **web** | não | Endereço comercial que você quer publicar. | sim |
| 4 | `NEXT_PUBLIC_STORE_PRIVACY_EMAIL` | **web** | não | E-mail para pedidos de privacidade (hoje só aparece o WhatsApp). | sim |
| 5 | `STORE_NOTIFY_EMAIL` | **API** | **sim** (nome conferido) | E-mail que recebe "Novo pedido" e "Novo pedido de exclusão de conta". Confira se é o e-mail certo. | sim (API) |
| 6 | `REFRESH_JSON_TOKEN_ENABLED` | **API** | **sim** (nome conferido; o valor não consigo ler) | **`false`** (recomendado) ou apague a variável. Em produção, sem a variável, o padrão do código já é `false` (cookie-only). Se estiver `true`, o token de renovação vai no corpo da resposta (mais exposto). | sim (API) |
| 7 | `MP_HTTP_TIMEOUT_MS` | **API** | não (padrão do código: 20000) | Opcional. Deixe sem criar (20 s). Aceita 1000 a 60000. | sim se criar |
| 8 | `ME_LABEL_ENABLED` | **API** | não, e **o código ainda não lê** | Só faria sentido depois que a etiqueta via API for implementada. **Não crie agora.** | — |
| 9 | `MELHOR_ENVIO_SENDER_*` (NAME, DOCUMENT ou COMPANY_DOCUMENT, STATE_REGISTER, PHONE, EMAIL, ADDRESS, NUMBER, COMPLEMENT, DISTRICT, CITY, UF) | **API** | não, e o código ainda não lê | Dados reais do remetente (você fornece). **Não crie agora**; só quando decidirmos implementar a etiqueta. | — |
| 10 | Permissões do token do Melhor Envio | (no site do Melhor Envio) | — | Para a futura etiqueta: `cart-write`, `shipping-checkout`, `shipping-generate`, `shipping-print`, `shipping-tracking` (além das de cotação que já funcionam). Hoje a cotação funciona; a compra de etiqueta **debita a carteira**. | — |
| 11 | Retenção de logs | — | não é variável | Depende do **plano do Railway** (Hobby 7 dias, Pro 30). Confirme o plano em Settings → Plan. Nada a criar. | — |
| 12 | `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` | **API** | não | **Não resolve** a queda do API (ver `QUEDA_API_DEPLOY.md`: serviço com volume não roda duas versões ao mesmo tempo). | — |

Já existentes e que **não** devem ser mexidas sem motivo: `MERCADO_PAGO_*`, `MELHOR_ENVIO_*` (cotação), `JWT_*`, `DATABASE_URL`, `RESEND_API_KEY`, `FIREBASE_*`, `OPENAI_API_KEY`.

## Ordem sugerida
1. Item 6 (`REFRESH_JSON_TOKEN_ENABLED=false`): um redeploy rápido da API.
2. Itens 1 a 4, de uma vez só, no web (um único build).
3. Item 11: só conferir.
