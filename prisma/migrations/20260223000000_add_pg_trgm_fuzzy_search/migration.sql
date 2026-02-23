-- Enable pg_trgm extension for fuzzy/typo-tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fuzzy matching on parts table
CREATE INDEX "parts_description_trgm_idx" ON "parts" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "parts_partNumber_trgm_idx" ON "parts" USING GIN ("partNumber" gin_trgm_ops);
CREATE INDEX "parts_category_trgm_idx" ON "parts" USING GIN ("category" gin_trgm_ops);
