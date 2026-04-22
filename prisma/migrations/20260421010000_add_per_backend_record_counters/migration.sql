-- Per-backend record counters on IngestionJob.
--
-- The old single successRecords/failedRecords pair was double-counted in the
-- outbox pipeline: each backend writer (Pinecone, Neo4j, Postgres) incremented
-- the same pair, so a job that succeeded on both Pinecone AND Neo4j showed
-- 2x the actual record count. Splitting into per-backend counters lets the UI
-- render "Pinecone: 6215/6215, Neo4j: 6210/6215, Postgres: SKIPPED" honestly.
--
-- After this migration the semantics of successRecords/failedRecords change:
--   - successRecords = unique valid records from the prepare phase (what
--     actually entered the outbox pipeline — i.e. totalRecords minus Zod
--     failures minus dedup drops).
--   - failedRecords  = records rejected by Zod validation in the prepare
--     phase. Duplicates are not failures; they're warnings.
-- The backend-write phase no longer touches these two columns.

ALTER TABLE "ingestion_jobs"
  ADD COLUMN "postgresSuccessRecords" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "postgresFailedRecords"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pineconeSuccessRecords" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pineconeFailedRecords"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "neo4jSuccessRecords"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "neo4jFailedRecords"     INTEGER NOT NULL DEFAULT 0;
