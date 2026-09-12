# MEGA Phase 14 — logistics architecture (CarrierProvider)

**Data:** 2026-09-12 ~20:10 America/Sao_Paulo (UTC-3)  
**Base git:** `ff99599` (Phase 13 checkpoint SHA docs).  
**Commit SHA:** _(preenchido após commit)_  
**Escopo:** separar conceitos FREIGHT / TRACKING / CARRIER / ORDER / DELIVERY; interface `CarrierProvider` (`quote` / `createLabel` / `track`); default ativo `PropriaCarrierProvider` (manual); stub `MelhorEnvioCarrierProvider` que **nunca** finge sucesso. Sem sync fake, sem cobranças, sem secrets no git, sem DB destrutivo.

## FASE / STATUS

| Campo | Valor |
|-------|--------|
| **FASE** | MEGA Phase 14 — logistics architecture |
| **STATUS** | DONE (unitários PASS; tsc API a confirmar no commit) |
| **COMMIT** | _(SHA após push)_ |
| **PRODUÇÃO** | Nenhuma mutation em produção / Railway; nenhuma chamada HTTP a transportadora |
| **RISCOS** | Baixo — adapter manual + stub; admin path existente preservado |
| **BLOQUEIOS** | **BLOQUEIO EXTERNO** — credenciais Melhor Envio (OWNER) |

## Conceitos (não colapsar)

| Conceito | Significado | Onde hoje |
|----------|-------------|-----------|
| **FREIGHT** | Preço / prazo de frete no checkout | `ShippingProvider` / `ShippingService` + `ShippingCepRule`; `Order.freight` / `freightSnap` |
| **CARRIER** | Quem transporta / emite etiqueta | `Order.carrier`; `CarrierProvider` (`CARRIER_PROVIDER=propria\|melhor_envio`) |
| **TRACKING** | Código visível ao cliente | `Order.trackingCode` (manual no admin) |
| **ORDER** | Pedido + máquina de status | `Order` + `OrderStatus` (Phase 12) |
| **DELIVERY** | Desfecho de entrega | transição `in_transit` → `delivered` (sem entidade Delivery ainda) |

Auditoria pré-mudança (campos já existentes — **sem migration**):

- `Order.freight`, `Order.freightSnap`, `Order.carrier`, `Order.trackingCode`
- Admin `PATCH /admin/orders/:id/status` já aceitava `{ trackingCode?, carrier? }`
- UI admin prompt de rastreio ao avançar para `in_transit`
- Phase 7: rastreio manual; bloqueio de API de transportadora documentado

## Feito

| Item | Onde | Nota |
|------|------|------|
| `CarrierProvider` interface | `shipping/carriers/carrier.types.ts` | `quote` / `createLabel` / `track` + erros tipados |
| `PropriaCarrierProvider` | `propria.carrier.ts` | Default; etiqueta/rastreio **manual**; track = `unknown` (sem sync fake) |
| `MelhorEnvioCarrierProvider` | `melhor-envio.carrier.ts` | Sem token → `NOT_CONFIGURED`; com token → `CARRIER_LIVE_NOT_WIRED` (sem HTTP) |
| Factory | `carrier.factory.ts` | `CARRIER_PROVIDER` env; default `propria` |
| DI | `ShippingModule` → `'CarrierProvider'` | Global export |
| Wire fulfillment | `OrdersService.adminUpdateFulfillmentStatus` | Em `in_transit`/`shipped` chama `createLabel` antes do UPDATE |
| Tests | `carrier.provider.spec.ts` | seleção + NOT_CONFIGURED + live-not-wired |
| Docs | este arquivo + `docs/API.md` + `.env.example` | |

## Como plugar credenciais depois (OWNER)

1. Criar conta Melhor Envio (ou outro provedor) **fora do git**.
2. No Railway (serviço API), definir **somente** no painel:
   - `MELHOR_ENVIO_TOKEN` (ou `MELHOR_ENVIO_ACCESS_TOKEN`)
   - futuramente client id/secret se o fluxo OAuth exigir
3. **Não** setar `CARRIER_PROVIDER=melhor_envio` até existir implementação HTTP real (hoje o stub lança `CARRIER_LIVE_NOT_WIRED` mesmo com token — proposital).
4. Fase futura: implementar HTTP real em `MelhorEnvioCarrierProvider` (cotação opcional, etiqueta, webhook/polling) mapeando eventos → `in_transit` / `delivered` **sem** inventar status nem tracking fake.
5. Manter `CARRIER_PROVIDER=propria` em produção até o adapter live passar smoke controlado.

## BLOQUEIO EXTERNO — credenciais de transportadora (OWNER)

Esta fase **não** integra Melhor Envio / Correios / Jadlog ao vivo. Sem contrato/token e sem implementação HTTP:

1. **Conta + token** do provedor devem ser criados pelo dono no dashboard do provedor.
2. Secrets **somente** no Railway / `.env` local — **nunca** em issues, docs commitados ou screenshots.
3. Enquanto `CARRIER_PROVIDER=propria` (padrão): admin informa `trackingCode` manual ao marcar **Em trânsito**; `carrier` default `propria`.
4. Cotação de checkout continua nas **regras CEP** (`/shipping/quote`) — independente do adapter de etiqueta.
5. **Não** há sincronização automática de rastreio; isso **não** é bug da Phase 14.

**BLOQUEIO EXTERNO:** sem credenciais + adapter live wired, não há etiqueta API nem tracking sync. Continuar com entrega própria manual.

## Explicitamente NÃO feito

- Chamadas HTTP Melhor Envio / Correios  
- Fake tracking sync / eventos inventados  
- Cobranças / compra de frete no provedor  
- Migration destrutiva / novos campos obrigatórios  
- Secrets no git  
- Auto-transition de status via webhook de transportadora  

## TESTES

- `apps/api/src/modules/shipping/carriers/carrier.provider.spec.ts` — seleção, propria manual, NOT_CONFIGURED, CARRIER_LIVE_NOT_WIRED
- `tsc -p apps/api --noEmit` — a confirmar no commit

## Arquivos

- `apps/api/src/modules/shipping/carriers/*`
- `apps/api/src/modules/shipping/shipping.module.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/package.json` (script `test`)
- `.env.example`
- `docs/API.md`
- `docs/MEGA-PHASE-14-CHECKPOINT.md`
