/*
  Warnings:

  - You are about to drop the column `lineName` on the `RouteLeg` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RouteLeg" DROP COLUMN "lineName",
ADD COLUMN     "lineNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
