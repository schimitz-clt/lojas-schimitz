# Admin Command Center — SUPER MEGA ULTRA BETA Phase 1

Data: 2026-09-16 (America/Sao_Paulo)

## Objetivo desta fase

Elevar **ATENÇÃO AGORA** com evidências reais de reconciliação de pagamentos, sem reescrever o admin monolítico e sem mocks/KPIs inventados. Ações críticas continuam **human-in-the-loop**.

## O que entrou (✅)

| Item | Status | Evidência |
|---|---|---|
| `GET /admin/ops` + `reconciliations.{openCount,recent[]}` (cap 10) | ✅ | `admin.controller.ts` + `summarizeReconciliations` |
| Alerta `open_reconciliations` severity `high` + evidence + recommendedAction | ✅ | `deriveOpsAlerts` + `admin-ops.spec.ts` |
| FE sticky **ATENÇÃO AGORA** (critical/high/warn) com deep-link | ✅ | `apps/web/src/app/admin/page.tsx` |
| Seção compacta **Reconciliações** (`/admin/payments/reconciliations`) | ✅ | mesma page, id `#admin-reconciliations` |
| Order 360: publicId + payment status/ext no Detalhe | ✅ | usa `payments` já retornados por `GET /admin/orders` |
| Jump leve por publicId/id/cliente (lista carregada) | ✅ | filtro client-side — sem endpoint público novo |
| Testes unitários admin-ops (recon) | ✅ | `tsx src/modules/admin/admin-ops.spec.ts` |

## O que NÃO entrou / permanece wishlist

| Item | Status |
|---|---|
| CRM profundo (segmentação, campanhas, LTV BI) | ⚪ |
| BI export / data warehouse | ⚪ |
| Approval inbox multi-role RBAC (além de admin Jwt) | ⚪ |
| Auto-refund / auto-cancel / auto-stock-fix | ⚪ (proibido por regra) |
| Resolver reconciliação com 1 clique (mutação) | ⚪ (só listagem/revisão) |
| Busca global server-side insecure | ⚪ (de propósito) |
| Reescrita do `page.tsx` 3.5k linhas | ⚪ (auditoria + evolução aditiva) |

## Notas de deploy

- Commit preferido: `feat(admin): command center BETA — atenção, reconciliação e evidências`
- Railway auto-deploy se configurado; sem ops destrutivas.
- Produção: validar login admin → sticky ATENÇÃO → KPI Reconciliações → Detalhe de pedido com payments. Contagens zeradas são válidas (sem inventar).
