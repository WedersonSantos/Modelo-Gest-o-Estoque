import { Prisma } from "@prisma/client";
import { prisma, transaction } from "@/shared/lib/prisma";
import { type Actor, assertRole } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { purchasingRepository } from "../repositories/purchasing.repository";
import { suggestedPurchaseQuantity } from "./purchasing.rules";
import { updatePurchaseRequestSchema } from "../schemas/purchasing.schema";

export const listPurchaseRequests = (actor: Actor) => purchasingRepository.listRequests(prisma, actor.organizationId);
export async function getPurchaseRequest(actor: Actor, id: string) {
  const request = await purchasingRepository.findRequest(prisma, actor.organizationId, id);
  if (!request) throw new DomainError("Lista de compras não encontrada.", 404);
  return request;
}

export async function listPurchaseNeeds(actor: Actor) {
  const [products, requests] = await Promise.all([
    purchasingRepository.activeProducts(prisma, actor.organizationId),
    purchasingRepository.activeRequests(prisma, actor.organizationId),
  ]);
  const reserved = new Set(requests.flatMap((request) => request.items.map((item) => item.productId)));
  return products.filter((product) => product.currentStock.lte(product.minimumStock)).map((product) => ({
    ...product, suggestedQuantity: suggestedPurchaseQuantity(product.currentStock, product.minimumStock, product.idealStock),
    alreadyRequested: reserved.has(product.id),
  }));
}

export async function generatePurchaseRequest(actor: Actor) {
  assertRole(actor, ["BUYER", "ADMIN", "OWNER"]);
  return transaction(async (tx) => {
    const products = await purchasingRepository.activeProducts(tx, actor.organizationId);
    const requests = await purchasingRepository.activeRequests(tx, actor.organizationId);
    const reserved = new Set(requests.flatMap((request) => request.items.map((item) => item.productId)));
    const needs = products.map((product) => ({ product, suggested: suggestedPurchaseQuantity(product.currentStock, product.minimumStock, product.idealStock) }))
      .filter(({ product, suggested }) => suggested.gt(0) && !reserved.has(product.id));
    const open = requests.find((request) => request.status === "OPEN");
    if (!needs.length) {
      if (open || requests[0]) return open ?? requests[0];
      throw new DomainError("Não há produtos com necessidade de reposição.");
    }
    const request = open ?? await purchasingRepository.createRequest(tx, { organizationId: actor.organizationId, createdBy: actor.userId, title: "Reposição de estoque" });
    await purchasingRepository.createRequestItems(tx, needs.map(({ product, suggested }) => ({
      organizationId: actor.organizationId, purchaseRequestId: request.id, productId: product.id,
      currentStock: product.currentStock, minimumStock: product.minimumStock, idealStock: product.idealStock,
      suggestedQuantity: suggested, requestedQuantity: suggested,
    })));
    await audit(tx, actor, "GENERATED", "PurchaseRequest", request.id, { products: needs.map(({ product }) => product.id) });
    return purchasingRepository.findRequest(tx, actor.organizationId, request.id);
  });
}

export async function updatePurchaseRequest(actor: Actor, input: unknown) {
  assertRole(actor, ["BUYER", "ADMIN", "OWNER"]);
  const data = updatePurchaseRequestSchema.parse(input);
  return transaction(async (tx) => {
    const request = await purchasingRepository.findRequest(tx, actor.organizationId, data.id);
    if (!request) throw new DomainError("Lista de compras não encontrada.", 404);
    if (request.status !== "OPEN" || request.quotes.length > 0 || request.orders.length > 0) throw new DomainError("Ajuste as quantidades antes de registrar cotações. Listas já cotadas preservam o histórico original.");
    if (data.items.some((item) => !request.items.some((line) => line.productId === item.productId))) throw new DomainError("Informe somente os produtos desta lista.");
    const omittedProducts = request.items.filter((item) => !data.items.some((included) => included.productId === item.productId)).map((item) => item.productId);
    await purchasingRepository.deleteExcludedRequestItems(tx, actor.organizationId, request.id, data.items.map((item) => item.productId));
    for (const item of data.items) {
      await purchasingRepository.updateRequestItem(tx, actor.organizationId, request.id, item.productId, { requestedQuantity: new Prisma.Decimal(item.requestedQuantity) });
    }
    await audit(tx, actor, "QUANTITIES_UPDATED", "PurchaseRequest", request.id, { items: data.items, removedProducts: omittedProducts });
    return purchasingRepository.findRequest(tx, actor.organizationId, request.id);
  });
}
