-- CreateEnum
CREATE TYPE "ThreadRole" AS ENUM ('TECHNICIAN', 'MANAGER');

-- AlterTable: QuoteRequest - Add manager takeover fields
ALTER TABLE "quote_requests" ADD COLUMN "managerTakeoverAt" TIMESTAMP(3),
ADD COLUMN "managerTakeoverId" TEXT;

-- AlterTable: EmailThread - Add owner user tracking
ALTER TABLE "email_threads" ADD COLUMN "ownerUserId" TEXT;

-- AlterTable: QuoteRequestEmailThread - Add thread role and visibility fields
ALTER TABLE "quote_request_email_threads" ADD COLUMN "threadRole" "ThreadRole" NOT NULL DEFAULT 'TECHNICIAN',
ADD COLUMN "parentThreadId" TEXT,
ADD COLUMN "visibleToCreator" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "takeoverAt" TIMESTAMP(3),
ADD COLUMN "takeoverById" TEXT;

-- CreateTable: UserEmailSyncState
CREATE TABLE "user_email_sync_state" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL,
    "lastEmailId" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'ACTIVE',
    "errorCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_email_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_sync_state_userId_key" ON "user_email_sync_state"("userId");

-- CreateIndex
CREATE INDEX "user_email_sync_state_organizationId_idx" ON "user_email_sync_state"("organizationId");

-- DropIndex: Remove old unique constraint on QuoteRequestEmailThread
DROP INDEX "quote_request_email_threads_quoteRequestId_supplierId_key";

-- CreateIndex: Add new unique constraint with threadRole
CREATE UNIQUE INDEX "quote_request_email_threads_quoteRequestId_supplierId_thre_key" ON "quote_request_email_threads"("quoteRequestId", "supplierId", "threadRole");

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_managerTakeoverId_fkey" FOREIGN KEY ("managerTakeoverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_email_threads" ADD CONSTRAINT "quote_request_email_threads_parentThreadId_fkey" FOREIGN KEY ("parentThreadId") REFERENCES "quote_request_email_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_email_threads" ADD CONSTRAINT "quote_request_email_threads_takeoverById_fkey" FOREIGN KEY ("takeoverById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_email_sync_state" ADD CONSTRAINT "user_email_sync_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_email_sync_state" ADD CONSTRAINT "user_email_sync_state_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
