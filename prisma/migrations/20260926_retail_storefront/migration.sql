-- Retail storefront: optional merchandising fields, store promo config, order UTM.
-- All columns are nullable. Existing rows stay valid. No data is deleted or rewritten.

ALTER TABLE "Product" ADD COLUMN "highlights" JSONB;
ALTER TABLE "Product" ADD COLUMN "features" JSONB;
ALTER TABLE "Product" ADD COLUMN "boxContents" JSONB;
ALTER TABLE "Product" ADD COLUMN "faq" JSONB;

ALTER TABLE "Order" ADD COLUMN "utmSource" VARCHAR(80);
ALTER TABLE "Order" ADD COLUMN "utmMedium" VARCHAR(80);
ALTER TABLE "Order" ADD COLUMN "utmCampaign" VARCHAR(120);
ALTER TABLE "Order" ADD COLUMN "utmContent" VARCHAR(120);
ALTER TABLE "Order" ADD COLUMN "utmTerm" VARCHAR(120);

ALTER TABLE "StoreSettings" ADD COLUMN "cnpj" VARCHAR(18);
ALTER TABLE "StoreSettings" ADD COLUMN "promoEndsAt" TIMESTAMP(3);
ALTER TABLE "StoreSettings" ADD COLUMN "promoLines" JSONB;
ALTER TABLE "StoreSettings" ADD COLUMN "trustItems" JSONB;
