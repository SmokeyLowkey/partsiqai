-- AlterTable
ALTER TABLE "orders" ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "completedBy" TEXT;

-- CreateTable
CREATE TABLE "order_analytics" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "totalLeadTimeDays" INTEGER NOT NULL,
    "expectedVsActualDays" INTEGER NOT NULL,
    "onTimeDelivery" BOOLEAN NOT NULL,
    "itemsFulfilled" INTEGER NOT NULL,
    "itemsOrdered" INTEGER NOT NULL,
    "fulfillmentRate" DECIMAL(5,2) NOT NULL,
    "actualSavings" DECIMAL(10,2) NOT NULL,
    "manualCost" DECIMAL(10,2) NOT NULL,
    "platformCost" DECIMAL(10,2) NOT NULL,
    "savingsPercent" DECIMAL(5,2) NOT NULL,
    "supplierIdentifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_performance" (
    "id" TEXT NOT NULL,
    "supplierIdentifier" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "ordersDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalLeadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "onTimeDeliveries" INTEGER NOT NULL DEFAULT 0,
    "avgLeadTimeDays" DECIMAL(8,2),
    "onTimeRate" DECIMAL(5,2),
    "totalSavings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "avgSavings" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_analytics_orderId_key" ON "order_analytics"("orderId");

-- CreateIndex
CREATE INDEX "order_analytics_organizationId_idx" ON "order_analytics"("organizationId");

-- CreateIndex
CREATE INDEX "order_analytics_organizationId_completedAt_idx" ON "order_analytics"("organizationId", "completedAt");

-- CreateIndex
CREATE INDEX "order_analytics_supplierIdentifier_idx" ON "order_analytics"("supplierIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_performance_organizationId_supplierIdentifier_month_key" ON "supplier_performance"("organizationId", "supplierIdentifier", "month", "year");

-- CreateIndex
CREATE INDEX "supplier_performance_organizationId_idx" ON "supplier_performance"("organizationId");

-- CreateIndex
CREATE INDEX "supplier_performance_supplierIdentifier_idx" ON "supplier_performance"("supplierIdentifier");

-- AddForeignKey
ALTER TABLE "order_analytics" ADD CONSTRAINT "order_analytics_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
