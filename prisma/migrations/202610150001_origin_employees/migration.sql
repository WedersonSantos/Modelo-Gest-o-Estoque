BEGIN;
-- CreateEnum
CREATE TYPE "ProductOriginType" AS ENUM ('NATIONAL', 'IMPORTED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "averageLeadTimeDays" INTEGER,
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "originNotes" TEXT,
ADD COLUMN     "originType" "ProductOriginType" NOT NULL DEFAULT 'NATIONAL',
ADD COLUMN     "purchaseCurrency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "supplierCountry" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "country" TEXT;

-- CreateTable
CREATE TABLE "JobRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "jobRoleId" TEXT,
    "userId" TEXT,
    "department" TEXT,
    "responsibilities" TEXT,
    "hiredAt" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_id_organizationId_key" ON "JobRole"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_organizationId_name_key" ON "JobRole"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_organizationId_active_name_idx" ON "Employee"("organizationId", "active", "name");

-- CreateIndex
CREATE INDEX "Employee_organizationId_jobRoleId_idx" ON "Employee"("organizationId", "jobRoleId");

-- CreateIndex
CREATE INDEX "Employee_organizationId_department_idx" ON "Employee"("organizationId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_id_organizationId_key" ON "Employee"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_organizationId_key" ON "Employee"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Product_organizationId_originType_idx" ON "Product"("organizationId", "originType");

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobRoleId_organizationId_fkey" FOREIGN KEY ("jobRoleId", "organizationId") REFERENCES "JobRole"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_name_check" CHECK (char_length(trim("name")) BETWEEN 2 AND 120);
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_name_check" CHECK (char_length(trim("name")) BETWEEN 2 AND 100);
ALTER TABLE "Product" ADD CONSTRAINT "Product_averageLeadTimeDays_check" CHECK ("averageLeadTimeDays" IS NULL OR "averageLeadTimeDays" BETWEEN 0 AND 3650);
ALTER TABLE "Product" ADD CONSTRAINT "Product_purchaseCurrency_check" CHECK ("purchaseCurrency" ~ '^[A-Z]{3}$');
COMMIT;