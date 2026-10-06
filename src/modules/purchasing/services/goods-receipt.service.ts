import { Prisma } from "@prisma/client";
import { prisma, transaction } from "@/shared/lib/prisma";
import { type Actor, assertRole } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { dec } from "@/shared/lib/money";
import { receiveStock } from "@/modules/inventory";
import { recordSupplierPrice } from "@/modules/suppliers";
import { createPurchasePayable } from "@/modules/finance";
import { purchasingRepository } from "../repositories/purchasing.repository";
import { receivePurchaseOrderSchema } from "../schemas/purchasing.schema";
import { allocateReceiptFreight, validateReceiptQuantity, receiptLineValue } from "./purchasing.rules";

type Receipt = NonNullable<Awaited<ReturnType<typeof purchasingRepository.findReceipt>>>;
type ReceiptInput = ReturnType<typeof receivePurchaseOrderSchema.parse>;
function validateReplay(receipt: Receipt, input: ReceiptInput) {
  if (receipt.purchaseOrderId !== input.id || receipt.items.length !== input.items.length
    || receipt.items.some((item) => !input.items.some((incoming) => incoming.orderItemId === item.orderItemId && item.quantity.eq(incoming.quantity)))) {
    throw new DomainError("A chave de recebimento já foi utilizada com outros dados. Atualize a página e tente novamente.", 409);
  }
  return receipt;
}

export async function receivePurchaseOrder(actor: Actor, input: unknown) {
  assertRole(actor, ["OPERATOR", "ADMIN", "OWNER"]);
  const data = receivePurchaseOrderSchema.parse(input);
  try {
    return await transaction(async (tx) => {
      const prior = await purchasingRepository.findReceipt(tx, actor.organizationId, data.idempotencyKey);
      if (prior) return validateReplay(prior, data);
      const order = await purchasingRepository.findOrder(tx, actor.organizationId, data.id);
      if (!order) throw new DomainError("Pedido não encontrado.", 404);
      if (!["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status)) throw new DomainError("Somente pedidos realizados podem ser recebidos.");
      const lines = data.items.map((item) => {
        const orderItem = order.items.find((line) => line.id === item.orderItemId);
        if (!orderItem) throw new DomainError("O item recebido não pertence a este pedido.");
        const quantity = validateReceiptQuantity(orderItem.quantity, orderItem.receivedQuantity, item.quantity);
        // Cumulative rounding makes partial deliveries add up exactly to the ordered line value.
        const totalCost = receiptLineValue(orderItem.receivedQuantity, quantity, orderItem.unitPrice);
        return { orderItem, quantity, totalCost };
      }).sort((first, second) => first.orderItem.productId.localeCompare(second.orderItem.productId));
      const complete = order.items.every((item) => item.receivedQuantity.plus(lines.find((line) => line.orderItem.id === item.id)?.quantity ?? 0).eq(item.quantity));
      const goodsTotal = lines.reduce((sum, line) => sum.plus(line.totalCost), dec(0));
      const orderGoods = order.items.reduce((sum, item) => sum.plus(item.totalPrice), dec(0));
      const previousFreight = order.receipts.reduce((sum, receipt) => sum.plus(receipt.freight), dec(0));
      const freight = allocateReceiptFreight({ receiptGoods: goodsTotal, orderGoods, freight: order.freight, previouslyAllocatedFreight: previousFreight, complete });
      const total = goodsTotal.plus(freight);
      const receivedAt = new Date();
      const receipt = await purchasingRepository.createReceipt(tx, {
        organizationId: actor.organizationId, purchaseOrderId: order.id, idempotencyKey: data.idempotencyKey,
        total, freight, receivedAt, createdBy: actor.userId,
      });
      for (const line of lines) {
        await purchasingRepository.createReceiptItem(tx, {
          organizationId: actor.organizationId, goodsReceiptId: receipt.id, orderItemId: line.orderItem.id,
          productId: line.orderItem.productId, quantity: line.quantity, unitCost: line.orderItem.unitPrice, totalCost: line.totalCost,
        });
        await receiveStock(tx, actor, {
          productId: line.orderItem.productId, quantity: line.quantity.toString(), unitCost: line.orderItem.unitPrice.toString(),
          referenceType: "GOODS_RECEIPT", referenceId: receipt.id, notes: `Recebimento do pedido ${order.id}`,
        });
        await purchasingRepository.updateOrderItem(tx, actor.organizationId, line.orderItem.id, { receivedQuantity: { increment: line.quantity } });
        await recordSupplierPrice(tx, actor, {
          supplierId: order.supplierId, productId: line.orderItem.productId, price: line.orderItem.unitPrice.toString(),
          notes: `Recebimento ${receipt.id} do pedido ${order.id}`,
        }, "PURCHASE");
      }
      await purchasingRepository.updateOrder(tx, actor.organizationId, order.id, { status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED", receivedAt: complete ? receivedAt : null });
      if (complete && order.purchaseRequestId) await purchasingRepository.updateRequest(tx, actor.organizationId, order.purchaseRequestId, { status: "CLOSED" });
      await createPurchasePayable(tx, actor, { receiptId: receipt.id, supplierName: order.supplier.name, amount: total, receivedAt });
      await audit(tx, actor, "RECEIVED", "PurchaseOrder", order.id, { receiptId: receipt.id, total: total.toString(), complete });
      const result = await purchasingRepository.findReceipt(tx, actor.organizationId, data.idempotencyKey);
      if (!result) throw new DomainError("Falha ao registrar o recebimento.", 500);
      return result;
    });
  } catch (error) {
    // A concurrent retry with the same key rolls its entire transaction back.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const prior = await purchasingRepository.findReceipt(prisma, actor.organizationId, data.idempotencyKey);
      if (prior) return validateReplay(prior, data);
    }
    throw error;
  }
}
