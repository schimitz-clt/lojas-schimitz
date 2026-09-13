# Schimitz AI — Fase Alfa

Assistente de compras da Lojas Schimitz. Evolui o chat existente (`POST /api/v1/chat` + `ChatWidget`). **Não reescreve a loja.**

## Princípios

- Não inventa produto, preço, estoque, frete, pedido ou política.
- O LLM **nunca** recebe SQL arbitrário — só tools controladas no servidor.
- Sem senhas/tokens/secrets para o modelo.
- Cliente A não vê dados do cliente B. Visitante não acessa pedido privado.
- Servidor continua autoridade de preço/pagamento; a IA só apresenta.
- Sem chave LLM / sem crédito: FAQ + tools + WhatsApp continuam.
- Feature flag default **seguro**: `CHAT_AI_MODE=alfa` liga a arquitetura; LLM só se houver chave.

## Feature flags / env

| Variável | Default | Efeito |
|---|---|---|
| `SCHIMITZ_AI_ENABLED` | `true` | `false`/`off` → só FAQ (nível 0), sem tools extras |
| `CHAT_AI_MODE` | `alfa` | `off` = FAQ; `faq` = FAQ + busca; `alfa` = tools + LLM opcional |
| `OPENAI_API_KEY` ou `CHAT_API_KEY` | vazio | Sem chave = sem LLM (sem cobrança) |
| `CHAT_API_BASE` | `https://api.openai.com/v1` | Base OpenAI-compatible |
| `CHAT_MODEL` | `gpt-4o-mini` | Modelo |

Nunca commitar chaves. No Railway: só no serviço da API.

## Arquitetura

```
POST /api/v1/chat
  → sanitize + security (user = DATA)
  → planChatTurn (nível 0 / 1 / 2)
  → tools server-side (Prisma/catálogo/frete/pedidos)
  → LLM opcional (AiProvider) só no nível 2
  → fallback FAQ/catálogo se provider cair
```

- **Nível 0** — FAQ, handoff, recusa de injeção.
- **Nível 1** — intent → tool (`searchProducts`, `getProduct`, `compareProducts`, `checkAvailability`, `getStorePolicies`, `getShippingEstimate`).
- **Nível 2** — LLM só em pergunta geral/ambígua **e** com chave. Tool loop máx. 2 chamadas HTTP. Pedidos privados **não** entram no schema do modelo.

Provider: `AiProvider` / `OpenAiCompatibleProvider` (`apps/api/src/modules/chat/ai.provider.ts`).

## Endpoints

- `POST /api/v1/chat` — igual ao de antes + campos aditivos `level`, `tools`, `intent`. JWT opcional (`Authorization: Bearer`) só para tools de pedido do **próprio** `userId`.
- `GET /api/v1/chat/status` — `{ name, phase, mode, llmConfigured, tools, privateTools }` (sem segredos).

## Tools

| Tool | Alfa | Auth |
|---|---|---|
| `searchProducts` | sim | público |
| `getProduct` | sim | público |
| `compareProducts` | sim | público |
| `checkAvailability` | sim | público |
| `getStorePolicies` | sim | público (fatos de `chat.facts`) |
| `getShippingEstimate` | sim | público via serviço interno; sem CEP → `NEED_CEP`; cotação real se existir |
| `getOrderStatus` | interface pronta (Beta) | JWT `userId` **obrigatório**; outro cliente → `ORDER_NOT_FOUND` |
| `getCustomerOrders` | interface pronta (Beta) | JWT; só pedidos do `sub` |

## Alfa vs Beta

**Alfa (agora):** busca/filtro/comparação no catálogo real, políticas estáticas, cotação de frete se CEP, UI com cards, anti-injeção, observabilidade, fallback sem LLM.

**Beta (próximo):** histórico persistido, tool de pedido no loop do LLM (ainda gated), recomendações multi-turno, cotação com peso, métricas de custo por conversa.

## Como a IA acessa dados

- Catálogo: Prisma `product` **ativo** (mesmos filtros de `GET /products`).
- Políticas: `chat.facts` / `storePolicies()` — sem texto livre inventado.
- Frete: `ShippingService.quoteDetailed` (regras CEP da loja).
- Pedidos: `order.findFirst({ publicId, userId })` — nunca por `publicId` sozinho.

## Proteção

- User wrap `<user_data>`; recusa SQL / secrets / admin / mudança de preço.
- Tools com allowlist + sanitize de slug/uuid/CEP/query.
- Pedido: guest → `LOGIN_REQUIRED`; outro user → `ORDER_NOT_FOUND` (sem vazar existência).
- Logs: `intent`, `tools`, `llm`, `level`, `latencyMs` — sem PII, sem mensagem, sem chave.

## UI

Widget **Schimitz AI**: cards com foto, nome, preço, PIX (5% oficial), CTA PDP e adicionar ao carrinho via `POST /cart/items` (API existente). Mobile-first.

## Testes

```
cd apps/api && npx tsx src/modules/chat/chat.spec.ts
cd apps/api && npx tsx src/modules/chat/ai.security.spec.ts
cd apps/api && npx tsx src/modules/chat/ai.tools.spec.ts
```
