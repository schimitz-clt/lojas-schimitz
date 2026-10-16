# Catálogo — auditoria dos 100 produtos (16/10/2026)

**Fonte:** API pública de produção (`/products` e `/products/:slug`), lida em 16/10 às ~11:45 UTC com `auditar_catalogo_api.py`. Sem acesso direto ao banco de produção.
**Arquivo completo:** `catalogo-auditoria.csv` (1 linha por produto, com os campos que faltam).

## Classificação
- **A**: pronto para anunciar (foto, descrição real, especificações, peso e medidas, fornecedor e custo).
- **B**: tem foto e peso/medidas; falta só texto, especificações, fornecedor ou custo.
- **C**: falta foto **ou** peso/medidas.
- **D**: falta foto **e** peso/medidas.

## Resultado: **A 0 · B 0 · C 0 · D 100**
Não há nenhum produto apto para um grupo inicial. Isso não é escolha minha: os dados não existem no sistema.

| Campo | Produtos sem o campo |
|---|---|
| Fotos | 100 |
| Descrição real (hoje todas são o texto padrão "X na categoria Y. Preço, frete e pagamento são confirmados no checkout.") | 100 |
| Especificações (`features`) | 100 |
| Peso e medidas (`weightKg`, `widthCm`, `heightCm`, `lengthCm`) | 100 |
| Fornecedor | 100 (**o sistema não tem campo para isso**) |
| Custo | 100 (**o sistema não tem campo para isso**) |

Já existem: nome, SKU, categoria (10 categorias × 10 produtos), preço, preço "de" e estoque cadastrado (994 unidades somadas). Nenhum é demo.

## O que foi corrigido com dados do próprio sistema
- **Texto de estoque (PR #220):** a página do produto dizia "Em estoque · N unidades". Como não há confirmação de estoque físico (venda sob encomenda), agora diz "Disponível para compra", e o comparador mostra "Disponível (N)". Preços, regras de reserva e o alerta de poucas unidades ficaram iguais. Está no ar e foi comprovado no navegador (`../evidencias-final/resultado.txt`).
- Nada mais pôde ser corrigido sem inventar dados (fotos, specs, medidas, fornecedor, custo).

## Para quando o Hector mandar os dados
1. `modelo-importacao-catalogo.csv` tem as colunas do importador do admin, já com os 100 SKUs e nomes. Célula vazia **não altera** o produto (regra do importador, `docs/IMPORTACAO_PRODUTOS.md`).
2. `dados-fora-do-sistema.csv`: fornecedor, custo, prazo do fornecedor, especificações e itens da caixa. São para controle, porque o importador não grava esses campos.
3. Antes de importar: `python3 validar_catalogo.py modelo-importacao-catalogo.csv dados-fora-do-sistema.csv`. Ele mostra os erros por linha e a classe A/B/C/D de cada produto, e não grava nada.
4. Depois: Admin → Catálogo → Importação / Lote → **Conferir planilha** → **Gravar**.
