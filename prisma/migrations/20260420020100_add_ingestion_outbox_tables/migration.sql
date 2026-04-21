-- Tier 3.1 step 2 — Chunked outbox ingestion pipeline tables + columns.
-- The enums referenced here are defined in the 20260420020000 migration.

-- IngestionJob new columns
ALTER TABLE "ingestion_jobs"
  ADD COLUMN "totalChunks"        INTEGER              NOT NULL DEFAULT 0,
  ADD COLUMN "preparedChunks"     INTEGER              NOT NULL DEFAULT 0,
  ADD COLUMN "initiatedByRole"    "UserRole"           NOT NULL DEFAULT 'USER',
  ADD COLUMN "authorizedBackends" "IngestionBackend"[] NOT NULL DEFAULT ARRAY[]::"IngestionBackend"[];

-- IngestionOutbox: one row per (job, backend, chunkIndex).
CREATE TABLE "ingestion_outbox" (
  "id"             TEXT NOT NULL,
  "ingestionJobId" TEXT NOT NULL,
  "backend"        "IngestionBackend" NOT NULL,
  "chunkIndex"     INTEGER NOT NULL,
  "chunkS3Key"     TEXT NOT NULL,
  "recordCount"    INTEGER NOT NULL,
  "status"         "IngestionOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "lastError"      TEXT,
  "startedAt"      TIMESTAMP(3),
  "processedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ingestion_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ingestion_outbox_ingestionJobId_backend_chunkIndex_key"
  ON "ingestion_outbox"("ingestionJobId", "backend", "chunkIndex");
CREATE INDEX "ingestion_outbox_backend_status_idx"
  ON "ingestion_outbox"("backend", "status");
CREATE INDEX "ingestion_outbox_ingestionJobId_status_idx"
  ON "ingestion_outbox"("ingestionJobId", "status");

ALTER TABLE "ingestion_outbox"
  ADD CONSTRAINT "ingestion_outbox_ingestionJobId_fkey"
  FOREIGN KEY ("ingestionJobId") REFERENCES "ingestion_jobs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
