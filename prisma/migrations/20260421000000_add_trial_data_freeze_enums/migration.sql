-- Tier 5 step 1 — add enum values that the new `dataFrozenAt` column + audit
-- entries will reference. Isolated in its own migration because
-- `ALTER TYPE ... ADD VALUE` cannot coexist with uses of the new value in
-- the same transaction (precedent: 20260420000000_add_admin_audit_event_types).

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'TRIAL_DATA_FROZEN';
