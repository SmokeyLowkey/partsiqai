-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('VALID', 'SOFT_BOUNCE', 'HARD_BOUNCE', 'SPAM_COMPLAINT', 'INVALID', 'UNSUBSCRIBED');

-- AlterTable
ALTER TABLE "quote_requests" ADD COLUMN     "convertingBy" TEXT,
ADD COLUMN     "convertingStartedAt" TIMESTAMP(3),
ADD COLUMN     "isConverting" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "bounceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bounceReason" TEXT,
ADD COLUMN     "emailDeliveryStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'VALID',
ADD COLUMN     "lastBounceAt" TIMESTAMP(3),
ADD COLUMN     "lastEmailVerifiedAt" TIMESTAMP(3);
