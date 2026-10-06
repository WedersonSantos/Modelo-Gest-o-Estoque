import { Prisma } from "@prisma/client";
import { DomainError } from "@/shared/lib/errors";

export type DecimalInput = Prisma.Decimal | string;
export type MovementDirection = "IN" | "OUT";

const ExactDecimal = Prisma.Decimal.clone({ precision: 40, rounding: Prisma.Decimal.ROUND_HALF_UP });
const MAX_QUANTITY = new Prisma.Decimal("9999999999.9999");
const MAX_TOTAL_COST = new Prisma.Decimal("999999999999.99");

/** Decimal inputs stay strings from the form to PostgreSQL: no floating-point conversion. */
export function quantity(value: DecimalInput): Prisma.Decimal {
  const result = new ExactDecimal(value);
  if (!result.isFinite() || result.isNegative() || result.gt(MAX_QUANTITY)) {
    throw new DomainError("Quantidade fora do intervalo permitido.");
  }
  if (result.decimalPlaces() > 4) {
    throw new DomainError("Use no máximo quatro casas decimais.");
  }
  return result;
}

export function positiveQuantity(value: DecimalInput): Prisma.Decimal {
  const result = quantity(value);
  if (result.isZero()) throw new DomainError("A quantidade deve ser maior que zero.");
  return result;
}

export function stockAlert(currentStock: DecimalInput, minimumStock: DecimalInput): boolean {
  return quantity(currentStock).lte(quantity(minimumStock));
}

export function suggestedQuantity(currentStock: DecimalInput, idealStock: DecimalInput): Prisma.Decimal {
  return Prisma.Decimal.max(quantity(idealStock).minus(quantity(currentStock)), 0);
}

export function validateStockThresholds(minimumStock: DecimalInput, idealStock: DecimalInput): void {
  if (quantity(idealStock).lt(quantity(minimumStock))) {
    throw new DomainError("O estoque ideal deve ser igual ou maior que o estoque mínimo.");
  }
}

export function stockAfterMovement(
  currentStock: DecimalInput,
  movementQuantity: DecimalInput,
  direction: MovementDirection,
): Prisma.Decimal {
  const current = quantity(currentStock);
  const amount = positiveQuantity(movementQuantity);
  const result = direction === "IN" ? current.plus(amount) : current.minus(amount);
  if (result.isNegative()) throw new DomainError("Estoque insuficiente para esta saída.", 409);
  return quantity(result);
}

export function weightedAverageCost(
  currentStock: DecimalInput,
  averageCost: DecimalInput,
  incomingQuantity: DecimalInput,
  incomingUnitCost: DecimalInput,
): Prisma.Decimal {
  const previousStock = quantity(currentStock);
  const previousCost = quantity(averageCost);
  const received = positiveQuantity(incomingQuantity);
  const receivedCost = quantity(incomingUnitCost);
  const totalStock = stockAfterMovement(previousStock, received, "IN");
  return previousStock.mul(previousCost).plus(received.mul(receivedCost))
    .div(totalStock).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

export function inventoryDifference(systemQuantity: DecimalInput, countedQuantity: DecimalInput): Prisma.Decimal {
  return quantity(countedQuantity).minus(quantity(systemQuantity));
}

export function movementTotalCost(movementQuantity: DecimalInput, unitCost: DecimalInput): Prisma.Decimal {
  const result = positiveQuantity(movementQuantity).mul(quantity(unitCost))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (result.gt(MAX_TOTAL_COST)) throw new DomainError("O valor total excede o limite permitido.");
  return result;
}

/** Detect even a stock round trip (e.g. 10 → 8 → 10) after the counting snapshot. */
export function assertFreshInventorySnapshot(
  systemQuantity: DecimalInput,
  currentStock: DecimalInput,
  snapshotUpdatedAt: Date,
  currentUpdatedAt: Date,
): void {
  if (!quantity(systemQuantity).eq(quantity(currentStock))
    || snapshotUpdatedAt.getTime() !== currentUpdatedAt.getTime()) {
    throw new DomainError("O estoque mudou após a abertura do inventário. Cancele e inicie uma nova contagem.", 409);
  }
}
