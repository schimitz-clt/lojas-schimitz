-- COMANDO OMEGA — financial core. ADDITIVE ONLY.
-- Adds nullable/defaulted columns, new tables, indexes and append-only triggers.
-- Never drops, deletes or rewrites existing data. Safe to re-run (IF NOT EXISTS everywhere).
-- DO NOT run against production without the owner's approval (merge => Railway auto-deploy runs `prisma migrate deploy`).

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "financialState" VARCHAR(32),
ADD COLUMN IF NOT EXISTS "financialStateAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewStatus" VARCHAR(24);

-- AlterTable
ALTER TABLE "PaymentEvent" ADD COLUMN IF NOT EXISTS "action" VARCHAR(80),
ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dataId" VARCHAR(80),
ADD COLUMN IF NOT EXISTS "lastError" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "notificationId" VARCHAR(80),
ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "processingStatus" VARCHAR(32);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentStateTransition" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT,
    "fromState" VARCHAR(32),
    "toState" VARCHAR(32) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(500),
    "actorId" TEXT,
    "eventKey" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "PaymentStateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "entryType" VARCHAR(32) NOT NULL,
    "direction" VARCHAR(8) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "paymentId" TEXT,
    "orderId" TEXT,
    "refundId" TEXT,
    "chargebackId" TEXT,
    "externalId" VARCHAR(80),
    "source" VARCHAR(32) NOT NULL,
    "actorId" TEXT,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinancialAuditEvent" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "actorId" TEXT,
    "actorRole" VARCHAR(16),
    "origin" VARCHAR(32) NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "refundId" TEXT,
    "amount" DECIMAL(12,2),
    "oldState" VARCHAR(32),
    "newState" VARCHAR(32),
    "reason" VARCHAR(500),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "FinancialAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentRefund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'REQUESTED',
    "isFull" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(500) NOT NULL,
    "requestedBy" TEXT,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'mercadopago',
    "providerRefundId" VARCHAR(80),
    "providerStatus" VARCHAR(40),
    "lastError" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Chargeback" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'mercadopago',
    "providerCaseId" VARCHAR(80) NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT,
    "externalPaymentId" VARCHAR(80),
    "amount" DECIMAL(12,2),
    "currency" VARCHAR(3),
    "reason" VARCHAR(120),
    "status" VARCHAR(16) NOT NULL DEFAULT 'OPENED',
    "documentationStatus" VARCHAR(40),
    "coverageApplied" BOOLEAN,
    "documentationDeadline" TIMESTAMP(3),
    "providerStatusDetail" VARCHAR(60),
    "lastFetchError" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "Chargeback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinancialDiscrepancy" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(10) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "dedupeKey" VARCHAR(200) NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "externalId" VARCHAR(80),
    "expected" VARCHAR(200),
    "actual" VARCHAR(200),
    "message" VARCHAR(500) NOT NULL,
    "details" JSONB,
    "conditionCleared" BOOLEAN NOT NULL DEFAULT false,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" VARCHAR(500),

CONSTRAINT "FinancialDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinancialReconciliationRun" (
    "id" TEXT NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "scopeRef" VARCHAR(120),
    "status" VARCHAR(16) NOT NULL,
    "triggeredBy" TEXT,
    "origin" VARCHAR(32) NOT NULL,
    "stats" JSONB,
    "error" VARCHAR(500),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

CONSTRAINT "FinancialReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RiskAssessment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "decision" VARCHAR(10) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "hits" JSONB NOT NULL,
    "rulesetVersion" VARCHAR(40) NOT NULL,
    "trigger" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InventoryMovement" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "qty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentStateTransition_paymentId_createdAt_idx" ON "PaymentStateTransition"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentStateTransition_toState_createdAt_idx" ON "PaymentStateTransition"("toState", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentStateTransition_paymentId_eventKey_key" ON "PaymentStateTransition"("paymentId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialLedgerEntry_idempotencyKey_key" ON "FinancialLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialLedgerEntry_paymentId_createdAt_idx" ON "FinancialLedgerEntry"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialLedgerEntry_orderId_createdAt_idx" ON "FinancialLedgerEntry"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialLedgerEntry_entryType_createdAt_idx" ON "FinancialLedgerEntry"("entryType", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialLedgerEntry_createdAt_idx" ON "FinancialLedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialAuditEvent_paymentId_createdAt_idx" ON "FinancialAuditEvent"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialAuditEvent_orderId_createdAt_idx" ON "FinancialAuditEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialAuditEvent_action_createdAt_idx" ON "FinancialAuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialAuditEvent_createdAt_idx" ON "FinancialAuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRefund_paymentId_idx" ON "PaymentRefund"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRefund_status_createdAt_idx" ON "PaymentRefund"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRefund_provider_providerRefundId_key" ON "PaymentRefund"("provider", "providerRefundId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Chargeback_paymentId_idx" ON "Chargeback"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Chargeback_status_createdAt_idx" ON "Chargeback"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Chargeback_provider_providerCaseId_key" ON "Chargeback"("provider", "providerCaseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialDiscrepancy_dedupeKey_key" ON "FinancialDiscrepancy"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialDiscrepancy_status_severity_idx" ON "FinancialDiscrepancy"("status", "severity");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialDiscrepancy_paymentId_idx" ON "FinancialDiscrepancy"("paymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialDiscrepancy_orderId_idx" ON "FinancialDiscrepancy"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialDiscrepancy_lastSeenAt_idx" ON "FinancialDiscrepancy"("lastSeenAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialReconciliationRun_scope_startedAt_idx" ON "FinancialReconciliationRun"("scope", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialReconciliationRun_startedAt_idx" ON "FinancialReconciliationRun"("startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskAssessment_orderId_createdAt_idx" ON "RiskAssessment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RiskAssessment_decision_createdAt_idx" ON "RiskAssessment"("decision", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryMovement_orderItemId_kind_key" ON "InventoryMovement"("orderItemId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_externalId_idx" ON "Payment"("externalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentEvent_provider_notificationId_idx" ON "PaymentEvent"("provider", "notificationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentEvent_processingStatus_createdAt_idx" ON "PaymentEvent"("processingStatus", "createdAt");

-- ───── Conditional unique: one local Payment per provider payment id ─────
-- Created ONLY if existing data has no duplicates. If duplicates exist, the index is skipped
-- (NOTICE in the migration log) and the reconciliation engine reports them as
-- DUPLICATE_EXTERNAL_ID discrepancies instead. No row is touched either way.
DO $$
DECLARE dup_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Payment_provider_externalId_unique') THEN
    SELECT count(*) INTO dup_count FROM (
      SELECT "provider", "externalId" FROM "Payment"
      WHERE "externalId" IS NOT NULL
      GROUP BY "provider", "externalId" HAVING count(*) > 1
    ) d;
    IF dup_count = 0 THEN
      CREATE UNIQUE INDEX "Payment_provider_externalId_unique"
        ON "Payment"("provider", "externalId") WHERE "externalId" IS NOT NULL;
    ELSE
      RAISE NOTICE 'Payment_provider_externalId_unique SKIPPED: % duplicate (provider, externalId) groups exist — see FinancialDiscrepancy DUPLICATE_EXTERNAL_ID', dup_count;
    END IF;
  END IF;
END $$;

-- ───── Append-only enforcement (financial history can never be edited or deleted) ─────
CREATE OR REPLACE FUNCTION "financial_append_only_guard"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['FinancialLedgerEntry','FinancialAuditEvent','PaymentStateTransition','InventoryMovement'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_append_only') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION "financial_append_only_guard"()', t || '_append_only', t);
    END IF;
  END LOOP;
END $$;
