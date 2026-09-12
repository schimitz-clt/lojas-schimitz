# MEGA Phase 7 (safe / additive) — logistics / admin operational queue

**Data:** 2026-09-12 ~19:30 America/Sao_Paulo (UTC-3)  
**Escopo:** filas operacionais do admin por `OrderStatus`, contagens em `GET /admin/ops`, hint pós-pagamento → organizing. Sem API de transportadora, sem cobrança MP, sem migration destrutiva, sem Play publish, sem secrets, sem tracking fake.

## Feito

| Item | Onde | Nota |
|------|------|------|
| Buckets da fila | `apps/api/src/common/order-status.ts` + web `lib/order-status.ts` | `awaiting_payment`, `paid`, `organizing`, `packing`, `ready_for_pickup`, `in_transit`, `delivered`, `problems` |
| `problems` | virtual | `cancelled` + `refunded` + legado stuck (`separating`, `shipped`) — reusa enum; não inventa status |
| Hint pós-pagamento | `POST_PAYMENT_OPS_HINT` + UI admin | Pagamento CAS → **`paid` apenas**; próximo passo = botão admin **Marcar: Organizando** (`nextFulfillmentStatus('paid')`) — fluxo atual intacto |
| `GET /admin/ops` | `admin.controller` + `summarizeOrderStatusCounts` | `orders.byStatus`, `orders.buckets`, `orders.total` via `groupBy` barato |
| `GET /admin/orders?status=problems` | DTO + controller | Expande para `{ status: { in: [...] } }` |
| Admin UI | `apps/web/src/app/admin/page.tsx` | Tabs = buckets; badges ops; contagens do snapshot |
| Tests | `order-status.spec.ts`, `admin-ops.spec.ts` | buckets, problems, summarizeOps.orders |

## Fluxo operacional (não quebrado)

1. Cliente paga → webhook/approve CAS `awaiting_payment` → **`paid`** (já existia; **não** auto-avança para `organizing`).
2. Admin na fila **Pago** clica **Marcar: Organizando** → `paid` → `organizing`.
3. Segue: organizing → packing → ready_for_pickup → in_transit (rastreio **manual** opcional, `carrier` default `propria`) → delivered.
4. Cancelado / reembolsado / legado separating|shipped → bucket **Problemas**.

## BLOQUEIO — integração de transportadora (OWNER)

Esta fase **não** integra Correios / Melhor Envio / Jadlog / etc. Rastreio continua **manual** (`trackingCode` + `carrier` no PATCH de status).

O dono ainda precisa, quando quiser tracking real:

1. Escolher provedor (ex.: Melhor Envio) e criar conta / token **fora do git**.
2. Definir se cotação de frete deixa de ser só regras CEP (`/shipping/quote`) e passa a chamar API do provedor.
3. Implementar (fase futura) criação de etiqueta + webhook/polling de eventos → mapear para `in_transit` / `delivered` **sem** inventar status.
4. Guardar secrets só no Railway (nunca commit). Até lá: admin informa código manual ao marcar Em trânsito; WhatsApp `wa.me` avisa o cliente.

**BLOQUEIO:** sem contrato/token de transportadora e sem fase dedicada, não há sincronização automática de rastreio. Não é bug da Phase 7.

## Fora deste slice

- APIs de carrier / etiqueta / pickup automático
- Auto-transition `paid` → `organizing` (intencionalmente **não**; ops humano)
- Cobrança Mercado Pago / Play production
- Migration destrutiva / fake tracking carriers

## Arquivos

- `apps/api/src/common/order-status.ts` (+ spec)
- `apps/api/src/modules/admin/admin-ops.ts` (+ spec)
- `apps/api/src/modules/admin/admin.controller.ts`
- `apps/api/src/modules/admin/dto.ts`
- `apps/web/src/lib/order-status.ts`
- `apps/web/src/app/admin/page.tsx`
- `docs/API.md`
- `docs/MEGA-PHASE-7-CHECKPOINT.md`
