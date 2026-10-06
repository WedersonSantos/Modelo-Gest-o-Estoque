import { type Prisma, type Product, type StockMovementType } from "@prisma/client";
import { assertRole, type Actor } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { transaction } from "@/shared/lib/prisma";
import { lockProduct, updateProductFields } from "../repositories/product.repository";
import { insertStockMovement } from "../repositories/stock-movement.repository";
import { receiveStockSchema, recordMovementSchema, type ReceiveStockInput } from "../schemas/inventory.schema";
import { movementDto, productDto } from "./inventory.dto";
import { movementTotalCost, positiveQuantity, quantity, stockAfterMovement, weightedAverageCost, type DecimalInput, type MovementDirection } from "./stock.rules";

type StockChange = {
  productId: string;
  type: StockMovementType;
  direction: MovementDirection;
  quantity: DecimalInput;
  unitCost?: DecimalInput;
  usageContext?: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
};

/** Internal coordination point: caller must use the shared serializable transaction. */
export async function applyStockChange(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: StockChange,
  lockedProduct?: Product,
) {
  const product = lockedProduct ?? await lockProduct(tx, actor.organizationId, input.productId);
  if (!product || product.organizationId !== actor.organizationId || product.id !== input.productId) {
    throw new DomainError("Ingrediente não encontrado.", 404);
  }
  if (!product.active) throw new DomainError("Este ingrediente está desativado.", 409);
  const amount = positiveQuantity(input.quantity);
  const stockAfter = stockAfterMovement(product.currentStock, amount, input.direction);
  // Outbound stock is valued at current average cost; a user cannot rewrite its valuation.
  const unitCost = input.direction === "IN" && input.unitCost !== undefined
    ? quantity(input.unitCost) : product.averageCost;
  const averageCost = input.direction === "IN"
    ? weightedAverageCost(product.currentStock, product.averageCost, amount, unitCost)
    : product.averageCost;
  const totalCost = movementTotalCost(amount, unitCost);
  const movement = await insertStockMovement(tx, {
    organizationId: actor.organizationId,
    productId: product.id,
    type: input.type,
    direction: input.direction,
    quantity: amount,
    unitCost,
    totalCost,
    stockBefore: product.currentStock,
    stockAfter,
    referenceType: input.referenceType || null,
    referenceId: input.referenceId || null,
    usageContext: input.usageContext || "RESTAURANT",
    notes: input.notes || null,
    createdBy: actor.userId,
  });
  const updated = await updateProductFields(tx, actor.organizationId, product.id, { currentStock: stockAfter, averageCost });
  if (!updated) throw new DomainError("Ingrediente não encontrado.", 404);
  await audit(tx, actor, "STOCK_MOVEMENT_CREATED", "StockMovement", movement.id, {
    productId: product.id,
    type: movement.type,
    direction: input.direction,
    quantity: amount.toString(),
    stockBefore: product.currentStock.toString(),
    stockAfter: stockAfter.toString(),
    referenceType: input.referenceType || null,
    referenceId: input.referenceId || null,
  });
  return { movement: movementDto(movement), product: productDto(updated) };
}

export async function recordMovement(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN", "OPERATOR"]);
  const data = recordMovementSchema.parse(input);
  const direction = data.type === "OTHER" ? data.direction!
    : data.type === "ADJUSTMENT_IN" ? "IN" : "OUT";
  return transaction((tx) => applyStockChange(tx, actor, { ...data, direction }));
}

/** A purchase receipt can atomically share its transaction with inventory and finance. */
export async function receiveStock(tx: Prisma.TransactionClient, actor: Actor, input: ReceiveStockInput) {
  assertRole(actor, ["OWNER", "ADMIN", "OPERATOR"]);
  const data = receiveStockSchema.parse(input);
  return applyStockChange(tx, actor, { ...data, type: "PURCHASE", direction: "IN" });
}
