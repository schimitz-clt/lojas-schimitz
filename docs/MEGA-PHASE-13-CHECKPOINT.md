# MEGA Phase 13 — admin operational command center

**Data:** 2026-09-12 ~20:10 America/Sao_Paulo (UTC-3)  
**Base git:** `c65b466` (Phase 12 checkpoint SHA docs).  
**Commit SHA:** _(filled after push)_  
**Escopo:** fortalecer `/admin` como centro de comando com **dados reais** (DB/API): widgets de vendas, filas, estoque, pagamentos, placeholders, `mailConfigured`, alertas derivados e clique bucket → filtro de pedidos. Sem cobranças, sem DB destrutivo, sem secrets, sem métricas inventadas.

## FASE / STATUS

| Campo | Valor |
|-------|--------|
| **FASE** | MEGA Phase 13 — admin ops command center |
| **STATUS** | DONE (unitários PASS; tsc API PASS) |
| **COMMIT** | _(set after push)_ |
| **PRODUÇÃO** | Nenhuma mutation em produção / Railway |
| **RISCOS** | Baixo — só agregações read-only + UI |
| **BLOQUEIOS** | Nenhum para este slice |

## Feito

| Item | Onde | Nota |
|------|------|------|
| Sales widgets | `GET /admin/ops` → `sales.today` / `sales.last30d` | `order.aggregate` + `PAID_REVENUE_STATUSES` (mesma base do relatório) |
| Order buckets | já Phase 7 | UI reforçada: clique → `selectOpsBucket` + scroll `#admin-orders-queue` |
| Low stock / OOS / pending / placeholders / mail | ops snapshot | widgets no centro de comando (preto + `#FFD100`) |
| Alerts | `deriveOpsAlerts` | só condições reais (estoque, pending, paid, problems, placeholders, mail ausente) |
| Helpers + tests | `admin-ops.ts` / `.spec.ts` | `summarizeSalesWindow`, `deriveOpsAlerts`, `summarizeOps` + sales/alerts |
| Docs | este arquivo + `docs/API.md` | |

## Contrato `GET /admin/ops` (aditivo)

Além do snapshot Phase 3/7:

```json
{
  "sales": {
    "today": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "orderCount": 0, "revenue": 0 },
    "last30d": { "from": "…", "to": "…", "orderCount": 0, "revenue": 0 }
  },
  "alerts": [
    { "code": "low_stock", "severity": "warn", "message": "…", "count": 3 }
  ],
  "mail": { "configured": true }
}
```

- `sales.*` = agregação Prisma (`_count` + `_sum.total`) em pedidos com status de receita paga; janelas America/Sao_Paulo via `parseSalesDateRange` / `saoPauloYmd`.
- `alerts` = lista derivada; zero/ausência → sem alerta correspondente (sem números fake).
- `mail.configured` = presença de env (nunca valores secretos).

## UI admin

- Seção **Centro de comando (ops)** (antes “Exceções”): grid de widgets + lista de alertas + botões de bucket.
- Clique em bucket/alerta com `queueBucket` → `setOrderStatusFilter` + scroll suave até `#admin-orders-queue`.
- Paleta Schimitz: fundo preto / acento `#FFD100` — **sem** Magalu blue.

## TESTES

- `apps/api/src/modules/admin/admin-ops.spec.ts` — PASS (sales window, deriveOpsAlerts, summarizeOps.sales/alerts)
- `tsc -p apps/api --noEmit` — PASS

## Explicitamente NÃO feito

- Cobrança Mercado Pago / PIX live  
- Migração / mutation destrutiva  
- Métricas inventadas / placeholders numéricos  
- Integração de transportadora  
- Secrets no git  

## Arquivos

- `apps/api/src/modules/admin/admin-ops.ts`
- `apps/api/src/modules/admin/admin-ops.spec.ts`
- `apps/api/src/modules/admin/admin.controller.ts`
- `apps/web/src/app/admin/page.tsx`
- `docs/API.md`
- `docs/MEGA-PHASE-13-CHECKPOINT.md`
