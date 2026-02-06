-- DropForeignKey
ALTER TABLE "quote_requests" DROP CONSTRAINT "quote_requests_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "quote_requests" DROP CONSTRAINT "quote_requests_vehicleId_fkey";

-- AlterTable
ALTER TABLE "quote_requests" ALTER COLUMN "supplierId" DROP NOT NULL,
ALTER COLUMN "vehicleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
