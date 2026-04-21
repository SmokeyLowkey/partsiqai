-- Tier 3.1 step 1 — add enums that the outbox table + extended IngestionJob
-- columns will reference. Split from the table DDL because `ALTER TYPE ...
-- ADD VALUE` cannot coexist with uses of the new value in the same tx.

-- New enums for the outbox fan-out.
CREATE TYPE "IngestionBackend" AS ENUM ('POSTGRES', 'PINECONE', 'NEO4J');
CREATE TYPE "IngestionOutboxStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'OK', 'FAILED', 'REJECTED');

-- Extend IngestionJobStatus with the two new outbox-pipeline states.
ALTER TYPE "IngestionJobStatus" ADD VALUE IF NOT EXISTS 'PREPARING';
ALTER TYPE "IngestionJobStatus" ADD VALUE IF NOT EXISTS 'READY';
