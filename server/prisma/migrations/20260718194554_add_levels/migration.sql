-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('TUITION', 'ANNUAL', 'OTHER');

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "levelId" TEXT;

-- AlterTable
ALTER TABLE "fee_structures" ADD COLUMN     "feeType" "FeeType" NOT NULL DEFAULT 'TUITION',
ADD COLUMN     "levelId" TEXT;

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "firstName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "levelId" TEXT;

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "levels_tenantId_name_key" ON "levels"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
