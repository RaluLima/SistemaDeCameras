-- CreateEnum
CREATE TYPE "CameraType" AS ENUM ('IP', 'USB', 'ANALOG', 'WIRELESS', 'OTHER');

-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "type" "CameraType" NOT NULL DEFAULT 'IP';

-- CreateTable
CREATE TABLE "CameraGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CameraGroup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CameraGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraGroup" ADD CONSTRAINT "CameraGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
