-- AlterTable
ALTER TABLE "RouteLeg" ADD COLUMN     "legSubType" TEXT;

-- CreateTable
CREATE TABLE "BusTerminal" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "terminalNm" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusTerminal_terminalId_key" ON "BusTerminal"("terminalId");

-- CreateIndex
CREATE INDEX "BusTerminal_cityCode_idx" ON "BusTerminal"("cityCode");

-- CreateIndex
CREATE INDEX "BusTerminal_terminalNm_idx" ON "BusTerminal"("terminalNm");
