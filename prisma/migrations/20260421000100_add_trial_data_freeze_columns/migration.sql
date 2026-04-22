-- Tier 5 step 2 — Organization.dataFrozenAt marker for the trial data-freeze
-- cron. NULL = data is still present (either an active trial/sub OR an
-- expired-but-not-yet-wiped trial within the 3-day grace). Non-NULL = the
-- cron has wiped ingestion data; cleared again on re-subscribe.

ALTER TABLE "organizations"
  ADD COLUMN "dataFrozenAt" TIMESTAMP(3);
