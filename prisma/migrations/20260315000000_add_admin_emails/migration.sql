-- CreateTable
CREATE TABLE "admin_emails" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "templateType" TEXT,
    "templateVars" JSONB,
    "senderEmail" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientUserId" TEXT,
    "organizationId" TEXT,
    "sentById" TEXT NOT NULL,
    "resendMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_emails_organizationId_idx" ON "admin_emails"("organizationId");
CREATE INDEX "admin_emails_sentById_idx" ON "admin_emails"("sentById");
CREATE INDEX "admin_emails_createdAt_idx" ON "admin_emails"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_emails" ADD CONSTRAINT "admin_emails_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admin_emails" ADD CONSTRAINT "admin_emails_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_emails" ADD CONSTRAINT "admin_emails_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
