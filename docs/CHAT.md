# Chat IA Phase 1

Assistente no site PT-BR: FAQ, catalogo real e WhatsApp humano.
Nao usa Cloud API da Meta. Sem marketplace e sem app Android.
- Widget no layout da loja
- POST /api/v1/chat com message e conversationId opcional
- Resposta reply, conversationId, handoff, whatsappUrl, products, llm
- Nunca inventa produto
- Humano / reclamacao / disputa / whatsapp / zap / wa vai para wa.me 5551996253766 (handoff mesmo sem LLM)
- Sem chave LLM: FAQ + WhatsApp
- Rate limit 20 por minuto no endpoint
- Memoria 30 min, sem migration Prisma

Env API: OPENAI_API_KEY ou CHAT_API_KEY, CHAT_API_BASE, CHAT_MODEL, WHATSAPP_PHONE
Env web: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WHATSAPP

Teste: start:dev na API, next dev na web, botao Chat
Teste unitario: npx tsx src/modules/chat/chat.spec.ts
