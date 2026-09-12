# Chat IA

Assistente no site PT-BR: FAQ, catálogo real e WhatsApp humano.
Não usa Cloud API da Meta.

## Comportamento (obrigatório sem OpenAI)

- Widget no layout da loja
- `POST /api/v1/chat` com `message` e `conversationId` opcional
- Resposta: `reply`, `conversationId`, `handoff`, `whatsappUrl`, `products`, `llm`
- **Nunca inventa produto** — só catálogo ativo
- Humano / reclamação / disputa / whatsapp / zap / wa → `wa.me` 5551996253766 (handoff mesmo sem LLM)
- **Sem chave LLM**: FAQ + catálogo + WhatsApp (`llm: false`) — o chat **nunca depende** de OpenAI
- Rate limit: 20 req/min no endpoint (`@Throttle`)
- Memória em processo ~30 min (sem migration Prisma)
- Sanitização básica anti prompt-injection + max 1200 chars (`sanitizeChatMessage`)

## LLM opcional

Env API (todos opcionais):

- `OPENAI_API_KEY` ou `CHAT_API_KEY`
- `CHAT_API_BASE` (default `https://api.openai.com/v1`)
- `CHAT_MODEL` (default `gpt-4o-mini`)
- `WHATSAPP_PHONE`

Se a chave estiver ausente, billing falhar ou o provider timeoutar, o serviço faz fallback silencioso para FAQ/catálogo. Produção pode rodar sem OpenAI indefinidamente.

Env web: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WHATSAPP`

## Testes

- Unitário: `npx tsx src/modules/chat/chat.spec.ts`
- Manual: `start:dev` na API + `next dev` na web → botão Chat
