-- CreateEnum
CREATE TYPE "MaintenanceParsingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScheduleApprovalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION');

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pdfS3Key" TEXT NOT NULL,
    "pdfFileName" TEXT NOT NULL,
    "parsingStatus" "MaintenanceParsingStatus" NOT NULL DEFAULT 'PENDING',
    "parsedAt" TIMESTAMP(3),
    "parsingError" TEXT,
    "oem" TEXT,
    "extractionConfidence" INTEGER,
    "approvalStatus" "ScheduleApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_intervals" (
    "id" TEXT NOT NULL,
    "maintenanceScheduleId" TEXT NOT NULL,
    "intervalHours" INTEGER NOT NULL,
    "intervalType" "IntervalType" NOT NULL DEFAULT 'HOURS',
    "serviceName" TEXT NOT NULL,
    "serviceDescription" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_interval_parts" (
    "id" TEXT NOT NULL,
    "maintenanceIntervalId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partDescription" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "matchedPartId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_interval_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_schedules_vehicleId_key" ON "maintenance_schedules"("vehicleId");

-- CreateIndex
CREATE INDEX "maintenance_schedules_organizationId_idx" ON "maintenance_schedules"("organizationId");

-- CreateIndex
CREATE INDEX "maintenance_schedules_approvalStatus_idx" ON "maintenance_schedules"("approvalStatus");

-- CreateIndex
CREATE INDEX "maintenance_schedules_organizationId_approvalStatus_idx" ON "maintenance_schedules"("organizationId", "approvalStatus");

-- CreateIndex
CREATE INDEX "maintenance_intervals_maintenanceScheduleId_idx" ON "maintenance_intervals"("maintenanceScheduleId");

-- CreateIndex
CREATE INDEX "maintenance_intervals_intervalHours_idx" ON "maintenance_intervals"("intervalHours");

-- CreateIndex
CREATE INDEX "maintenance_interval_parts_maintenanceIntervalId_idx" ON "maintenance_interval_parts"("maintenanceIntervalId");

-- CreateIndex
CREATE INDEX "maintenance_interval_parts_partNumber_idx" ON "maintenance_interval_parts"("partNumber");

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_intervals" ADD CONSTRAINT "maintenance_intervals_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_interval_parts" ADD CONSTRAINT "maintenance_interval_parts_maintenanceIntervalId_fkey" FOREIGN KEY ("maintenanceIntervalId") REFERENCES "maintenance_intervals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_interval_parts" ADD CONSTRAINT "maintenance_interval_parts_matchedPartId_fkey" FOREIGN KEY ("matchedPartId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
