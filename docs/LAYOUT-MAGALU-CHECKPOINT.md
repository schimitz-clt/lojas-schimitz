# Checkpoint — Layout marketplace (Magalu-like blue) · Lojas Schimitz

**Data:** 2026-09-08 (America/Sao_Paulo)  
**Escopo:** FRONTEND-ONLY (`apps/web` + este doc)  
**Backup tag:** `pre-magalu-layout-20260908` → aponta para o commit anterior ao redesign

## Objetivo

Redesenhar a vitrine para UX de grande marketplace (header com busca/CEP/conta/favoritos/sacola, menu de departamentos, home com hero/ofertas/categorias/mais vendidos/recomendações, cards modernos, PDP com ATC sticky, carrinho/checkout/conta polidos), usando **paleta azul estilo Magalu** (`#0086FF` / `#0066CC`), superfícies brancas e fundo cinza claro — **sem** logos, wordmarks, imagens ou copy proprietários da Magalu. Marca permanece **LOJAS SCHIMITZ**.

## O que mudou

| Área | Mudança |
|------|---------|
| `apps/web/src/app/globals.css` | Tema claro marketplace; primary azul; PIX/sucesso verde; CTAs azuis; header sticky azul; cards claros; sticky ATC/checkout mobile claros |
| `apps/web/src/components/Header.tsx` | Logo Schimitz, busca central com botão, CEP (localStorage `sch_cep`), conta, favoritos, sacola com badge, menu departamentos, tabbar mobile |
| `apps/web/src/app/page.tsx` | Home: banners/hero, trust, strip de departamentos, Ofertas do dia, Mais vendidos, Recomendados (mesma API `/products`) |
| Conta / Pedidos / Marketplace / Pedido detail | Polimento visual (nav chips, empty state pedidos, bordas/links em azul) |
| Integração API | **Preservada** — `apps/web/src/lib/api.ts` e fluxos reais intactos |

## O que foi preservado

- Integração real com API (`api.ts`, guest token, cart, checkout, PIX display 5%, installments)
- Sticky ATC no PDP mobile e sticky checkout no carrinho
- Chat widget, WhatsApp, SCHIMITZ+, admin/vendedor (sem mudança de backend)
- Sem logos Magalu / assets inventados
- Sem alterações em `apps/api`, Prisma, auth, pagamentos, Fase D

## Smoke URLs (retestar após deploy)

- https://lojasschimitz.com.br/
- https://lojasschimitz.com.br/produtos
- https://lojasschimitz.com.br/departamento/ofertas
- https://lojasschimitz.com.br/carrinho
- https://lojasschimitz.com.br/checkout (logado)
- https://lojasschimitz.com.br/conta (logado)
- https://lojasschimitz.com.br/pedidos (logado)
- PDP de qualquer produto: https://lojasschimitz.com.br/produto/{slug}

Checklist rápido: header azul + busca + CEP; cards com preço/PIX/parcelas; PDP sticky ATC no mobile; sacola/checkout legíveis; identidade Schimitz (sem Magalu brand).

## Rollback

```bash
git checkout pre-magalu-layout-20260908 -- apps/web docs/LAYOUT-MAGALU-CHECKPOINT.md
# ou reset do commit deste layout, se necessário
```
