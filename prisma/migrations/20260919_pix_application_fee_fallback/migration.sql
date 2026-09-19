-- PIX application_fee fallback: honest splitMode + ledger source when MP rejects the fee.
-- Additive only. Does not enable live APP_USR split or ALLOW_LIVE.

ALTER TYPE "PaymentSplitMode" ADD VALUE IF NOT EXISTS 'ledger_only';
ALTER TYPE "CommissionSource" ADD VALUE IF NOT EXISTS 'pending_manual_or_pix_no_fee';
