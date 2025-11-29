-- AlterTable
ALTER TABLE "DayControl" ADD COLUMN     "isPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "remainingMs" INTEGER;
