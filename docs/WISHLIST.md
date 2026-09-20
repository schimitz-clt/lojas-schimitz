# Lista de desejos (Salvos)

**Escopo:** Vitrine+ PR #6 — coração no card/PDP + página Salvos na Conta. Sem Mercado Pago, cupons, busca/home/PDP rewrite.

## Persistência

| Quem | Onde | Verdade |
|------|------|---------|
| Cliente **logado** | Postgres `Favorite` (`userId` + `productId`) | **Fonte da verdade** |
| **Visitante** | `localStorage` `sch_wishlist_guest_v1` | Só neste aparelho. Ao entrar, a vitrine faz `POST /favorites` dos IDs e apaga o local. |

Não há tabela nova de wishlist. O model `Favorite` existe desde SCH-001.

## Deploy — migration aditiva

Este PR **precisa** de `prisma migrate deploy` em produção.

- Migration: `prisma/migrations/20260920_wishlist_favorite_list_idx`
- SQL: `CREATE INDEX IF NOT EXISTS "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");`
- **Não é destrutiva** — sem DROP, sem coluna nova. A tabela `Favorite` já existia.
- Sem o índice a API ainda funciona; o `start` do root já roda `migrate deploy`.

## API (JWT obrigatório)

Envelope `{ ok, data }`. Mutações recusam visitante (401).

| Método | Rota | Comportamento |
|--------|------|----------------|
| GET | `/api/v1/favorites` | Itens do usuário, mais recentes primeiro. Só produto `active` + vendedor `active`. Shape público de catálogo (`stock`, `image`, `imageUrl`, seller sem status). |
| POST | `/api/v1/favorites` body `{ productId }` | Salva. **Idempotente** (re-salvar o mesmo ID não falha). 404 se produto inativo / vendedor oculto. |
| DELETE | `/api/v1/favorites/:productId` | Remove. **Idempotente** (já ausente → `{ deleted: true }`). |

## UI

- Coração no `ProductCard` e no PDP (salvar / salvo).
- Conta → **Salvos** (`/conta/salvos`). `/favoritos` abre a mesma lista.
- Página: foto, preço, PIX 5%, link para a PDP, remover. Sem produto inventado.
- Visitante: o coração pode marcar neste aparelho e pede login para gravar na conta.

## Fora de escopo

Pagamentos/MP/split, cupons, busca/home/PDP, Admin de cupons.
