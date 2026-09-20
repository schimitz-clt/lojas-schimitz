-- Additive: persist the applied coupon code on Cart (sacola → checkout).
-- Existing carts stay NULL (no coupon). Safe to run on production.

ALTER TABLE "Cart" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
