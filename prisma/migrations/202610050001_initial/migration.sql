BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'BUYER', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('KG', 'G', 'L', 'ML', 'UNIT', 'PACKAGE', 'BOX');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'INVENTORY_ADJUSTMENT', 'LOSS', 'OTHER');

-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "InventoryCountStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('OPEN', 'QUOTING', 'ORDERED', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SupplierQuoteStatus" AS ENUM ('DRAFT', 'RECEIVED', 'SELECTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "FinancialType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "unit" "Unit" NOT NULL,
    "minimumStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "idealStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "currentStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "direction" "StockDirection" NOT NULL DEFAULT 'IN',
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "stockBefore" DECIMAL(14,4) NOT NULL,
    "stockAfter" DECIMAL(14,4) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "usageContext" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "finishedBy" TEXT,

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inventoryCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQuantity" DECIMAL(14,4) NOT NULL,
    "countedQuantity" DECIMAL(14,4),
    "difference" DECIMAL(14,4),
    "snapshotUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "document" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProduct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lastPrice" DECIMAL(14,4) NOT NULL,
    "minimumOrderQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "lastPurchaseAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SupplierProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPriceHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "price" DECIMAL(14,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "SupplierPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currentStock" DECIMAL(14,4) NOT NULL,
    "minimumStock" DECIMAL(14,4) NOT NULL,
    "idealStock" DECIMAL(14,4) NOT NULL,
    "suggestedQuantity" DECIMAL(14,4) NOT NULL,
    "requestedQuantity" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "SupplierQuoteStatus" NOT NULL DEFAULT 'RECEIVED',
    "validUntil" TIMESTAMP(3),
    "freight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "qualityNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuoteItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierQuoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "SupplierQuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "quoteId" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(14,2) NOT NULL,
    "freight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "selectionReason" TEXT,
    "notes" TEXT,
    "orderedAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "receivedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "freight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialType" NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "FinancialType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "FinancialStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "referenceType" TEXT,
    "referenceId" TEXT,
    "cancellationReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_active_idx" ON "User"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_organizationId_key" ON "User"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_organizationId_key" ON "Session"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_id_organizationId_key" ON "ProductCategory"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_organizationId_name_key" ON "ProductCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Product_organizationId_active_idx" ON "Product"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_organizationId_key" ON "Product"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_name_key" ON "Product"("organizationId", "name");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_productId_createdAt_idx" ON "StockMovement"("organizationId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_type_createdAt_idx" ON "StockMovement"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_id_organizationId_key" ON "StockMovement"("id", "organizationId");

-- CreateIndex
CREATE INDEX "InventoryCount_organizationId_status_idx" ON "InventoryCount"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCount_id_organizationId_key" ON "InventoryCount"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountItem_id_organizationId_key" ON "InventoryCountItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountItem_inventoryCountId_productId_key" ON "InventoryCountItem"("inventoryCountId", "productId");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_active_idx" ON "Supplier"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_id_organizationId_key" ON "Supplier"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_name_key" ON "Supplier"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_id_organizationId_key" ON "SupplierProduct"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProduct_supplierId_productId_key" ON "SupplierProduct"("supplierId", "productId");

-- CreateIndex
CREATE INDEX "SupplierPriceHistory_organizationId_supplierProductId_date_idx" ON "SupplierPriceHistory"("organizationId", "supplierProductId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPriceHistory_id_organizationId_key" ON "SupplierPriceHistory"("id", "organizationId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_organizationId_status_idx" ON "PurchaseRequest"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_id_organizationId_key" ON "PurchaseRequest"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestItem_id_organizationId_key" ON "PurchaseRequestItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestItem_purchaseRequestId_productId_key" ON "PurchaseRequestItem"("purchaseRequestId", "productId");

-- CreateIndex
CREATE INDEX "SupplierQuote_organizationId_purchaseRequestId_idx" ON "SupplierQuote"("organizationId", "purchaseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuote_id_organizationId_key" ON "SupplierQuote"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuoteItem_id_organizationId_key" ON "SupplierQuoteItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuoteItem_supplierQuoteId_productId_key" ON "SupplierQuoteItem"("supplierQuoteId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_quoteId_key" ON "PurchaseOrder"("quoteId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_status_createdAt_idx" ON "PurchaseOrder"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_id_organizationId_key" ON "PurchaseOrder"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_quoteId_organizationId_key" ON "PurchaseOrder"("quoteId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderItem_id_organizationId_key" ON "PurchaseOrderItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderItem_id_organizationId_productId_key" ON "PurchaseOrderItem"("id", "organizationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderItem_purchaseOrderId_productId_key" ON "PurchaseOrderItem"("purchaseOrderId", "productId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_organizationId_purchaseOrderId_idx" ON "GoodsReceipt"("organizationId", "purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_id_organizationId_key" ON "GoodsReceipt"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_organizationId_idempotencyKey_key" ON "GoodsReceipt"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptItem_id_organizationId_key" ON "GoodsReceiptItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptItem_goodsReceiptId_orderItemId_key" ON "GoodsReceiptItem"("goodsReceiptId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_id_organizationId_key" ON "FinancialCategory"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_id_organizationId_type_key" ON "FinancialCategory"("id", "organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_organizationId_name_type_key" ON "FinancialCategory"("organizationId", "name", "type");

-- CreateIndex
CREATE INDEX "FinancialEntry_organizationId_status_dueDate_idx" ON "FinancialEntry"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_organizationId_paidAt_type_idx" ON "FinancialEntry"("organizationId", "paidAt", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_id_organizationId_key" ON "FinancialEntry"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_organizationId_referenceType_referenceId_key" ON "FinancialEntry"("organizationId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_entity_entityId_idx" ON "AuditLog"("organizationId", "entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_id_organizationId_key" ON "AuditLog"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_organizationId_fkey" FOREIGN KEY ("categoryId", "organizationId") REFERENCES "ProductCategory"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdBy_organizationId_fkey" FOREIGN KEY ("createdBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_createdBy_organizationId_fkey" FOREIGN KEY ("createdBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_finishedBy_organizationId_fkey" FOREIGN KEY ("finishedBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_inventoryCountId_organizationId_fkey" FOREIGN KEY ("inventoryCountId", "organizationId") REFERENCES "InventoryCount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_supplierProductId_organizationId_fkey" FOREIGN KEY ("supplierProductId", "organizationId") REFERENCES "SupplierProduct"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_createdBy_organizationId_fkey" FOREIGN KEY ("createdBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_purchaseRequestId_organizationId_fkey" FOREIGN KEY ("purchaseRequestId", "organizationId") REFERENCES "PurchaseRequest"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_purchaseRequestId_organizationId_fkey" FOREIGN KEY ("purchaseRequestId", "organizationId") REFERENCES "PurchaseRequest"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuoteItem" ADD CONSTRAINT "SupplierQuoteItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuoteItem" ADD CONSTRAINT "SupplierQuoteItem_supplierQuoteId_organizationId_fkey" FOREIGN KEY ("supplierQuoteId", "organizationId") REFERENCES "SupplierQuote"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuoteItem" ADD CONSTRAINT "SupplierQuoteItem_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_organizationId_fkey" FOREIGN KEY ("supplierId", "organizationId") REFERENCES "Supplier"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_organizationId_fkey" FOREIGN KEY ("purchaseRequestId", "organizationId") REFERENCES "PurchaseRequest"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_quoteId_organizationId_fkey" FOREIGN KEY ("quoteId", "organizationId") REFERENCES "SupplierQuote"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdBy_organizationId_fkey" FOREIGN KEY ("createdBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_organizationId_fkey" FOREIGN KEY ("purchaseOrderId", "organizationId") REFERENCES "PurchaseOrder"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_organizationId_fkey" FOREIGN KEY ("purchaseOrderId", "organizationId") REFERENCES "PurchaseOrder"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_createdBy_organizationId_fkey" FOREIGN KEY ("createdBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_organizationId_fkey" FOREIGN KEY ("goodsReceiptId", "organizationId") REFERENCES "GoodsReceipt"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_orderItemId_organizationId_productId_fkey" FOREIGN KEY ("orderItemId", "organizationId", "productId") REFERENCES "PurchaseOrderItem"("id", "organizationId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_categoryId_organizationId_type_fkey" FOREIGN KEY ("categoryId", "organizationId", "type") REFERENCES "FinancialCategory"("id", "organizationId", "type") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_createdBy_organizationId_fkey" FOREIGN KEY ("createdBy", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Appended to the initial migration. PostgreSQL enforces these even outside Prisma.
ALTER TABLE "Product" ADD CONSTRAINT "product_stock_limits" CHECK (
  "minimumStock" >= 0 AND "idealStock" >= "minimumStock" AND "currentStock" >= 0 AND "averageCost" >= 0
);
ALTER TABLE "StockMovement" ADD CONSTRAINT "movement_values" CHECK (
  "quantity" > 0 AND "unitCost" >= 0 AND "totalCost" >= 0 AND "stockBefore" >= 0 AND "stockAfter" >= 0
  AND (("direction" = 'IN' AND "stockAfter" = "stockBefore" + "quantity")
    OR ("direction" = 'OUT' AND "stockAfter" = "stockBefore" - "quantity"))
  AND ("type" NOT IN ('PURCHASE', 'ADJUSTMENT_IN') OR "direction" = 'IN')
  AND ("type" NOT IN ('CONSUMPTION', 'ADJUSTMENT_OUT', 'LOSS') OR "direction" = 'OUT')
);
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "inventory_quantities" CHECK (
  "systemQuantity" >= 0 AND ("countedQuantity" IS NULL OR "countedQuantity" >= 0)
  AND ("difference" IS NULL OR "countedQuantity" IS NULL OR "difference" = "countedQuantity" - "systemQuantity")
);
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "supplier_product_values" CHECK (
  "lastPrice" >= 0 AND "minimumOrderQuantity" >= 0 AND "leadTimeDays" >= 0
);
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "supplier_price_positive" CHECK ("price" >= 0);
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "request_quantities" CHECK (
  "currentStock" >= 0 AND "minimumStock" >= 0 AND "idealStock" >= "minimumStock" AND "suggestedQuantity" >= 0 AND "requestedQuantity" > 0
);
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "quote_conditions" CHECK ("freight" >= 0 AND "leadTimeDays" >= 0);
ALTER TABLE "SupplierQuoteItem" ADD CONSTRAINT "quote_item_values" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "totalPrice" >= 0);
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "order_values" CHECK ("total" >= 0 AND "freight" >= 0 AND "freight" <= "total");
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "order_item_values" CHECK (
  "quantity" > 0 AND "unitPrice" >= 0 AND "totalPrice" >= 0 AND "receivedQuantity" >= 0 AND "receivedQuantity" <= "quantity"
);
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "receipt_values" CHECK ("total" >= 0 AND "freight" >= 0 AND "freight" <= "total");
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "receipt_item_values" CHECK ("quantity" > 0 AND "unitCost" >= 0 AND "totalCost" >= 0);
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "financial_amount" CHECK ("amount" > 0);
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "financial_payment_state" CHECK (
  ("status" = 'PAID' AND "paidAt" IS NOT NULL) OR ("status" <> 'PAID' AND "paidAt" IS NULL)
);

CREATE FUNCTION preserve_operational_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical records in % are immutable; create a compensating record instead.', TG_TABLE_NAME USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER stock_movement_immutable BEFORE UPDATE OR DELETE ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION preserve_operational_history();
CREATE TRIGGER supplier_price_immutable BEFORE UPDATE OR DELETE ON "SupplierPriceHistory" FOR EACH ROW EXECUTE FUNCTION preserve_operational_history();
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION preserve_operational_history();
CREATE TRIGGER goods_receipt_immutable BEFORE UPDATE OR DELETE ON "GoodsReceipt" FOR EACH ROW EXECUTE FUNCTION preserve_operational_history();
CREATE TRIGGER goods_receipt_item_immutable BEFORE UPDATE OR DELETE ON "GoodsReceiptItem" FOR EACH ROW EXECUTE FUNCTION preserve_operational_history();

-- Deferred checks permit balance + movement to be written in either order in one transaction.
CREATE FUNCTION assert_stock_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_product text;
  target_organization text;
  recorded_stock numeric;
  ledger_stock numeric;
BEGIN
  IF TG_TABLE_NAME = 'Product' THEN
    target_product := NEW."id";
  ELSE
    target_product := NEW."productId";
  END IF;
  target_organization := NEW."organizationId";
  SELECT "currentStock" INTO recorded_stock FROM "Product" WHERE "id" = target_product AND "organizationId" = target_organization;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(CASE WHEN "direction" = 'IN' THEN "quantity" ELSE -"quantity" END), 0)
    INTO ledger_stock FROM "StockMovement" WHERE "productId" = target_product AND "organizationId" = target_organization;
  IF recorded_stock <> ledger_stock THEN
    RAISE EXCEPTION 'Stock balance does not match the movement ledger for product %.', target_product USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER product_stock_ledger AFTER INSERT OR UPDATE ON "Product"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_stock_ledger();
CREATE CONSTRAINT TRIGGER movement_stock_ledger AFTER INSERT ON "StockMovement"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_stock_ledger();

COMMIT;
