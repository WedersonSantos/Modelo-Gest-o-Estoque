export { createProduct, updateProduct, getProduct, createProductCategory, listProductCategories } from "./services/product.service";
export { recordMovement, receiveStock } from "./services/stock-movement.service";
export { createInventoryCount, finishInventoryCount, cancelInventoryCount, getInventoryCount, listInventoryCounts } from "./services/inventory-count.service";
export { listInventory, getStockNeeds, getStockMovements, getConsumptionReport } from "./services/inventory.service";
export { stockAlert, suggestedQuantity, stockAfterMovement, weightedAverageCost, inventoryDifference, movementTotalCost } from "./services/stock.rules";
export { createProductSchema, updateProductSchema, recordMovementSchema, createInventoryCountSchema, finishInventoryCountSchema } from "./schemas/inventory.schema";
export type { CreateProductInput, UpdateProductInput, RecordMovementInput, ReceiveStockInput, CreateInventoryCountInput, FinishInventoryCountInput, InventoryReportFilter } from "./schemas/inventory.schema";
