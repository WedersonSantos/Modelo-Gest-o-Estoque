import { Prisma } from "@prisma/client";
import { DomainError } from "@/shared/lib/errors";
import type { Actor } from "@/shared/lib/auth";
import { dec } from "@/shared/lib/money";
import { businessDate } from "@/shared/lib/dates";

export const suggestedPurchaseQuantity = (current: Prisma.Decimal.Value, minimum: Prisma.Decimal.Value, ideal: Prisma.Decimal.Value) => {
  const stock = dec(current);
  if (stock.gt(minimum)) return new Prisma.Decimal(0);
  const suggestion = dec(ideal).minus(stock);
  return suggestion.gt(0) ? suggestion : dec(0);
};

type OrderStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELED";
export function validateOrderTransition(current: OrderStatus, next: OrderStatus, role: Actor["role"], hasReceipts: boolean) {
  const administrative = role === "ADMIN" || role === "OWNER";
  const buyer = administrative || role === "BUYER";
  if (next === "CANCELED") {
    if (!administrative) throw new DomainError("Apenas administradores podem cancelar pedidos.", 403);
    if (hasReceipts || current === "RECEIVED" || current === "CANCELED") throw new DomainError("Pedidos com recebimentos ou já cancelados não podem ser cancelados.");
    return;
  }
  const permitted = (current === "DRAFT" && next === "PENDING_APPROVAL" && buyer)
    || (current === "PENDING_APPROVAL" && next === "APPROVED" && administrative)
    || (current === "APPROVED" && next === "ORDERED" && buyer);
  if (!permitted) throw new DomainError("Transição de pedido não permitida para seu perfil ou estado atual.", 403);
}

export function validateReceiptQuantity(ordered: Prisma.Decimal.Value, previouslyReceived: Prisma.Decimal.Value, incoming: Prisma.Decimal.Value) {
  const quantity = dec(incoming);
  if (!quantity.isFinite() || quantity.lte(0)) throw new DomainError("O recebimento deve ter quantidade positiva.");
  if (dec(previouslyReceived).plus(quantity).gt(ordered)) throw new DomainError("A quantidade recebida excede o saldo do pedido.");
  return quantity;
}

export function receiptLineValue(previouslyReceived: Prisma.Decimal.Value, incoming: Prisma.Decimal.Value, unitPrice: Prisma.Decimal.Value) {
  const previous = dec(previouslyReceived);
  return previous.plus(incoming).times(unitPrice).toDecimalPlaces(2).minus(previous.times(unitPrice).toDecimalPlaces(2));
}

/** A validity day is inclusive through the restaurant's local day (São Paulo). */
export function quoteIsExpired(validUntil: Date | null | undefined, now = new Date()) {
  if (!validUntil) return false;
  const deadline = new Date(`${businessDate(validUntil)}T23:59:59.999-03:00`);
  return deadline < now;
}

export function allocateReceiptFreight(input: { receiptGoods: Prisma.Decimal.Value; orderGoods: Prisma.Decimal.Value; freight: Prisma.Decimal.Value; previouslyAllocatedFreight: Prisma.Decimal.Value; complete: boolean }) {
  const remaining = dec(input.freight).minus(input.previouslyAllocatedFreight);
  if (input.complete) return remaining;
  const orderGoods = dec(input.orderGoods);
  if (orderGoods.isZero()) return new Prisma.Decimal(0);
  const proportional = dec(input.freight).times(input.receiptGoods).dividedBy(orderGoods).toDecimalPlaces(2);
  return proportional.lt(remaining) ? proportional : remaining;
}
