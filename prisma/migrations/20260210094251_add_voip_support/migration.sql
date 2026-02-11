/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[emailVerificationToken]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EmailProviderType" AS ENUM ('GMAIL_OAUTH', 'MICROSOFT_OAUTH', 'SMTP');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'BOTH');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('QUOTE_REQUEST', 'FOLLOW_UP', 'NEGOTIATION', 'CONFIRMATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'RINGING', 'ANSWERED', 'IN_PROGRESS', 'VOICEMAIL', 'NO_ANSWER', 'BUSY', 'COMPLETED', 'FAILED', 'CANCELLED', 'HUMAN_ESCALATED');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('QUOTE_RECEIVED', 'PARTIAL_QUOTE', 'CALLBACK_REQUESTED', 'TRANSFER_NEEDED', 'TOO_COMPLEX', 'NOT_INTERESTED', 'WRONG_NUMBER', 'VOICEMAIL_LEFT', 'NO_ANSWER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'SUBSCRIPTION_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'SUBSCRIPTION_CANCELLED';
ALTER TYPE "ActivityType" ADD VALUE 'PAYMENT_SUCCEEDED';
ALTER TYPE "ActivityType" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "ActivityType" ADD VALUE 'INVOICE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'INVOICE_PAID';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "companySize" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "primaryContactPhone" TEXT,
ADD COLUMN     "primaryUseCase" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionEndDate" TIMESTAMP(3),
ADD COLUMN     "subscriptionStartDate" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "quote_requests" ADD COLUMN     "callSuppliersFirst" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierCallPreferences" JSONB;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "callWindowEnd" TEXT,
ADD COLUMN     "callWindowStart" TEXT,
ADD COLUMN     "doNotCall" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredContactMethod" "ContactMethod" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationExpiry" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingSkippedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "message" TEXT,
    "temporaryPassword" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientId" TEXT,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auxiliary_phones" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auxiliary_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_calls" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT,
    "supplierId" TEXT NOT NULL,
    "callDirection" "CallDirection" NOT NULL,
    "callType" "CallType" NOT NULL DEFAULT 'QUOTE_REQUEST',
    "callerId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "vapiCallId" TEXT,
    "recordingUrl" TEXT,
    "graphStateId" TEXT,
    "conversationLog" JSONB,
    "outcome" "CallOutcome",
    "notes" TEXT,
    "nextAction" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "extractedQuotes" JSONB,
    "threadRole" "ThreadRole" NOT NULL DEFAULT 'TECHNICIAN',
    "visibleToCreator" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_email_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerType" "EmailProviderType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailAddress" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastTestedAt" TIMESTAMP(3),
    "testStatus" "TestStatus",
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "configuredBy" TEXT NOT NULL,

    CONSTRAINT "user_email_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "number" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amountDue" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "hostedInvoiceUrl" TEXT,
    "invoicePdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_recipientId_key" ON "invitations"("recipientId");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_organizationId_status_idx" ON "invitations"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_organizationId_email_key" ON "invitations"("organizationId", "email");

-- CreateIndex
CREATE INDEX "auxiliary_phones_supplierId_idx" ON "auxiliary_phones"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_calls_vapiCallId_key" ON "supplier_calls"("vapiCallId");

-- CreateIndex
CREATE INDEX "supplier_calls_quoteRequestId_idx" ON "supplier_calls"("quoteRequestId");

-- CreateIndex
CREATE INDEX "supplier_calls_supplierId_idx" ON "supplier_calls"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_calls_status_idx" ON "supplier_calls"("status");

-- CreateIndex
CREATE INDEX "supplier_calls_nextRetryAt_idx" ON "supplier_calls"("nextRetryAt");

-- CreateIndex
CREATE INDEX "supplier_calls_organizationId_idx" ON "supplier_calls"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_integrations_userId_key" ON "user_email_integrations"("userId");

-- CreateIndex
CREATE INDEX "user_email_integrations_userId_idx" ON "user_email_integrations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "invoices_organizationId_idx" ON "invoices"("organizationId");

-- CreateIndex
CREATE INDEX "invoices_stripeInvoiceId_idx" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_stripePaymentMethodId_key" ON "payment_methods"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "payment_methods_organizationId_idx" ON "payment_methods"("organizationId");

-- CreateIndex
CREATE INDEX "email_messages_threadId_createdAt_idx" ON "email_messages"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_organizationId_status_createdAt_idx" ON "orders"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeSubscriptionId_key" ON "organizations"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "organizations_stripeCustomerId_idx" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerificationToken_key" ON "users"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "users_organizationId_role_idx" ON "users"("organizationId", "role");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auxiliary_phones" ADD CONSTRAINT "auxiliary_phones_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_calls" ADD CONSTRAINT "supplier_calls_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_calls" ADD CONSTRAINT "supplier_calls_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_calls" ADD CONSTRAINT "supplier_calls_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_calls" ADD CONSTRAINT "supplier_calls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_email_integrations" ADD CONSTRAINT "user_email_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_email_integrations" ADD CONSTRAINT "user_email_integrations_configuredBy_fkey" FOREIGN KEY ("configuredBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "quote_request_email_threads_quoteRequestId_supplierId_thre_key" RENAME TO "quote_request_email_threads_quoteRequestId_supplierId_threa_key";

-- RenameIndex
ALTER INDEX "supplier_performance_organizationId_supplierIdentifier_month_ke" RENAME TO "supplier_performance_organizationId_supplierIdentifier_mont_key";
