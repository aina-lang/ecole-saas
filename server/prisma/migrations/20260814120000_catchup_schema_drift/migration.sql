-- CreateEnum
CREATE TYPE "HalfDay" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "PromotionDecision" AS ENUM ('ADMIS', 'REDOUBLANT', 'EXCLU', 'A_DELIBERER');

-- CreateEnum
CREATE TYPE "ReinscriptionStatus" AS ENUM ('PRE_INSCRIT', 'BLOQUE', 'INSCRIT_ACTIF');

-- AlterEnum
ALTER TYPE "TenantStatus" ADD VALUE 'PAST_DUE';

-- DropIndex
DROP INDEX "attendances_studentId_date_key";

-- DropIndex
DROP INDEX "attendances_tenantId_classId_idx";

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "halfDay" "HalfDay",
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "teacherId" TEXT,
ADD COLUMN     "timetableSlotId" TEXT;

-- AlterTable
ALTER TABLE "levels" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "nextLevelId" TEXT;

-- AlterTable
ALTER TABLE "teacher_contracts" ADD COLUMN     "cnapsNumber" TEXT,
ADD COLUMN     "ostieNumber" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "couchDbPasswordEnc" TEXT,
ADD COLUMN     "couchDbUser" TEXT,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "student_enrollments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "classId" TEXT,
    "promotionDecision" "PromotionDecision",
    "reinscriptionStatus" "ReinscriptionStatus" NOT NULL DEFAULT 'PRE_INSCRIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_enrollments_tenantId_academicYearId_idx" ON "student_enrollments"("tenantId", "academicYearId");

-- CreateIndex
CREATE INDEX "student_enrollments_tenantId_levelId_idx" ON "student_enrollments"("tenantId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "student_enrollments_studentId_academicYearId_key" ON "student_enrollments"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "attendances_tenantId_classId_date_idx" ON "attendances"("tenantId", "classId", "date");

-- CreateIndex
CREATE INDEX "attendances_tenantId_date_idx" ON "attendances"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_studentId_date_halfDay_key" ON "attendances"("studentId", "date", "halfDay");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_studentId_date_timetableSlotId_key" ON "attendances"("studentId", "date", "timetableSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_stripeCustomerId_key" ON "tenants"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_stripeSubscriptionId_key" ON "tenants"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_nextLevelId_fkey" FOREIGN KEY ("nextLevelId") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "timetable_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
