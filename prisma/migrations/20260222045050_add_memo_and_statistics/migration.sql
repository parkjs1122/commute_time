-- AlterTable
ALTER TABLE "SavedRoute" ADD COLUMN     "memo" TEXT;

-- CreateTable
CREATE TABLE "ETARecord" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "totalETA" INTEGER NOT NULL,
    "waitTime" INTEGER NOT NULL,
    "travelTime" INTEGER NOT NULL,
    "isEstimate" BOOLEAN NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ETARecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ETARecord_routeId_idx" ON "ETARecord"("routeId");

-- CreateIndex
CREATE INDEX "ETARecord_recordedAt_idx" ON "ETARecord"("recordedAt");

-- AddForeignKey
ALTER TABLE "ETARecord" ADD CONSTRAINT "ETARecord_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "SavedRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
