import { Prisma } from "@prisma/client";
import { transaction } from "@/shared/lib/prisma";
import { type Actor, assertRole } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { supplierRepository } from "../repositories/supplier.repository";
import { supplierPriceSchema, type SupplierPriceInput } from "../schemas/supplier.schema";

export async function recordSupplierPrice(tx: Prisma.TransactionClient, actor: Actor, input: SupplierPriceInput, source: "MANUAL" | "QUOTE" | "PURCHASE") {
  const data = supplierPriceSchema.parse(input);
  const supplier = await supplierRepository.find(tx, actor.organizationId, data.supplierId);
  const product = await supplierRepository.findProduct(tx, actor.organizationId, data.productId);
  const existing = await supplierRepository.findSupplierProduct(tx, actor.organizationId, data.supplierId, data.productId);
  if (!supplier || !product) throw new DomainError("Fornecedor ou produto não encontrado nesta organização.", 404);
  if (source !== "PURCHASE" && (!supplier.active || !product.active)) throw new DomainError("Fornecedor e produto devem estar ativos.");
  const price = new Prisma.Decimal(data.price);
  const conditions = source === "MANUAL" || !existing ? {
    minimumOrderQuantity: new Prisma.Decimal(data.minimumOrderQuantity),
    leadTimeDays: data.leadTimeDays,
    paymentTerms: data.paymentTerms,
  } : {};
  const supplierProduct = await supplierRepository.upsertProduct(tx, actor.organizationId, supplier.id, product.id, {
    ...conditions, lastPrice: price, active: true,
    ...(source === "PURCHASE" ? { lastPurchaseAt: new Date() } : {}),
  }, {
    organizationId: actor.organizationId, supplierId: supplier.id, productId: product.id, lastPrice: price,
    minimumOrderQuantity: new Prisma.Decimal(data.minimumOrderQuantity),
    leadTimeDays: data.leadTimeDays, paymentTerms: data.paymentTerms,
    ...(source === "PURCHASE" ? { lastPurchaseAt: new Date() } : {}),
  });
  await supplierRepository.createHistory(tx, { organizationId: actor.organizationId, supplierProductId: supplierProduct.id, price, source, notes: data.notes });
  return supplierProduct;
}

export async function setSupplierPrice(actor: Actor, input: unknown) {
  assertRole(actor, ["BUYER", "ADMIN", "OWNER"]);
  const data = supplierPriceSchema.parse(input);
  return transaction(async (tx) => {
    const record = await recordSupplierPrice(tx, actor, data, "MANUAL");
    await audit(tx, actor, "PRICE_UPDATED", "SupplierProduct", record.id, { price: record.lastPrice.toString() });
    return record;
  });
}
