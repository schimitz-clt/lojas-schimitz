# Frete (Melhor Envio): 16/10/2026

## Cotação em produção (gratuita, nenhuma etiqueta comprada)
Evidência: `evidencias-final/frete-cotacao-prod.txt`
| CEP | Resultado |
|---|---|
| 90010-000 (POA) | Frete grátis (SEDEX subsidiado, R$ 12,43 pago pela loja), 2 dias |
| 01310-100 (SP) | Jadlog R$ 20,01, 4 dias |
| 88010-000 (Florianópolis) | Jadlog R$ 24,27, 6 dias |
| 69005-010 (Manaus) | PAC R$ 44,16, 20 dias |
| 69900-062 (Rio Branco) | Jadlog R$ 43,61, 16 dias |
| 69900-000 e 00000-000 | `SHIPPING_CEP_INVALID` (mensagem clara) |
| `abc` / sem CEP | `VALIDATION_ERROR` 400 |

**Risco:** todas as cotações voltam com `assumedPackage: true`. Os 100 produtos não têm peso nem medidas, então o valor do frete é calculado com uma **caixa padrão** e pode ficar diferente do custo real da etiqueta.

## Dados do remetente que faltam (todos)
O código atual não emite etiqueta, só cota. Para emitir, faltam **todos** estes dados, e nenhum está no sistema:
nome, CPF ou CNPJ, inscrição estadual (se CNPJ), telefone, e-mail, rua, número, complemento, bairro, cidade e UF do remetente. Faltam também os escopos do token (`cart-write`, `shipping-checkout`, `shipping-generate`, `shipping-print` e `shipping-tracking`) e a decisão sobre nota fiscal ou declaração de conteúdo. Lista de variáveis: `MAPA_ESTADO.md` §8.

## Alertas (PR #221, no ar)
`GET /api/v1/admin/ops` agora traz `fulfillmentAttention`:
- **Separação parada** (aproxima "fornecedor não confirmado", porque o sistema não tem campo de fornecedor): pedidos em organizing, separating ou packing parados há `FULFILLMENT_STUCK_DAYS` dias ou mais (padrão 3).
- **Enviado sem rastreio:** pedido in_transit ou shipped sem `trackingCode`.
- Quando um dos números passa de 0, aparece a linha de log `ops fulfillment_attention`. O alerta que já existia de "pago e parado" (`paidAwaitingOrg`) continua.
- **NÃO COMPROVADO em produção com pedido real:** não existe pedido nesses estados. Está coberto pelo teste `fulfillment-attention.spec.ts` (CI verde). A tela do admin ainda não mostra o bloco, só a API.
