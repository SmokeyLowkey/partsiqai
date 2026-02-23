-- Add tsvector column for full-text search
ALTER TABLE "parts" ADD COLUMN "searchVector" tsvector;

-- Populate existing rows with weighted search vectors
-- A = partNumber (highest), B = description, C = category, D = subcategory
UPDATE "parts" SET "searchVector" =
  setweight(to_tsvector('english', COALESCE("partNumber", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("description", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("category", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("subcategory", '')), 'D');

-- GIN index for fast full-text search
CREATE INDEX "parts_searchVector_idx" ON "parts" USING GIN ("searchVector");

-- Partial index for active parts scoped by organization (common query pattern)
CREATE INDEX "parts_org_active_idx" ON "parts" ("organizationId") WHERE "isActive" = true;

-- Auto-update trigger: keeps searchVector in sync on INSERT/UPDATE
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

CREATE TRIGGER parts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "partNumber", "description", "category", "subcategory"
  ON "parts"
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_search_vector();
