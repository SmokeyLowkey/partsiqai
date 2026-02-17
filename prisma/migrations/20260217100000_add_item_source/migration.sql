-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('CATALOG', 'WEB_SEARCH', 'MANUAL');

-- AlterTable: Add source column to chat_pick_list_items
ALTER TABLE "chat_pick_list_items" ADD COLUMN "source" "ItemSource" NOT NULL DEFAULT 'CATALOG';

-- AlterTable: Add source column to quote_request_items
ALTER TABLE "quote_request_items" ADD COLUMN "source" "ItemSource" NOT NULL DEFAULT 'CATALOG';
