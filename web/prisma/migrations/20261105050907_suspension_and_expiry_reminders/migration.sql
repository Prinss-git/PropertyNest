-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "expiryReminderAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "statusReason" TEXT;

