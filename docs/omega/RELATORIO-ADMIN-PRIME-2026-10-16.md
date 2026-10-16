# Comando Omega — Administração Schimitz Prime (16/10/2026)

## Auditoria (antes de mudar)
- O admin já é um console único (`/admin/*`, 13 seções, `AdminConsole` + `admin-console-state.ts`), com menu lateral no computador e barra inferior no celular. Todas as rotas da API ficam em `AdminController` com `@Roles('admin')` e `AdminAuditInterceptor`, que grava POST/PUT/PATCH/DELETE em `AuditLog` (#204/#208).
- O painel (`/admin`, GET `/admin/ops`) já mostrava números reais com o horário do snapshot ("Snapshot dd/mm, hh:mm"), "—" quando o dado falta e um estado de erro. Não havia número inventado.
- Lacunas encontradas: (1) os alertas de atendimento de #221 eram calculados, mas **não apareciam** no painel; (2) **não havia campo de fornecedor/custo**; (3) os alertas de peso/medidas abriam a fila de fotos, que é a tela errada; (4) o visual era preto e amarelo, fora da marca.

## O que mudou (PRs mesclados, 4 checks do CI verdes em cada um)
| PR | Antes | Depois | Deploy (produção e staging) |
|---|---|---|---|
| #224 | Separação parada e envio sem rastreio ficavam só no JSON | Alertas `fulfillment_prep_stuck` e `shipped_without_tracking` aparecem no painel. O clique abre o pedido (ou a fila) | SUCCESS nos 4 serviços (commit 26fe7dd) |
| #225 | Sem fornecedor/custo | Tabela nova `ProductSupplier`, criada por migração **aditiva**. GET/PUT `/admin/products/:id/supplier` com auditoria. Bloco "Fornecedor e custo (interno)" no editor de produto, com estado "Não configurado" e margem bruta só quando há custo real. Alerta `products_missing_supplier` com contagem real. Os alertas de fornecedor e de peso/medidas abrem o Catálogo | SUCCESS. Log de produção: "Applying migration `20261016_product_supplier` … All migrations have been successfully applied", e o mesmo no staging |
| #226 | Preto e amarelo | Azul-marinho (#07122a/#0b1b3a) e vinho (#8c2438), com rosa-vinho sobre o marinho. Contraste AA testado | SUCCESS no web (commit 6173c80). Manifest de produção com `theme_color #07122a` |

## Testes
- API: `product-supplier.spec.ts`, `admin-ops.spec.ts` e **`admin-prime.e2e.db.spec.ts`** (HTTP real com Postgres local): anônimo recebe 401; cliente recebe **403** em GET/PUT supplier e em `/admin/ops`; admin recebe 200; validação dá 400; o PUT fica gravado em AuditLog; a contagem do ops cai 1; a vitrine (`/products/:slug` e a listagem) **não** devolve custo nem fornecedor.
- Web: `admin-ops-ui.spec.ts`, `admin-supplier-ui.spec.ts` e `admin-brand.spec.ts`.
- Navegador (Chrome, stack local com admin do seed), 13 seções × computador e celular, antes e depois: **0 erros de JS, 0 respostas 5xx, sem rolagem horizontal**. O fornecedor foi salvo pela tela ("Fornecedor salvo (registrado na auditoria)"). Os arquivos estão em `evidencias-admin/` (`resultado-navegador.txt` e prints antes/depois).

## Verificação pós-deploy
- Produção: API `/health` 200; `/admin/ops` e `/admin/products/:id/supplier` respondem 401 sem sessão (GET e PUT); página de produto pública sem `costPrice`/`supplierName`; web `/`, `/admin`, `/admin/catalogo`, `/produtos` 200.
- Staging: API health 200, rotas admin 401 sem sessão, web `/admin` 200.

## Rollback
- #224 e #226: reverter o PR (sem migração).
- #225: reverter o PR. A tabela `ProductSupplier` pode ficar, porque nada mais a lê. Se for preciso, dá pra remover depois com `DROP TABLE "ProductSupplier"`, depois de exportar os dados.

## NÃO COMPROVADO / pendente
- **Admin logado em produção e no staging:** não há conta de teste de admin, e eu não criei uma em dados reais. Foi comprovado localmente e no CI. Em produção, só sem sessão (401).
- **Staging antes da produção:** o deploy é automático no push do `main` e vai para os dois ambientes ao mesmo tempo. Não existe promoção separada.
- **Alertas de atendimento com dados:** não há pedidos parados hoje. A regra está coberta por testes, mas não foi vista com um pedido real.
- **Modernização de filtros, busca e paginação tela a tela:** fora o visual e os links dos alertas, as telas não mudaram. Elas já tinham filtros e busca (pedidos, catálogo, clientes, auditoria). Uma revisão profunda de cada tela fica para uma próxima etapa.
- **Marketing e marketplace:** nada foi criado sem dados por trás. Nenhuma tela de demonstração.
- **Automações:** já existiam e continuam iguais: importação de catálogo com conferência, CSV de vendas, de comissões, de produtos sem foto e de produtos sem peso/medidas. Não criei exportação nova de pedidos, porque ela levaria dados pessoais dos clientes. Ainda não existe importação de fornecedores em massa.
- O texto técnico do painel ("GET /admin/ops") continua aparecendo para o usuário.
