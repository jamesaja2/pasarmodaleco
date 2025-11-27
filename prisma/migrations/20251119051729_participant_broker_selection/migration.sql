-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_brokerId_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "brokerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ParticipantCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayPassword" TEXT NOT NULL,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantCredential_userId_key" ON "ParticipantCredential"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantCredential" ADD CONSTRAINT "ParticipantCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
