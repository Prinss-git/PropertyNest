-- CreateEnum
CREATE TYPE "NearbyStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "NearbyCell" (
    "key" TEXT NOT NULL,
    "status" "NearbyStatus" NOT NULL DEFAULT 'PENDING',
    "places" JSONB NOT NULL DEFAULT '[]',
    "provider" TEXT,
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NearbyCell_pkey" PRIMARY KEY ("key")
);

