# Cadastrar produtos em lote (planilha)

Guia para cadastrar muitos produtos de uma vez pelo painel da loja, sem precisar
criar um por um. Funciona com **Excel (.xlsx)** ou **CSV**.

> Resumo: baixe o modelo → preencha → (se tiver) envie as fotos → **Conferir planilha**
> → veja se está tudo certo → **Gravar**. Nada é gravado antes do último clique, e
> nenhum produto é apagado.

---

## 1. Onde fica

1. Entre no painel: `https://<sua-loja>/admin` com o usuário de administrador.
2. Abra **Catálogo**.
3. Desça até o quadro **Importação / Lote → Importar planilha de produtos**.

## 2. Baixe o modelo

Clique em **Baixar modelo (Excel)**. (Se usar outro programa, **Baixar modelo (CSV)**
também serve.) O mesmo arquivo está no projeto em
`apps/web/public/modelos/modelo-importacao-produtos.xlsx`.

O modelo tem duas abas:

- **Produtos** — onde você preenche. Já vem com 2 linhas de exemplo (SKU começando com
  `EXEMPLO`). **Apague as linhas de exemplo** antes de importar. Se esquecer, o sistema
  recusa essas duas linhas e avisa — não estraga nada.
- **Instruções** — explicação de cada coluna (a mesma desta página).

Não mude os nomes da primeira linha (cabeçalho). A ordem das colunas pode mudar e as
colunas que você não usar podem ser apagadas, menos `sku`.

## 3. Preencha (uma linha por produto)

| Coluna | Obrigatória? | O que colocar | Exemplo |
|---|---|---|---|
| `sku` | **Sim** | Código único do produto (2 a 64 caracteres). É por ele que o sistema sabe se o produto já existe. Use sempre o mesmo código para o mesmo produto. | `GEL-375-INOX` |
| `nome` | Sim para produto novo | Nome que aparece na loja (2 a 160 caracteres). | `Geladeira Frost Free 375 L Inox` |
| `descricao` | Não | Texto da página do produto (até 4000 caracteres). | `Geladeira duplex, 220 V…` |
| `categoria` | Recomendado | Categoria que **já existe** na loja (veja a lista abaixo). Pode usar o nome ou o código. | `eletrodomesticos` |
| `preco` | Sim para produto novo | Preço de venda. Aceita `1299,90`, `1.299,90`, `R$ 1.299,90` ou número do Excel. | `3499,90` |
| `preco_de` | Não | Preço “de” riscado (antes do desconto). Deve ser **maior** que o preço. Deixe vazio se não houver promoção. | `3999,90` |
| `estoque` | Recomendado | Quantidade disponível (número inteiro). Vazio em produto novo = 0 (não dá para comprar). | `4` |
| `ativo` | Não | `sim` (aparece na loja) ou `não` (fica escondido). Vazio em produto novo = `sim`. | `sim` |
| `peso_kg` | **Muito recomendado** | Peso **com a embalagem**, em kg. | `62,5` |
| `largura_cm` | **Muito recomendado** | Largura da caixa, em cm. | `70` |
| `altura_cm` | **Muito recomendado** | Altura da caixa, em cm. | `180` |
| `comprimento_cm` | **Muito recomendado** | Comprimento (profundidade) da caixa, em cm. | `72` |
| `fotos` | Não | Até 10 fotos, separadas por `|`. Pode ser **nome do arquivo** (enviado em “Enviar fotos”) ou **link** `https://`. A primeira é a capa. | `geladeira-frente.jpg|geladeira-aberta.jpg` |

**Por que peso e medidas são importantes:** o frete (Melhor Envio) é calculado com eles.
Sem esses dados o sistema usa 0,3 kg e caixa 16×11×11 cm — para uma geladeira o frete
sairia baratíssimo e a loja pagaria a diferença. A conferência mostra um aviso nesses casos.

### Categorias existentes

Use exatamente um destes (o código da esquerda ou o nome que aparece no admin):

`eletro` (TVs e Áudio) · `celulares` · `informatica` · `eletrodomesticos` · `casa` ·
`esporte` · `ofertas` · `eletronicos` · `utilidades` · `ferramentas` · `beleza` ·
`moda` (Moda e acessórios)

A planilha **não cria categorias novas**, e hoje o painel também não tem tela para criar
categoria. Se precisar de outra, peça para a equipe técnica antes de importar.

### Dicas

- Em produto **já cadastrado**, célula vazia **não apaga** nada — só muda o que estiver
  preenchido. Ex.: para atualizar só o estoque, basta `sku` + `estoque`.
- Não use fórmulas começando com `=` em nome ou descrição.
- Máximo de **500 produtos por planilha** e arquivo de até **5 MB**. Tem mais? Divida
  em várias planilhas.
- Arquivo `.xls` antigo não é aceito: no Excel use **Salvar como → Pasta de Trabalho do
  Excel (.xlsx)**.
- Só a **primeira aba** é lida (a aba “Instruções” pode ficar no fim).

## 4. Fotos

Escolha uma das formas (pode misturar na mesma planilha):

**A) Enviar os arquivos pelo painel (recomendado)**

1. Deixe as fotos numa pasta do computador, com nomes simples, ex.: `geladeira-frente.jpg`.
2. Na coluna `fotos`, escreva os nomes dos arquivos (com ou sem `.jpg`).
3. No painel, clique em **Enviar fotos (opcional)** e selecione todas as fotos da pasta
   (dá para selecionar várias de uma vez).
4. Espere terminar: o envio é de **uma foto a cada ~1,6 segundo** (100 fotos ≈ 3 minutos).
   Não feche a página durante o envio.
5. Depois clique em **Conferir planilha** — os nomes viram links automaticamente.

Formatos: JPG, PNG ou WEBP, até 15 MB cada. As fotos ficam guardadas no servidor da loja.

**B) Links da internet**

Se o fornecedor tem as fotos online, cole o link completo (`https://…`). A loja mostra
a foto direto do site do fornecedor: se ele tirar a foto do ar, ela some da loja.
Por isso a forma A é mais segura.

**Sem foto:** o produto entra com “Foto em preparação”. Dá para adicionar depois, na tela
de edição do produto (Enviar foto), ou reimportando a planilha com a coluna `fotos`.

## 5. Conferir (nada é gravado)

1. Clique em **Importar planilha** e escolha seu arquivo.
2. Escolha o que fazer quando o SKU já existir:
   - **Atualizar o produto existente** (recomendado) — não cria duplicado.
   - **Só criar produtos novos** — SKU que já existe vira erro e não é alterado.
3. Clique em **Conferir planilha**.

Aparece uma tabela com cada linha: **Novo**, **Atualizar** ou **Erro**, com preço,
estoque, categoria, quantidade de fotos e observações.

- Texto **vermelho** = erro: essa linha não será gravada. Corrija na planilha.
- “Atenção: …” = aviso: a linha pode ser gravada, mas confira (ex.: sem peso, sem foto,
  sem categoria, preço “de” menor que o preço).

## 6. Gravar

- Sem erros: clique em **Gravar N produto(s)** e confirme.
- Com erros: corrija a planilha e confira de novo **ou** marque
  **Gravar só as linhas sem erro**.

A gravação é “tudo ou nada”: se algum problema acontecer no meio, **nada** é gravado e
a mensagem diz qual linha causou o problema. Nenhum produto é apagado pela importação.

Depois de gravar, os produtos aparecem na lista do Catálogo e na loja (os ativos).

## 7. Atualizar depois (preço, estoque, fotos)

Use a mesma planilha: mantenha o `sku`, mude o que quiser e importe de novo com
**Atualizar o produto existente**. Células vazias não mudam nada.

Sobre fotos numa reimportação: fotos novas são **acrescentadas** às que o produto já tem
(até 10). Para remover/reordenar fotos use a tela do produto.

## 8. Problemas comuns

| Mensagem | O que fazer |
|---|---|
| Linha de exemplo do modelo | Apague as linhas com SKU `EXEMPLO-…`. |
| Categoria não encontrada | Use uma categoria da lista acima (ou crie a categoria antes). |
| Foto “…” não é um link | Envie o arquivo em **Enviar fotos** antes de conferir, ou use link `https://`. Confira se o nome na planilha é igual ao nome do arquivo. |
| Preço inválido / Estoque inválido | Só números. Estoque sem vírgula. |
| SKU repetido neste arquivo | O mesmo SKU aparece duas vezes; só a primeira vale. |
| SKU já cadastrado (modo “só criar”) | Normal nesse modo. Para atualizar, escolha “Atualizar o produto existente”. |
| Máximo de 500 linhas | Divida a planilha. |
| Formato .xls antigo | Salve como .xlsx ou CSV. |

## Detalhes técnicos (equipe)

- Endpoint: `POST /api/v1/admin/products/import` (somente admin; JWT + `@Roles('admin')`;
  limite 20 req/min). Corpo: `{ csv, dryRun?, mode?: 'upsert' | 'create_only', skipInvalid? }`.
  O navegador converte `.xlsx` em CSV (`apps/web/src/lib/spreadsheet-read.ts`, sem
  dependências); a validação oficial é só na API (`catalog-csv.ts`).
- `dryRun: true` devolve `preview` linha a linha sem gravar. A gravação roda numa única
  transação Prisma; qualquer falha desfaz tudo. Auditoria: `catalog.import`.
- Limites: 500 linhas, 450 mil caracteres no CSV, 5 MB de arquivo, 10 fotos por produto.
- Fotos por nome: o painel envia cada arquivo para `POST /admin/uploads` (volume
  `/data/uploads`, 40/min) e troca o nome pelo link antes de conferir. Fotos enviadas e
  não usadas ficam no volume (não há limpeza automática).
- Modelos gerados por `apps/web/scripts/gerar-modelo-importacao.ts`
  (`cd apps/web && npx tsx scripts/gerar-modelo-importacao.ts`). O teste
  `catalog-import-sheet.spec.ts` falha se o arquivo commitado não bater com o gerador
  ou se as colunas do web e da API divergirem.
