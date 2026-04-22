-- Restore the FTS `searchVector` column on `parts`.
--
-- Why this exists: the original FTS migration (20260222000000) predates the
-- Prisma baseline (20260312032820_neon_init). Any database bootstrapped with
-- the baseline — dev on Neon, prod on Render, or a fresh local — has
-- the baseline marker but none of the pre-baseline migrations' SQL applied.
-- Result: postgres-search.ts's FTS query fails with
--   column "searchVector" does not exist  (Postgres code 42703)
-- on every request, and silently falls back to ILIKE + trigram.
--
-- This remediation is idempotent (IF NOT EXISTS everywhere) so it's safe to
-- run on databases that DO already have the column (older prod-like DBs
-- created before the baseline).

-- 1. Column — idempotent.
ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- 2. Backfill any NULLs. Safe to re-run: UPDATE is a no-op on rows whose
--    weighted vector already matches what we'd write.
UPDATE "parts"
SET "searchVector" =
  setweight(to_tsvector('english', COALESCE("partNumber", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("description", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("category", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("subcategory", '')), 'D')
WHERE "searchVector" IS NULL;

-- 3. GIN index for the FTS column.
CREATE INDEX IF NOT EXISTS "parts_searchVector_idx"
  ON "parts" USING GIN ("searchVector");

-- 4. Partial index on active parts by org (hot path for search).
CREATE INDEX IF NOT EXISTS "parts_org_active_idx"
  ON "parts" ("organizationId")
  WHERE "isActive" = true;

-- 5. Auto-update trigger. CREATE OR REPLACE is idempotent for the function.
CREATE OR REPLACE FUNCTION update_parts_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW."partNumber", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."description", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."category", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."subcategory", '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger — DROP first because CREATE TRIGGER has no IF NOT EXISTS in
--    pre-PG 14 (Neon is on PG 16 so this could be simplified, but this
--    shape works on both and avoids version-specific branches).
DROP TRIGGER IF EXISTS parts_search_vector_trigger ON "parts";
CREATE TRIGGER parts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "partNumber", "description", "category", "subcategory"
  ON "parts"
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_search_vector();
