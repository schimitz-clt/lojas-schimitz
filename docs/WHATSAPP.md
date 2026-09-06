# WhatsApp — avisos de pedido (Step 4)

## O que existe hoje

**Clique-para-conversar** via `https://wa.me/<número>?text=...`.

Não há envio automático. Não há token da WhatsApp Cloud API (Meta),
Twilio ou Business API. Nenhum segredo extra é necessário.

O e-mail transacional (SMTP) cobre o cliente em **pago** e **enviado**, e a
**loja** em **Nova venda paga** (admins ativos), quando `SMTP_HOST` + `MAIL_FROM`
estão configurados. O e-mail da loja inclui um link `wa.me` com rascunho pronto —
ainda é click-to-chat, **não** envio automático. Ver `docs/DEPLOY.md`.

## Número da loja

Variável no serviço **web** (Railway / `.env.local`):

```
NEXT_PUBLIC_WHATSAPP=5551996253766
```

Opcional na API (mesmo valor): `WHATSAPP_PHONE`.

Só dígitos, com DDI `55`. Padrão: `5551996253766`.

## Como o lojista usa

1. Entre em `/admin` com a conta admin.
2. Na lista de **Pedidos**, cada cartão tem **Avisar no WhatsApp**.
   - Se o cliente tem telefone em `User.phone` (cadastro / Minha conta)
     ou no snapshot do pedido (`addressSnap.phone`), o link abre o WhatsApp
     do cliente com mensagem pronta (pedido, total, status).
   - Se não tem telefone, abre o WhatsApp da loja (`NEXT_PUBLIC_WHATSAPP`)
     com um rascunho interno — auto-aviso do lojista.
3. Pedido **Pago** (ou Separando): faixa **Cliente pagou — abrir WhatsApp**.
4. Pedido **Saiu para entrega**: botão **Pedido saiu — abrir WhatsApp**.
5. **Detalhe** mostra nome, e-mail e WhatsApp do cliente.

O WhatsApp do celular/desktop abre com o texto já preenchido. O lojista
só aperta enviar.

## Telefone do cliente

- Campo `User.phone` (Prisma) — cadastro opcional e edição em `/conta`.
- `Address` hoje **não** tem coluna de telefone; o pedido grava
  `addressSnap.phone` a partir do `User.phone` no checkout.
- Sem telefone, o botão não falha: cai no número da loja.

## Envio automático (futuro)

Para disparar sozinho (pago/enviado sem clique):

1. Conta WhatsApp Business + app no Meta for Developers
2. WhatsApp Cloud API (Graph) + número verificado
3. Templates aprovados pela Meta (mensagens de utilidade)
4. Webhook de status (entregue/lido)

**Não** commitar tokens. Quando isso existir, um serviço `WhatsAppCloudProvider`
pode reutilizar os templates em `apps/api/src/common/whatsapp.ts`.
Twilio é alternativa, também com credenciais só em env — hoje **não** usar.
