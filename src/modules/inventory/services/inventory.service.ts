import { Prisma } from "@prisma/client";
import { type Actor } from "@/shared/lib/auth";
import { listInventoryCounts } from "../repositories/inventory-count.repository";
import { listProductCategories, listProducts } from "../repositories/product.repository";
import { listConsumptionMovements, listStockMovements } from "../repositories/stock-movement.repository";
import { inventoryReportFilterSchema } from "../schemas/inventory.schema";
import { movementDto, productDto } from "./inventory.dto";

export async function listInventory(actor: Actor) {
  const [products, categories, movements, counts] = await Promise.all([
    listProducts(actor.organizationId),
    listProductCategories(actor.organizationId),
    listStockMovements(actor.organizationId),
    listInventoryCounts(actor.organizationId),
  ]);
  const productData = products.map(productDto);
  return {
    products: productData,
    categories,
    movements: movements.map(movementDto),
    counts,
    alerts: productData.filter((product) => product.active && product.belowMinimum),
  };
}

export async function getStockNeeds(actor: Actor) {
  const products = await listProducts(actor.organizationId);
  return products.map(productDto).filter((product) => product.active && product.belowMinimum
    && new Prisma.Decimal(product.suggestedQuantity).gt(0));
}

export async function getStockMovements(actor: Actor, input: unknown = {}) {
  const filter = inventoryReportFilterSchema.parse(input);
  return (await listStockMovements(actor.organizationId, filter)).map(movementDto);
}

export async function getConsumptionReport(actor: Actor, input: unknown = {}) {
  const filter = inventoryReportFilterSchema.parse(input);
  const movements = await listConsumptionMovements(actor.organizationId, filter);
  const grouped = new Map<string, {
    productId: string;
    name: string;
    unit: string;
    usageContext: string;
    quantity: Prisma.Decimal;
    totalCost: Prisma.Decimal;
    movementCount: number;
  }>();
  for (const movement of movements) {
    const usageContext = movement.usageContext || "RESTAURANT";
    const key = `${movement.productId}:${usageContext}`;
    const entry = grouped.get(key) ?? {
      productId: movement.product.id,
      name: movement.product.name,
      unit: movement.product.unit,
      usageContext,
      quantity: new Prisma.Decimal(0),
      totalCost: new Prisma.Decimal(0),
      movementCount: 0,
    };
    entry.quantity = entry.quantity.plus(movement.quantity);
    entry.totalCost = entry.totalCost.plus(movement.totalCost);
    entry.movementCount += 1;
    grouped.set(key, entry);
  }
  return [...grouped.values()]
    .sort((a, b) => b.totalCost.comparedTo(a.totalCost))
    .map((item) => ({ ...item, quantity: item.quantity.toString(), totalCost: item.totalCost.toString() }));
}
