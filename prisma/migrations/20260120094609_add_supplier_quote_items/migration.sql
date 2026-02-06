-- CreateTable
CREATE TABLE "supplier_quote_items" (
    "id" TEXT NOT NULL,
    "quoteRequestItemId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "availability" "ItemAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "leadTimeDays" INTEGER,
    "supplierPartNumber" TEXT,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "extractedFromEmailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_quote_items_quoteRequestItemId_idx" ON "supplier_quote_items"("quoteRequestItemId");

-- CreateIndex
CREATE INDEX "supplier_quote_items_supplierId_idx" ON "supplier_quote_items"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quote_items_quoteRequestItemId_supplierId_key" ON "supplier_quote_items"("quoteRequestItemId", "supplierId");

-- AddForeignKey
ALTER TABLE "supplier_quote_items" ADD CONSTRAINT "supplier_quote_items_quoteRequestItemId_fkey" FOREIGN KEY ("quoteRequestItemId") REFERENCES "quote_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quote_items" ADD CONSTRAINT "supplier_quote_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quote_items" ADD CONSTRAINT "supplier_quote_items_extractedFromEmailId_fkey" FOREIGN KEY ("extractedFromEmailId") REFERENCES "email_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
