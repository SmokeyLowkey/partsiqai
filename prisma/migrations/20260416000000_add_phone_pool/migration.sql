-- CreateEnum
CREATE TYPE "PhoneNumberProvider" AS ENUM ('TWILIO');

-- CreateEnum
CREATE TYPE "PhoneNumberHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'BLOCKED', 'RETIRED');

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'TWILIO';

-- CreateTable
CREATE TABLE "vapi_phone_numbers" (
    "id" TEXT NOT NULL,
    "vapiPhoneNumberId" TEXT NOT NULL,
    "twilioSid" TEXT,
    "e164" TEXT NOT NULL,
    "areaCode" TEXT,
    "provider" "PhoneNumberProvider" NOT NULL DEFAULT 'TWILIO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "healthStatus" "PhoneNumberHealth" NOT NULL DEFAULT 'HEALTHY',
    "vapiStatus" TEXT,
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "dailyCallCount" INTEGER NOT NULL DEFAULT 0,
    "dailyCallCountResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vapi_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add columns to supplier_calls
ALTER TABLE "supplier_calls" ADD COLUMN "vapiPhoneNumberRowId" TEXT;
ALTER TABLE "supplier_calls" ADD COLUMN "endedReason" TEXT;
ALTER TABLE "supplier_calls" ADD COLUMN "sipCode" TEXT;

-- AlterTable: Add voiceConfigIndex to quote_requests
ALTER TABLE "quote_requests" ADD COLUMN "voiceConfigIndex" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "vapi_phone_numbers_vapiPhoneNumberId_key" ON "vapi_phone_numbers"("vapiPhoneNumberId");
CREATE UNIQUE INDEX "vapi_phone_numbers_twilioSid_key" ON "vapi_phone_numbers"("twilioSid");
CREATE UNIQUE INDEX "vapi_phone_numbers_e164_key" ON "vapi_phone_numbers"("e164");
CREATE INDEX "vapi_phone_numbers_isActive_healthStatus_dailyCallCount_idx" ON "vapi_phone_numbers"("isActive", "healthStatus", "dailyCallCount");
CREATE INDEX "vapi_phone_numbers_healthStatus_idx" ON "vapi_phone_numbers"("healthStatus");

-- CreateIndex on supplier_calls
CREATE INDEX "supplier_calls_vapiPhoneNumberRowId_idx" ON "supplier_calls"("vapiPhoneNumberRowId");

-- AddForeignKey
ALTER TABLE "supplier_calls" ADD CONSTRAINT "supplier_calls_vapiPhoneNumberRowId_fkey" FOREIGN KEY ("vapiPhoneNumberRowId") REFERENCES "vapi_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
