# 05 — Importador de catálogo de fornecedor + disponibilidade

O importador CSV/XLSX com pré-visualização (dry-run) já existia (#173, Admin → Catálogo → Importação).
Este PR acrescenta o modelo de disponibilidade:

- `Product.availability` = `in_stock` (padrão, todos os produtos atuais) | `made_to_order`; `Product.availabilityLeadDays` (1–120).
- Migração aditiva `20261021_product_availability` com DEFAULT `in_stock` → nenhum produto muda.
- Planilha: colunas novas `disponibilidade` (em_estoque | sob_encomenda) e `prazo_dias`. Vazio = não muda.
  Sob encomenda sem prazo, prazo fora de 1–120 ou prazo sem disponibilidade = erro na pré-visualização.
- Pré-visualização mostra a coluna Disponibilidade e um aviso quando é sob encomenda.
- Página do produto: "Sob encomenda: envio em até N dias úteis a mais" só quando marcado.
- **Regra de compra intacta:** estoque/ativo continuam decidindo se dá para comprar (decisão do Hector).
- Modelos: `apps/web/public/modelos/modelo-importacao-produtos.{csv,xlsx}` regenerados (exemplo com sob_encomenda/7).
- Rollback: reverter o merge. As colunas novas podem ficar (têm padrão e ninguém depende delas).
