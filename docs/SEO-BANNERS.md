# Banners da home + SEO (SCH-006)

## Admin (`/admin/vitrine`)

1. Entre com conta `role=admin`.
2. **SEO da loja** — título, descrição meta e imagem Open Graph opcional. Salvar.
3. **Banners da home** — até **5** slides. Enviar imagem (mesmo upload `/admin/uploads` → volume `UPLOADS_DIR` / `PUBLIC_API_URL`), título/alt, link opcional (`https://` ou `/caminho`), ativar. Use ↑↓ para reordenar, Desativar/Excluir conforme necessário.
4. A home mostra **um banner por vez** (swipe no celular, setas no desktop, bolinhas embaixo). Com só 1 banner, as setas e bolinhas ficam ocultas.
5. Sem banners ativos, a home mantém o hero promocional atual (PIX / 3x / frete POA) para a vitrine não ficar vazia.

## Depois do deploy — como o dono troca os banners

1. Abra `/admin` → **Vitrine** no mesmo celular Android de antes.
2. Contador **N de 5** no topo. Enquanto houver vaga, o formulário de criar fica visível (não some depois do 1º).
3. **Criar banner**: toque em **Enviar imagem** *ou* no seletor visível **Seletor de arquivos (Android)**. Escolha JPG/PNG/WebP (não HEIC), confirme. A prévia deve aparecer. Título/alt opcionais, link do clique (ex.: `/departamento/ofertas`), marcar **Banner ativo**.
4. Toque em **Criar banner**. Toast: **Banner criado. Pode adicionar mais (1/5).** O formulário esvazia e o foco volta para criar o próximo.
5. Repita para o 2º–5º. O botão passa a **Criar outro banner**. Erro de upload/API fica **vermelho no bloco do banner** (não só no topo do Admin).
6. **Editar / reordenar**: Editar, ↑↓, Desativar ou Excluir. Em edição, **Criar outro banner** volta ao formulário vazio (se ainda houver vaga).
7. Limite de 5 no total (ativos + inativos). Para um sexto, edite ou exclua um existente.
8. Recarregue a home: carrossel com swipe (PR #43). 1 banner → sem setas/bolinhas. 2+ → swipe + bolinhas.

Se a imagem “não sobe”: o alerta vermelho no bloco do banner deve dizer que o celular não entregou o arquivo — use o seletor visível e confirme de novo.

## Público

- Home mostra banners ativos em carrossel com scroll-snap (`GET /store/banners`, no máximo 5).
- Meta site-wide vem de `GET /store/settings` (layout Next).
- Páginas de produto: `title`/`description`/OG a partir do nome e descrição do produto.
- `robots.txt` e `sitemap.xml` usam `NEXT_PUBLIC_SITE_URL` e listam produtos/categorias.

## Env

- `NEXT_PUBLIC_SITE_URL` — URL canônica da loja (SEO, OG, sitemap).
- `UPLOADS_DIR` / `PUBLIC_API_URL` — iguais aos uploads de produto (ex.: `/data/uploads` no Railway).

## Multi-admin

Não incluso neste PR. O schema já tem `UserRole.admin`; segundo admin = criar/atualizar usuário com `role=admin` (seed/`ADMIN_EMAIL` ou SQL). UI de gestão de usuários fica como follow-up.
