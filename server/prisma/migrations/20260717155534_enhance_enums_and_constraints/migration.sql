-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('TRIMESTER', 'SEMESTER', 'BIMESTER');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('EXAM', 'TEST', 'HOMEWORK', 'ORAL', 'PROJECT');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ERROR');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';

-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_classId_fkey";

-- AlterTable
ALTER TABLE "periods" DROP COLUMN "type",
ADD COLUMN     "type" "PeriodType" NOT NULL DEFAULT 'TRIMESTER';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "students" DROP COLUMN "status",
ADD COLUMN     "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "classId",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "grades" DROP COLUMN "semester",
ADD COLUMN     "academicYearId" TEXT,
DROP COLUMN "evaluationType",
ADD COLUMN     "evaluationType" "EvaluationType" NOT NULL DEFAULT 'EXAM';

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "academicYearId" TEXT,
ADD COLUMN     "classId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "academicYearId" TEXT;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "readAt";

-- AlterTable
ALTER TABLE "sync_jobs" DROP COLUMN "status",
ADD COLUMN     "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_classId_dayOfWeek_startTime_key" ON "timetable_slots"("classId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "attendances_tenantId_classId_idx" ON "attendances"("tenantId", "classId");

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

