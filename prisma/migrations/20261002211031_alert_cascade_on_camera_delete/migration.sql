-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_cameraId_fkey";

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
