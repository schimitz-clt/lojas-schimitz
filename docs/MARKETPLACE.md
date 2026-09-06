# Marketplace — Lojas Schimitz

## v1 (shipped)

Multi-seller **foundation** without breaking single-store checkout:

- Model `Seller`: name, slug, status (`pending` | `active` | `suspended`), optional `ownerUserId`, optional `commissionPercent` stub.
- `Product.sellerId` (required). Existing catalog backfills to default seller **Lojas Schimitz** (`slug=lojas-schimitz`).
- Public product APIs include `seller: { id, name, slug }`. Product page shows “Vendido por …”.
- Admin: `GET/POST /admin/sellers`, `PATCH /admin/sellers/:id/status`; products accept optional `sellerId`.
- Checkout unchanged. `OrderItem.sellerId` stores a snapshot when the order is created.
- **No** payment split / commission payout engine.

## v2 (planned — not in this release)

- Commission calculation on paid orders
- Seller payout / split with Mercado Pago (or ledger + manual transfer)
- Seller portal (login role=`seller`) for own catalog and fulfillment
- Per-seller shipping rules and multi-parcel checkout
- Dispute / chargeback allocation by seller
