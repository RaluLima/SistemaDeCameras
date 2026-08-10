-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "aiMonitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recordingEnabled" BOOLEAN NOT NULL DEFAULT false;
