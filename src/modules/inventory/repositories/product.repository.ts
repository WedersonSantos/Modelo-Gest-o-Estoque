import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";

type Database = Prisma.TransactionClient;

export function listProducts(organizationId: string, db: Database = prisma) {
  return db.product.findMany({
    where: { organizationId },
    include: { category: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export function listActiveProducts(organizationId: string, db: Database = prisma) {
  return db.product.findMany({ where: { organizationId, active: true }, orderBy: { id: "asc" } });
}

export function findProduct(organizationId: string, id: string, db: Database = prisma) {
  return db.product.findFirst({ where: { organizationId, id }, include: { category: true } });
}

export async function lockProduct(db: Database, organizationId: string, id: string) {
  await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Product" WHERE "organizationId" = ${organizationId} AND "id" = ${id} FOR UPDATE
  `;
  return findProduct(organizationId, id, db);
}

export function insertProduct(db: Database, data: Prisma.ProductUncheckedCreateInput) {
  return db.product.create({ data });
}

export async function updateProductFields(
  db: Database,
  organizationId: string,
  id: string,
  data: Prisma.ProductUncheckedUpdateManyInput,
) {
  await db.product.updateMany({ where: { organizationId, id }, data });
  return findProduct(organizationId, id, db);
}

export function findProductCategory(organizationId: string, id: string, db: Database = prisma) {
  return db.productCategory.findFirst({ where: { organizationId, id } });
}

export function listProductCategories(organizationId: string, db: Database = prisma) {
  return db.productCategory.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
}

export function insertProductCategory(db: Database, organizationId: string, name: string) {
  return db.productCategory.create({ data: { organizationId, name } });
}
