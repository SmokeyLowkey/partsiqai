-- CreateEnum
CREATE TYPE "OverageStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'FORGIVEN', 'FAILED');

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'VAPI';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "pineconeHost" TEXT;

-- AlterTable
ALTER TABLE "quote_requests" ADD COLUMN     "voiceAgentContext" TEXT;

-- CreateTable
CREATE TABLE "usage_overages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "includedCalls" INTEGER NOT NULL,
    "totalCalls" INTEGER NOT NULL,
    "overageCalls" INTEGER NOT NULL,
    "overageRate" DECIMAL(10,2) NOT NULL,
    "overageAmount" DECIMAL(10,2) NOT NULL,
    "stripeInvoiceId" TEXT,
    "stripeInvoiceItemId" TEXT,
    "billedAt" TIMESTAMP(3),
    "status" "OverageStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_overages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_overages_organizationId_billingPeriodStart_idx" ON "usage_overages"("organizationId", "billingPeriodStart");

-- CreateIndex
CREATE INDEX "usage_overages_status_idx" ON "usage_overages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "usage_overages_organizationId_billingPeriodStart_key" ON "usage_overages"("organizationId", "billingPeriodStart");

-- AddForeignKey
ALTER TABLE "usage_overages" ADD CONSTRAINT "usage_overages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
