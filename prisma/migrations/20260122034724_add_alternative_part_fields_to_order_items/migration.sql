-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "alternativeReason" TEXT,
ADD COLUMN     "isAlternative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalPartNumber" TEXT,
ADD COLUMN     "supplierPartNumber" TEXT;
