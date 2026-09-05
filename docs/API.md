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
| GET/POST/PATCH/DELETE | `/me/addresses` | user |
| GET | `/categories` | público |
| GET | `/products` `?q=&category=` | público |
| GET | `/products/:slug` | público |
| GET/DELETE | `/cart` | user ou guest |
| POST/PATCH/DELETE | `/cart/items` | user ou guest |
| POST/GET | `/orders` | user |
| GET | `/orders/:publicId` | user |
| POST | `/coupons/validate` | user |
| GET/POST/DELETE | `/favorites` | user |
| GET/POST | `/products/:id/reviews` | público / user |
| GET | `/admin/orders` `/admin/products` | admin |
