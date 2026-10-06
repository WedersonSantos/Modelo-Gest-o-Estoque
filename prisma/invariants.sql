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
