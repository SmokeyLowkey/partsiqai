-- AlterTable
ALTER TABLE "chat_conversations" ADD COLUMN     "vehicleId" TEXT;

-- CreateIndex
CREATE INDEX "chat_conversations_vehicleId_idx" ON "chat_conversations"("vehicleId");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
