-- CreateTable
CREATE TABLE "search_logs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "query" TEXT NOT NULL,
  "intent" TEXT,
  "searchTimeMs" INTEGER NOT NULL,
  "totalResults" INTEGER NOT NULL DEFAULT 0,
  "sourcesUsed" TEXT[] DEFAULT '{}',
  "cacheHit" BOOLEAN NOT NULL DEFAULT false,
  "spellingCorrected" BOOLEAN NOT NULL DEFAULT false,
  "isMultiPart" BOOLEAN NOT NULL DEFAULT false,
  "partCount" INTEGER DEFAULT 1,
  "vehicleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_logs_org_created" ON "search_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "search_logs_org_intent" ON "search_logs"("organizationId", "intent");
