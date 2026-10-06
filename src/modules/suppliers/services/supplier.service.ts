import { prisma, transaction } from "@/shared/lib/prisma";
import { type Actor, assertRole } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { supplierRepository } from "../repositories/supplier.repository";
import { supplierSchema, updateSupplierSchema } from "../schemas/supplier.schema";

export const listSuppliers = (actor: Actor) => supplierRepository.list(prisma, actor.organizationId);
export async function getSupplier(actor: Actor, id: string) {
  const supplier = await supplierRepository.find(prisma, actor.organizationId, id);
  if (!supplier) throw new DomainError("Fornecedor não encontrado.", 404);
  return supplier;
}

export async function createSupplier(actor: Actor, input: unknown) {
  assertRole(actor, ["BUYER", "ADMIN", "OWNER"]);
  const data = supplierSchema.parse(input);
  return transaction(async (tx) => {
    const supplier = await supplierRepository.create(tx, { ...data, organizationId: actor.organizationId });
    await audit(tx, actor, "CREATE", "Supplier", supplier.id, { name: supplier.name });
    return supplier;
  });
}

export async function updateSupplier(actor: Actor, input: unknown) {
  assertRole(actor, ["BUYER", "ADMIN", "OWNER"]);
  const { id, ...data } = updateSupplierSchema.parse(input);
  return transaction(async (tx) => {
    const supplier = await supplierRepository.find(tx, actor.organizationId, id);
    if (!supplier) throw new DomainError("Fornecedor não encontrado.", 404);
    await supplierRepository.update(tx, actor.organizationId, id, data);
    await audit(tx, actor, "UPDATE", "Supplier", id, { name: data.name, active: data.active });
    return supplierRepository.find(tx, actor.organizationId, id);
  });
}
