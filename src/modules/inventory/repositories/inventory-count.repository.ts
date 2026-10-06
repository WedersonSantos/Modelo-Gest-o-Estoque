import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";

type Database = Prisma.TransactionClient;

export function findOpenInventoryCount(organizationId: string, db: Database = prisma) {
  return db.inventoryCount.findFirst({ where: { organizationId, status: "OPEN" } });
}

export function listInventoryCounts(organizationId: string, db: Database = prisma) {
  return db.inventoryCount.findMany({
    where: { organizationId },
    include: { _count: { select: { items: true } } },
    orderBy: { startedAt: "desc" },
  });
}

export function findInventoryCount(organizationId: string, id: string, db: Database = prisma) {
  return db.inventoryCount.findFirst({
    where: { organizationId, id },
    include: { items: { include: { product: true }, orderBy: { product: { name: "asc" } } } },
  });
}

export async function lockInventoryCount(db: Database, organizationId: string, id: string) {
  await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "InventoryCount" WHERE "organizationId" = ${organizationId} AND "id" = ${id} FOR UPDATE
  `;
  return findInventoryCount(organizationId, id, db);
}

export async function lockOrganization(db: Database, organizationId: string) {
  await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE
  `;
}

export function insertInventoryCount(db: Database, data: Prisma.InventoryCountUncheckedCreateInput) {
  return db.inventoryCount.create({ data });
}

export function insertInventoryCountItems(db: Database, data: Prisma.InventoryCountItemCreateManyInput[]) {
  return db.inventoryCountItem.createMany({ data });
}

export function updateInventoryCountItem(
  db: Database,
  organizationId: string,
  inventoryCountId: string,
  productId: string,
  data: Prisma.InventoryCountItemUpdateManyMutationInput,
) {
  return db.inventoryCountItem.updateMany({
    where: { organizationId, inventoryCountId, productId },
    data,
  });
}

export function updateInventoryCountFields(
  db: Database,
  organizationId: string,
  id: string,
  data: Prisma.InventoryCountUncheckedUpdateManyInput,
) {
  return db.inventoryCount.updateMany({ where: { organizationId, id }, data });
}
