-- Persistent financial-core metrics. ADDITIVE ONLY: one new table + one index.
-- No existing table/column is altered, no data is rewritten or deleted. Safe to re-run.
-- NOTE: merge to main => Railway deploy runs `prisma migrate deploy` (docker-entrypoint.sh).

CREATE TABLE IF NOT EXISTS "FinanceMetricCounter" (
    "day" DATE NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceMetricCounter_pkey" PRIMARY KEY ("day", "name")
);

CREATE INDEX IF NOT EXISTS "FinanceMetricCounter_name_day_idx" ON "FinanceMetricCounter"("name", "day");
