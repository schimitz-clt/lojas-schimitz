# Marketplace — Lojas Schimitz

## v1 (shipped)

Multi-seller **foundation** without breaking single-store checkout:

- Model `Seller`: name, slug, status (`pending` | `active` | `suspended`), optional `ownerUserId`, optional `commissionPercent` stub.
- `Product.sellerId` (required). Existing catalog backfills to default seller **Lojas Schimitz** (`slug=lojas-schimitz`).
- Public product APIs include `seller: { id, name, slug }`. Product page shows “Vendido por …”.
- Admin: `GET/POST /admin/sellers`, `PATCH /admin/sellers/:id/status`, `PATCH /admin/sellers/:id` (owner email/id + commissionPercent).
- Checkout unchanged. `OrderItem.sellerId` stores a snapshot when the order is created.

## Seller portal v1 (shipped)

- Login as a normal user; admin links them via `Seller.ownerUserId` (sets `User.role=seller` when previously `customer`).
- Web: `/vendedor` (PT).
- API (JWT, must own a Seller):
  - `GET /seller/me`
  - `GET /seller/products`
  - `PATCH /seller/products/:id` body `{ price?, stock? }` — **only own products**
  - `GET /seller/orders` — own order items grouped by order (read-only)
  - `GET /seller/commissions` — own ledger rows + totals (read-only)
- Authz: seller cannot edit another seller’s products (`FORBIDDEN_OTHER_SELLER`); seller only sees own commissions (`FORBIDDEN_OTHER_SELLER_COMMISSION`).

## Commission ledger + Repasse v1 (shipped)

- On order → `paid`, create `CommissionLedger` rows per order item with `sellerId`:
  - `amount = itemTotal * commissionPercent / 100` (default **10%** if seller has no percent)
  - `status = pending`
  - Idempotent on `orderItemId` (unique)
- **Status transitions (manual):**
  - `pending` → `approved` (admin aprovar)
  - `pending` → `paid` (atalho “marcar pago” em um passo)
  - `approved` → `paid`
- When marking **paid**, admin may store `payoutReference` (PIX end-to-end id / manual note) and optional `payoutNote`.
- Admin:
  - `GET /admin/commissions?status=&sellerId=` (default `status=pending`)
  - `PATCH /admin/commissions/:id/approve`
  - `PATCH /admin/commissions/:id/paid` body `{ payoutReference?, note? }`
  - `GET /admin/commissions/export?sellerId=&status=` → CSV (seller required)
- Admin UI (página `/admin`): filtros por status/vendedor, ações Aprovar / Marcar pago, export CSV.
- Seller UI (`/vendedor`): totais pending/approved/paid + lista read-only.

### Important — money movement is still manual

> **There is NO automatic Mercado Pago money split / OAuth marketplace / transfer API in this version.**  
> The ledger only tracks what should be remitted. Ops must pay sellers by **manual PIX** (or bank transfer) and then mark the row `paid` with the PIX E2E id (or another reference) in `payoutReference`.  
> Until MP Marketplace is built, treating the ledger as the source of truth for “who is owed what” is intentional and safe.

## Catalog hygiene (SCH-009)

Idempotent migration + seed:

- Product `slug=roblox` (or name Roblox) with `qtyOnHand <= 0` → set stock to **50**.
- Active products without image URL → `placehold.co` placeholder (same pattern as seed).
- Does **not** delete catalog; seller backfill remains intact.

## Remaining blockers (out of scope / not code-complete)

| Area | Status | Notes |
|---|---|---|
| **OpenAI billing** | Blocked externally | Chat falls back to FAQ/catalog rules when `OPENAI_API_KEY` / billing unavailable. Not fixed by marketplace code. |
| **Play Store / Android TWA** | Ops + assets | Listing, signing, Digital Asset Links — not payment/marketplace. |
| **Real MP split payouts** | Not built | Commission ledger + manual PIX Repasse v1 only; Mercado Pago Marketplace / OAuth / split / transfer to sellers is future work. |
| **Per-seller shipping** | Planned | Multi-parcel / seller CEP rules not in v1. |
| **Dispute allocation** | Planned | Chargeback by seller not implemented. |

## v2 (planned)

- Mercado Pago Marketplace OAuth + automatic split / seller transfers (replacing manual PIX)
- Payout batches / reconciliation reports beyond CSV
- Per-seller shipping rules and multi-parcel checkout
- Dispute / chargeback allocation by seller
