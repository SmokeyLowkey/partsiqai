/*
  Warnings:

  - Added the required column `partNumber` to the `order_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_partId_fkey";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "partNumber" TEXT NOT NULL,
ALTER COLUMN "partId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
