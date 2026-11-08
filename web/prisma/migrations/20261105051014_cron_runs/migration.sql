-- CreateTable
CREATE TABLE "CronRun" (
    "name" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3) NOT NULL,
    "lastFinishedAt" TIMESTAMP(3),
    "lastResult" JSONB,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("name")
);

