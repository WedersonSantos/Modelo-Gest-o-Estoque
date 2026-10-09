BEGIN;
CREATE TABLE "Customer" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "phone" TEXT, "phoneNormalized" TEXT, "email" TEXT, "birthDate" DATE, "notes" TEXT,
 "active" BOOLEAN NOT NULL DEFAULT true, "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
 "marketingConsentAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Customer_name_check" CHECK (char_length(trim("name")) BETWEEN 2 AND 120),
 CONSTRAINT "Customer_phone_check" CHECK ("phoneNormalized" IS NULL OR "phoneNormalized" ~ '^[0-9]{1,40}$'),
 CONSTRAINT "Customer_consent_check" CHECK (("marketingConsent" AND "marketingConsentAt" IS NOT NULL) OR (NOT "marketingConsent" AND "marketingConsentAt" IS NULL))
);
CREATE TABLE "CustomerAddress" (
 "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "customerId" TEXT NOT NULL,
 "label" TEXT, "street" TEXT NOT NULL, "number" TEXT, "complement" TEXT,
 "neighborhood" TEXT, "city" TEXT NOT NULL, "state" TEXT, "postalCode" TEXT,
 "country" TEXT NOT NULL DEFAULT 'BR', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
CREATE UNIQUE INDEX "Customer_id_organizationId_key" ON "Customer"("id", "organizationId");
CREATE INDEX "Customer_organizationId_active_name_idx" ON "Customer"("organizationId", "active", "name");
-- Phone is intentionally non-unique: family members can share a contact number.
CREATE INDEX "Customer_organizationId_phoneNormalized_idx" ON "Customer"("organizationId", "phoneNormalized");
CREATE INDEX "Customer_organizationId_email_idx" ON "Customer"("organizationId", "email");
CREATE UNIQUE INDEX "CustomerAddress_id_organizationId_key" ON "CustomerAddress"("id", "organizationId");
CREATE INDEX "CustomerAddress_organizationId_customerId_idx" ON "CustomerAddress"("organizationId", "customerId");
CREATE INDEX "Order_organizationId_customerId_createdAt_idx" ON "Order"("organizationId", "customerId", "createdAt");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
