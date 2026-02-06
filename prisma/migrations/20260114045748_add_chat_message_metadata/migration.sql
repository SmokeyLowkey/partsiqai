-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "chat_pick_list_items" ADD COLUMN     "notes" TEXT;

-- AddForeignKey
ALTER TABLE "chat_pick_list_items" ADD CONSTRAINT "chat_pick_list_items_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
