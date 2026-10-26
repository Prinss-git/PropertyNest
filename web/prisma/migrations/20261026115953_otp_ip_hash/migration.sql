-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "ipHash" TEXT;

-- CreateIndex
CREATE INDEX "OtpCode_ipHash_createdAt_idx" ON "OtpCode"("ipHash", "createdAt");
