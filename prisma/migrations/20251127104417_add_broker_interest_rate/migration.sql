-- AlterTable
ALTER TABLE "Broker" ADD COLUMN     "interestRate" DECIMAL(10,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InterestPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "portfolioValue" DECIMAL(20,2) NOT NULL,
    "interestRate" DECIMAL(10,4) NOT NULL,
    "interestAmount" DECIMAL(20,2) NOT NULL,
    "balanceBefore" DECIMAL(20,2) NOT NULL,
    "balanceAfter" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterestPayment_userId_dayNumber_idx" ON "InterestPayment"("userId", "dayNumber");

-- AddForeignKey
ALTER TABLE "InterestPayment" ADD CONSTRAINT "InterestPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestPayment" ADD CONSTRAINT "InterestPayment_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
