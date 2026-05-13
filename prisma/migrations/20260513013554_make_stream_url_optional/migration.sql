/*
  Warnings:

  - You are about to drop the column `rtspUrl` on the `Camera` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Camera_rtspUrl_key";

-- AlterTable
ALTER TABLE "Camera" DROP COLUMN "rtspUrl",
ADD COLUMN     "streamUrl" TEXT;
