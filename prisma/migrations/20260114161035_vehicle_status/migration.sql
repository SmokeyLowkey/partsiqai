-- CreateEnum
CREATE TYPE "VehicleSearchConfigStatus" AS ENUM ('PENDING_ADMIN_REVIEW', 'SEARCH_READY', 'NEEDS_UPDATE', 'INACTIVE');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "searchConfigStatus" "VehicleSearchConfigStatus" NOT NULL DEFAULT 'PENDING_ADMIN_REVIEW';

-- CreateTable
CREATE TABLE "vehicle_search_mappings" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pineconeNamespace" TEXT,
    "pineconeMachineModel" TEXT,
    "pineconeManufacturer" TEXT,
    "pineconeYear" INTEGER,
    "neo4jModelName" TEXT,
    "neo4jManufacturer" TEXT,
    "neo4jSerialRange" TEXT,
    "neo4jTechnicalDomains" TEXT[],
    "neo4jCategories" TEXT[],
    "neo4jNamespace" TEXT,
    "postgresCategory" TEXT,
    "postgresSubcategory" TEXT,
    "postgresMake" TEXT,
    "postgresModel" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "lastTestQuery" TEXT,
    "lastTestResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_search_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_search_mappings_vehicleId_key" ON "vehicle_search_mappings"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_search_mappings_organizationId_idx" ON "vehicle_search_mappings"("organizationId");

-- CreateIndex
CREATE INDEX "vehicle_search_mappings_verifiedBy_idx" ON "vehicle_search_mappings"("verifiedBy");

-- CreateIndex
CREATE INDEX "vehicles_organizationId_searchConfigStatus_idx" ON "vehicles"("organizationId", "searchConfigStatus");

-- AddForeignKey
ALTER TABLE "vehicle_search_mappings" ADD CONSTRAINT "vehicle_search_mappings_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_search_mappings" ADD CONSTRAINT "vehicle_search_mappings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_search_mappings" ADD CONSTRAINT "vehicle_search_mappings_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
