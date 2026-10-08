-- CreateEnum
CREATE TYPE "CustomerOrderStatus" AS ENUM ('DRAFT', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('TABLE', 'TAKEAWAY', 'DELIVERY');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'KITCHEN';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "nextOrderNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "OrderType" NOT NULL,
    "tableName" TEXT,
    "customerName" TEXT,
    "notes" TEXT,
    "status" "CustomerOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(14,2) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentToKitchenAt" TIMESTAMP(3),
    "preparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accessKey" TEXT,
    "source" TEXT NOT NULL,
    "model" TEXT,
    "number" TEXT,
    "series" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "data" JSONB NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierFiscalMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mappingKey" TEXT NOT NULL,
    "supplierProductCode" TEXT,
    "gtin" TEXT,
    "fiscalDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierFiscalMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_id_organizationId_key" ON "MenuItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_organizationId_name_key" ON "MenuItem"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Order_organizationId_status_createdAt_idx" ON "Order"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_id_organizationId_key" ON "Order"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_organizationId_number_key" ON "Order"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_id_organizationId_key" ON "OrderItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_purchaseOrderId_key" ON "FiscalDocument"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_goodsReceiptId_key" ON "FiscalDocument"("goodsReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_id_organizationId_key" ON "FiscalDocument"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_organizationId_accessKey_key" ON "FiscalDocument"("organizationId", "accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_purchaseOrderId_organizationId_key" ON "FiscalDocument"("purchaseOrderId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_goodsReceiptId_organizationId_key" ON "FiscalDocument"("goodsReceiptId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierFiscalMapping_organizationId_supplierId_mappingKey_key" ON "SupplierFiscalMapping"("organizationId", "supplierId", "mappingKey");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdBy_organizationId_fkey" FOREIGN KEY ("createdBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "Order"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_organizationId_fkey" FOREIGN KEY ("menuItemId", "organizationId") REFERENCES "MenuItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_purchaseOrderId_organizationId_fkey" FOREIGN KEY ("purchaseOrderId", "organizationId") REFERENCES "PurchaseOrder"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_goodsReceiptId_organizationId_fkey" FOREIGN KEY ("goodsReceiptId", "organizationId") REFERENCES "GoodsReceipt"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_createdBy_organizationId_fkey" FOREIGN KEY ("createdBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFiscalMapping" ADD CONSTRAINT "SupplierFiscalMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFiscalMapping" ADD CONSTRAINT "SupplierFiscalMapping_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFiscalMapping" ADD CONSTRAINT "SupplierFiscalMapping_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MenuItem" ADD CONSTRAINT "menu_price_positive" CHECK ("price" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "customer_order_values" CHECK ("number" > 0 AND "total" > 0 AND ("type" <> 'TABLE' OR length(trim("tableName")) > 0 AND "tableName" IS NOT NULL));
ALTER TABLE "OrderItem" ADD CONSTRAINT "customer_order_item_values" CHECK ("quantity" > 0 AND "unitPrice" > 0 AND "totalPrice" = round("quantity" * "unitPrice", 2));
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "fiscal_values" CHECK ("total" > 0 AND ("accessKey" IS NULL OR "accessKey" ~ '^[0-9]{44}$'));
ALTER TABLE "Order" ADD CONSTRAINT "customer_order_timestamps" CHECK (
 ("status" <> 'SENT_TO_KITCHEN' OR "sentToKitchenAt" IS NOT NULL) AND
 ("status" <> 'PREPARING' OR "sentToKitchenAt" IS NOT NULL AND "preparingAt" IS NOT NULL) AND
 ("status" <> 'READY' OR "sentToKitchenAt" IS NOT NULL AND "preparingAt" IS NOT NULL AND "readyAt" IS NOT NULL) AND
 ("status" <> 'COMPLETED' OR "sentToKitchenAt" IS NOT NULL AND "preparingAt" IS NOT NULL AND "readyAt" IS NOT NULL AND "completedAt" IS NOT NULL) AND
 ("status" <> 'CANCELED' OR "canceledAt" IS NOT NULL AND length(trim("cancellationReason")) >= 3)
);
CREATE TRIGGER fiscal_document_immutable BEFORE UPDATE OR DELETE ON "FiscalDocument" FOR EACH ROW EXECUTE FUNCTION preserve_operational_history();
CREATE TRIGGER order_item_immutable BEFORE UPDATE OR DELETE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION preserve_operational_history();
