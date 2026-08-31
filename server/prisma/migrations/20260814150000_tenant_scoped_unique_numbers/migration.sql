-- DropIndex
DROP INDEX "students_registrationNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenantId_receiptNumber_key" ON "payments"("tenantId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "students_tenantId_registrationNumber_key" ON "students"("tenantId", "registrationNumber");
