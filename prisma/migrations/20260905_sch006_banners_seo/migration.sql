-- SCH-006 — Banners da home + SEO da loja (aditiva).

CREATE TABLE IF NOT EXISTS "StoreSettings" (
  "id" TEXT NOT NULL,
  "siteTitle" TEXT NOT NULL DEFAULT 'Lojas Schimitz',
  "siteDescription" TEXT NOT NULL DEFAULT 'Tudo o que você precisa. No padrão das grandes. Eletro, celulares e casa em Porto Alegre.',
  "ogImageUrl" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StoreSettings" ("id", "siteTitle", "siteDescription", "ogImageUrl", "updatedAt")
VALUES (
  'default',
  'Lojas Schimitz',
  'Tudo o que você precisa. No padrão das grandes. Eletro, celulares e casa em Porto Alegre.',
  NULL,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "HomeBanner" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "alt" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT NOT NULL,
  "linkUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HomeBanner_active_sortOrder_idx" ON "HomeBanner"("active", "sortOrder");
