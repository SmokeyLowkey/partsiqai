-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" TEXT NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "callerName" TEXT,
    "callerCompany" TEXT,
    "reason" TEXT,
    "callbackNumber" TEXT,
    "vapiCallId" TEXT,
    "supplierId" TEXT,
    "organizationId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_vapiCallId_key" ON "inbound_messages"("vapiCallId");
CREATE INDEX "inbound_messages_callerPhone_idx" ON "inbound_messages"("callerPhone");
CREATE INDEX "inbound_messages_organizationId_isRead_idx" ON "inbound_messages"("organizationId", "isRead");
CREATE INDEX "inbound_messages_supplierId_idx" ON "inbound_messages"("supplierId");

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
