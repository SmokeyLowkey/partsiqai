-- Tier 2.1: webhook dedupe table for H5 (idempotency gaps) + H8 (replay protection)
-- from the hardening audit. Additive, safe to deploy.

CREATE TABLE "processed_webhooks" (
  "source"      TEXT        NOT NULL,
  "externalId"  TEXT        NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("source", "externalId")
);

CREATE INDEX "processed_webhooks_processedAt_idx"
  ON "processed_webhooks" ("processedAt");
