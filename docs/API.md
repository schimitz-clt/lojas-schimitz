# API `/api/v1`

Envelope de sucesso: `{ "ok": true, "data": {}, "meta": { "requestId": "uuid" } }`
Envelope de erro: `{ "ok": false, "error": { "code": "...", "message": "..." } }`

Header de usuário: `Authorization: Bearer <access_token>`
Header de visitante no carrinho: `x-guest-token: <uuid>`

| Método | Rota | Acesso |
|---|---|---|
| GET | `/health` | público |
| POST | `/auth/register` | público |
| POST | `/auth/login` | público |
| POST | `/auth/refresh` | público |
| POST | `/auth/logout` | user |
| GET/PATCH | `/me` | user |
| GET | `/me/loyalty` | user (SCHIMITZ+ saldo + extrato) |
| GET/POST/PATCH/DELETE | `/me/addresses` | user |
| GET | `/categories` | público |
| GET | `/products` `?q=&category=` | público |
| GET | `/products/:slug` | público |
| GET/DELETE | `/cart` | user ou guest |
| POST/PATCH/DELETE | `/cart/items` | user ou guest |
| POST/GET | `/orders` body create `{ addressId, couponCode?, cashbackAmount? }` | user |
| GET | `/orders/:publicId` | user |
| POST | `/coupons/validate` body `{ code, subtotal }` | user |
| POST | `/shipping/quote` body `{ cep, subtotal }` | user |
| GET | `/admin/shipping` | admin |
| PATCH | `/admin/shipping/settings` body `{ freeAbove, defaultFee, defaultDays }` | admin |
| POST | `/admin/shipping/rules` body `{ cepPrefix, fee, estimatedDays, label?, active? }` | admin |
| PATCH | `/admin/shipping/rules/:id` | admin |
| DELETE | `/admin/shipping/rules/:id` | admin |
| GET/POST | `/admin/coupons` | admin |
| PATCH | `/admin/coupons/:id` | admin |
| GET/POST/DELETE | `/favorites` | user |
| GET | `/products/:id/reviews` | público (só publicadas) |
| GET | `/products/:id/reviews/me` | user (elegibilidade + minha avaliação) |
| POST | `/products/:id/reviews` | user comprador (upsert 1–5 ★ + texto) |
| GET | `/admin/reviews` | admin |
| PATCH | `/admin/reviews/:id` body `{ status: "published"|"hidden" }` | admin |
| DELETE | `/admin/reviews/:id` | admin |
| GET | `/admin/orders` (inclui `user.phone`) `/admin/products` `/admin/categories` | admin |
| GET | `/admin/reports/sales` `?from=&to=` (YYYY-MM-DD) → resumo, byStatus, topProducts | admin |
| POST | `/admin/uploads` multipart `file` (jpg/png/webp ≤15MB) → `{ url, filename }` | admin |
| POST | `/admin/products` body `{ name, price, description?, sku?, stock?, categoryId?, sellerId?, active?, imageUrl?, compareAtPrice?, badge? }` | admin |
| PATCH | `/admin/products/:id` (mesmos campos, parciais) | admin |
| PATCH | `/admin/orders/:id/status` body `{ status, trackingCode?, carrier? }` (fulfillment) | admin |
| GET/POST | `/admin/sellers` | admin |
| PATCH | `/admin/sellers/:id/status` body `{ status: "pending"|"active"|"suspended" }` | admin |
| POST | `/payments/intents` body `{ orderId, method, installments?, cardToken? }` | user |
| GET | `/store/settings` | público (SEO) |
| GET | `/store/banners` | público (banners ativos) |
| GET/PATCH | `/admin/store/settings` body `{ siteTitle, siteDescription, ogImageUrl? }` | admin |
| GET/POST | `/admin/banners` | admin |
| PATCH | `/admin/banners/reorder` body `{ orderedIds: string[] }` | admin |
| PATCH/DELETE | `/admin/banners/:id` | admin |
| GET | `/admin/admins` → lista usuários role=admin | admin |
| POST | `/admin/admins` body `{ email, name, password }` (argon2) | admin |
| PATCH | `/admin/admins/:id/status` body `{ status: "active"|"blocked" }` — não desativa a si mesmo / último admin ativo; ao desativar revoga refresh tokens | admin |
| POST | `/chat` body `{ message, conversationId? }` → reply + handoff WhatsApp + produtos reais | público (20/min) |
