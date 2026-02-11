/*
  Warnings:

  - The values [BASIC,PROFESSIONAL] on the enum `SubscriptionTier` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionTier_new" AS ENUM ('STARTER', 'GROWTH', 'ENTERPRISE');
ALTER TABLE "organizations" ALTER COLUMN "subscriptionTier" DROP DEFAULT;
ALTER TABLE "organizations" ALTER COLUMN "subscriptionTier" TYPE "SubscriptionTier_new" USING (
  CASE 
    WHEN "subscriptionTier"::text = 'BASIC' THEN 'STARTER'::text
    WHEN "subscriptionTier"::text = 'PROFESSIONAL' THEN 'GROWTH'::text
    ELSE "subscriptionTier"::text
  END::"SubscriptionTier_new"
);
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";
DROP TYPE "SubscriptionTier_old";
ALTER TABLE "organizations" ALTER COLUMN "subscriptionTier" SET DEFAULT 'STARTER';
COMMIT;

-- AlterTable
ALTER TABLE "organizations" 
  ADD COLUMN "aiCallsResetDate" TIMESTAMP(3),
  ADD COLUMN "aiCallsUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAICalls" INTEGER NOT NULL DEFAULT 25,
  ALTER COLUMN "maxVehicles" SET DEFAULT 10;

-- Update limits for migrated tiers
UPDATE "organizations" SET 
  "maxVehicles" = 10,
  "maxAICalls" = 25
WHERE "subscriptionTier" = 'STARTER';

UPDATE "organizations" SET 
  "maxVehicles" = 9999,
  "maxAICalls" = 100
WHERE "subscriptionTier" = 'GROWTH';

UPDATE "organizations" SET 
  "maxVehicles" = 9999,
  "maxAICalls" = 9999
WHERE "subscriptionTier" = 'ENTERPRISE';

-- Add BYOK (Bring Your Own Keys) fields for VoIP
ALTER TABLE "organizations"
  ADD COLUMN "usePlatformKeys" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "vapiApiKey" TEXT,
  ADD COLUMN "openrouterApiKey" TEXT,
  ADD COLUMN "elevenLabsApiKey" TEXT;

-- Add hardCapEnabled and overageEnabled fields
ALTER TABLE "organizations"
  ADD COLUMN "overageEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "overageRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "hardCapEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "hardCapMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0;
