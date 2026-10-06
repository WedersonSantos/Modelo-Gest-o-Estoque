import { Prisma } from "@prisma/client";
import { prisma, transaction } from "@/shared/lib/prisma";
import { type Actor, assertRole } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { dec } from "@/shared/lib/money";
import { recordSupplierPrice } from "@/modules/suppliers";
import { purchasingRepository } from "../repositories/purchasing.repository";
import { quoteSchema } from "../schemas/purchasing.schema";
import { quoteIsExpired } from "./purchasing.rules";

export const listQuotes = (actor: Actor) => purchasingRepository.listQuotes(prisma, actor.organizationId);
export async function getQuote(actor: Actor, id: string) {
  const quote = await purchasingRepository.findQuote(prisma, actor.organizationId, id);
  if (!quote) throw new DomainError("Cotação não encontrada.", 404);
  return quote;
}

export async function createQuote(actor: Actor, input: unknown) {
  assertRole(actor, ["BUYER", "ADMIN", "OWNER"]);
  const data = quoteSchema.parse(input);
  if (quoteIsExpired(data.validUntil)) throw new DomainError("A validade da cotação já expirou.");
  return transaction(async (tx) => {
    const request = await purchasingRepository.findRequest(tx, actor.organizationId, data.purchaseRequestId);
    const supplier = await purchasingRepository.findSupplier(tx, actor.organizationId, data.supplierId);
    if (!request || !supplier) throw new DomainError("Lista ou fornecedor não encontrado nesta organização.", 404);
    if (!supplier.active) throw new DomainError("O fornecedor deve estar ativo.");
    if (!["OPEN", "QUOTING"].includes(request.status)) throw new DomainError("Esta lista não está aberta para cotações.");
    if (data.items.length !== request.items.length) throw new DomainError("A cotação deve informar todos os produtos da lista, inclusive os indisponíveis.");
    for (const item of data.items) {
      const requested = request.items.find((requestItem) => requestItem.productId === item.productId);
      if (!requested) throw new DomainError("Produto não pertence à lista de compras.");
      if (!requested.product.active) throw new DomainError("A lista contém um produto inativo.");
      const condition = supplier.products.find((product) => product.productId === item.productId && product.active);
      if (item.available && new Prisma.Decimal(item.quantity).lt(requested.requestedQuantity)) throw new DomainError(`A quantidade de ${requested.product.name} deve atender à quantidade solicitada.`);
      if (item.available && condition && new Prisma.Decimal(item.quantity).lt(condition.minimumOrderQuantity)) throw new DomainError(`A quantidade de ${requested.product.name} está abaixo do pedido mínimo do fornecedor.`);
    }
    const quote = await purchasingRepository.createQuote(tx, {
      organizationId: actor.organizationId, purchaseRequestId: request.id, supplierId: supplier.id,
      status: "RECEIVED", validUntil: data.validUntil, freight: new Prisma.Decimal(data.freight),
      leadTimeDays: data.leadTimeDays, paymentTerms: data.paymentTerms, qualityNotes: data.qualityNotes, notes: data.notes,
    });
    await purchasingRepository.createQuoteItems(tx, data.items.map((item) => ({
      organizationId: actor.organizationId, supplierQuoteId: quote.id, productId: item.productId,
      quantity: new Prisma.Decimal(item.quantity), unitPrice: new Prisma.Decimal(item.unitPrice),
      totalPrice: dec(item.quantity).times(item.unitPrice).toDecimalPlaces(2),
      available: item.available, notes: item.notes,
    })));
    for (const item of data.items.filter((line) => line.available)) {
      await recordSupplierPrice(tx, actor, {
        supplierId: supplier.id, productId: item.productId, price: item.unitPrice,
        leadTimeDays: data.leadTimeDays, paymentTerms: data.paymentTerms ?? undefined,
        notes: `Cotação ${quote.id}`,
      }, "QUOTE");
    }
    await purchasingRepository.updateRequest(tx, actor.organizationId, request.id, { status: "QUOTING" });
    await audit(tx, actor, "CREATE", "SupplierQuote", quote.id, { supplierId: supplier.id, purchaseRequestId: request.id });
    return purchasingRepository.findQuote(tx, actor.organizationId, quote.id);
  });
}

export async function compareQuotes(actor: Actor, purchaseRequestId: string) {
  const request = await purchasingRepository.findRequest(prisma, actor.organizationId, purchaseRequestId);
  if (!request) throw new DomainError("Lista não encontrada.", 404);
  return request.quotes.map((quote) => ({
    ...quote,
    goodsTotal: quote.items.reduce((sum, item) => item.available ? sum.plus(item.totalPrice) : sum, dec(0)),
    total: quote.items.reduce((sum, item) => item.available ? sum.plus(item.totalPrice) : sum, dec(quote.freight)),
    expired: quoteIsExpired(quote.validUntil),
  }));
}
