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
- Authz: seller cannot edit another seller’s products (`FORBIDDEN_OTHER_SELLER`).

## Commission stub v1 (shipped)

- On order → `paid`, create `CommissionLedger` rows per order item with `sellerId`:
  - `amount = itemTotal * commissionPercent / 100` (default **10%** if seller has no percent)
  - `status = pending`
  - Idempotent on `orderItemId` (unique)
- **No** real payout / Mercado Pago split transfer.
- Admin read-only: `GET /admin/commissions` (pending).

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
| **Real MP split payouts** | Not built | Commission ledger is stub only; Mercado Pago Marketplace / split / transfer to sellers is future work. |
| **Per-seller shipping** | Planned | Multi-parcel / seller CEP rules not in v1. |
| **Dispute allocation** | Planned | Chargeback by seller not implemented. |

## v2 (planned)

- Commission status transitions + payout batch / ledger export
- Seller payout / split with Mercado Pago (or manual transfer from pending ledger)
- Per-seller shipping rules and multi-parcel checkout
- Dispute / chargeback allocation by seller
