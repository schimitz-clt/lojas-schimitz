# MEGA Phase 3 (safe / additive) — checkpoint

**Data:** 2026-09-12 (America/Sao_Paulo)  
**Escopo:** enriquecer `GET /admin/ops` + badges de exceção no admin. Sem cobrança MP, sem migration destrutiva, sem Play publish, sem secrets.

## Feito

| Item | Onde | Nota |
|------|------|------|
| Ops counts | `GET /admin/ops` (admin JWT) | lowStock, outOfStock, placeholderProductCount, pendingPaymentCount |
| Helpers | `apps/api/src/modules/admin/admin-ops.ts` | `summarizeOps` + placeholder host detect |
| Admin UI | `apps/web/src/app/admin/page.tsx` | seção preta+amarela “Exceções (ops)” |
| Webhook | read-only | `POST /webhooks/mercadopago` sem assinatura → 401 |
| Dual-mode refresh | intacto | |
| Paleta | preto + `#FFD100` | sem Magalu blue |

## Curl — webhook gated

```
POST https://lojasschimitz.com.br/api/v1/webhooks/mercadopago
→ HTTP 401  code=WEBHOOK_SIGNATURE_INVALID  "Assinatura ausente"
```

## Curl — imageUrl rewrite (já live pós Phase 1–2)

```
GET https://lojasschimitz.com.br/api/v1/products
→ imageUrl apex para uploads Railway (ex. …/uploads/518992fa-….png)
```

## Fora deste slice

- Cobrança real Mercado Pago / Play production
- www Cloudflare/Railway ainda 404 (ver Phase 1–2)
