# Como preencher peso e medidas dos produtos (simples)

Arquivo: `pesos-medidas-modelo.csv`: 100 produtos ativos, com **SKU** e nome. As colunas de peso e medidas estão **vazias de propósito**: eu não invento valor.

1. Abra o arquivo no Excel ou no Google Planilhas (separador `;`).
2. Para cada produto, **pese e meça a caixa embalada**, e preencha:
   - `peso_kg`: em quilos (ex.: `0,35`). Pode usar vírgula ou ponto.
   - `largura_cm`, `altura_cm`, `comprimento_cm`: em centímetros (ex.: `16`).
3. Não mexa na coluna `sku` (é por ela que o sistema acha o produto). A coluna `nome_referencia` é só para você se localizar; é ignorada.
4. Pode deixar linhas em branco; elas não apagam nada. Salve como **CSV (separado por ponto e vírgula)** ou Excel `.xlsx`.
5. No admin: **Importação / Lote → Importar planilha → Conferir planilha**. Veja se não há erro e clique em **Gravar**. Só peso e medidas são gravados; nome, preço e estoque **não mudam**.
6. Para ver quantos faltam: **Importação / Lote → Conferir produtos sem peso/medidas**.

Hoje (leitura pública em 09/10/2026): **os 100 produtos ativos estão sem peso e sem medidas**. Sem esses dados o frete usa o pacote padrão (0,3 kg, 16×11×11 cm) e pode sair errado.

Teste feito: o importador do projeto aceita este arquivo (100 linhas, 0 erros, nenhum nome/preço/estoque alterado) e, preenchido, lê peso 1,25 / 30×20×10 corretamente.
