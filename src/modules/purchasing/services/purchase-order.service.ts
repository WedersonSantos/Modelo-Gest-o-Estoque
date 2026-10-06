import { prisma, transaction } from "@/shared/lib/prisma";
import { type Actor, assertRole } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { dec } from "@/shared/lib/money";
import { purchasingRepository } from "../repositories/purchasing.repository";
import { purchaseOrderSchema, purchaseOrderTransitionSchema } from "../schemas/purchasing.schema";
import { validateOrderTransition, quoteIsExpired } from "./purchasing.rules";

export const listPurchaseOrders = (actor: Actor) => purchasingRepository.listOrders(prisma, actor.organizationId);
export async function getPurchaseOrder(actor: Actor, id: string) {
  const order = await purchasingRepository.findOrder(prisma, actor.organizationId, id);
  if (!order) throw new DomainError("Pedido não encontrado.", 404);
  return order;
}

export async function createPurchaseOrder(actor: Actor, input: unknown) {
  assertRole(actor, ["BUYER", "ADMIN", "OWNER"]);
  const data = purchaseOrderSchema.parse(input);
  return transaction(async (tx) => {
    const quote = await purchasingRepository.findQuote(tx, actor.organizationId, data.quoteId);
    if (!quote) throw new DomainError("Cotação não encontrada.", 404);
    if (quote.status !== "RECEIVED" || quote.order) throw new DomainError("A cotação não está disponível para seleção.");
    if (quoteIsExpired(quote.validUntil)) throw new DomainError("A cotação expirou. Registre uma cotação atualizada.");
    if (!quote.supplier.active || quote.items.some((item) => !item.product.active)) throw new DomainError("Fornecedor e produtos devem estar ativos.");
    if (!quote.items.length || quote.items.some((item) => !item.available)) throw new DomainError("Selecione uma cotação que atenda a todos os produtos da lista.");
    if (!["OPEN", "QUOTING"].includes(quote.purchaseRequest.status) || quote.purchaseRequest.orders.some((order) => order.status !== "CANCELED")) throw new DomainError("Esta lista já possui um pedido em andamento.");
    for (const item of quote.items) {
      const condition = quote.supplier.products.find((product) => product.productId === item.productId && product.active);
      if (condition && item.quantity.lt(condition.minimumOrderQuantity)) throw new DomainError(`O pedido mínimo de ${item.product.name} mudou. Solicite outra cotação.`);
    }
    const total = quote.items.reduce((sum, item) => sum.plus(item.totalPrice), dec(quote.freight));
    const order = await purchasingRepository.createOrder(tx, {
      organizationId: actor.organizationId, supplierId: quote.supplierId, purchaseRequestId: quote.purchaseRequestId,
      quoteId: quote.id, total, freight: quote.freight, selectionReason: data.selectionReason, createdBy: actor.userId,
    });
    await purchasingRepository.createOrderItems(tx, quote.items.map((item) => ({
      organizationId: actor.organizationId, purchaseOrderId: order.id, productId: item.productId,
      quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice,
    })));
    await purchasingRepository.updateQuote(tx, actor.organizationId, quote.id, { status: "SELECTED" });
    await purchasingRepository.updateRequest(tx, actor.organizationId, quote.purchaseRequestId, { status: "ORDERED" });
    await audit(tx, actor, "CREATE", "PurchaseOrder", order.id, { quoteId: quote.id, selectionReason: data.selectionReason, total: total.toString() });
    return purchasingRepository.findOrder(tx, actor.organizationId, order.id);
  });
}

export async function transitionPurchaseOrder(actor: Actor, input: unknown) {
  assertRole(actor, ["BUYER", "ADMIN", "OWNER"]);
  const { id, status } = purchaseOrderTransitionSchema.parse(input);
  return transaction(async (tx) => {
    const order = await purchasingRepository.findOrder(tx, actor.organizationId, id);
    if (!order) throw new DomainError("Pedido não encontrado.", 404);
    validateOrderTransition(order.status, status, actor.role, order.receipts.length > 0);
    if (status === "ORDERED" && order.quote && quoteIsExpired(order.quote.validUntil)) throw new DomainError("A cotação expirou antes da realização do pedido.");
    const orderedAt = status === "ORDERED" ? new Date() : undefined;
    const expectedAt = orderedAt ? new Date(orderedAt.getTime() + (order.quote?.leadTimeDays ?? 0) * 86400000) : undefined;
    await purchasingRepository.updateOrder(tx, actor.organizationId, id, { status, orderedAt, expectedAt });
    if (status === "CANCELED") {
      if (order.quoteId) await purchasingRepository.updateQuote(tx, actor.organizationId, order.quoteId, { status: "REJECTED" });
      if (order.purchaseRequestId) await purchasingRepository.updateRequest(tx, actor.organizationId, order.purchaseRequestId, { status: "QUOTING" });
    }
    await audit(tx, actor, status, "PurchaseOrder", id, { previousStatus: order.status });
    return purchasingRepository.findOrder(tx, actor.organizationId, id);
  });
}
