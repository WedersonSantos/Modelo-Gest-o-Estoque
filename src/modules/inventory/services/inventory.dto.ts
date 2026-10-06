import { Prisma } from "@prisma/client";
import { stockAlert, suggestedQuantity } from "./stock.rules";

export function productDto<T extends {
  currentStock: Prisma.Decimal;
  minimumStock: Prisma.Decimal;
  idealStock: Prisma.Decimal;
  averageCost: Prisma.Decimal;
}>(product: T) {
  return {
    ...product,
    currentStock: product.currentStock.toString(),
    minimumStock: product.minimumStock.toString(),
    idealStock: product.idealStock.toString(),
    averageCost: product.averageCost.toString(),
    belowMinimum: stockAlert(product.currentStock, product.minimumStock),
    suggestedQuantity: suggestedQuantity(product.currentStock, product.idealStock).toString(),
  };
}

export function movementDto<T extends {
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  stockBefore: Prisma.Decimal;
  stockAfter: Prisma.Decimal;
}>(movement: T) {
  return {
    ...movement,
    quantity: movement.quantity.toString(),
    unitCost: movement.unitCost.toString(),
    totalCost: movement.totalCost.toString(),
    stockBefore: movement.stockBefore.toString(),
    stockAfter: movement.stockAfter.toString(),
  };
}
