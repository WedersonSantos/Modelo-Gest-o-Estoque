import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";

type Database = Prisma.TransactionClient;
export type MovementFilter = {
  from?: Date;
  to?: Date;
  productId?: string;
  usageContext?: string;
};

export function insertStockMovement(db: Database, data: Prisma.StockMovementUncheckedCreateInput) {
  return db.stockMovement.create({ data });
}

export async function hasStockMovement(organizationId: string, productId: string, db: Database = prisma) {
  return Boolean(await db.stockMovement.findFirst({ where: { organizationId, productId }, select: { id: true } }));
}

export function listStockMovements(organizationId: string, filter: MovementFilter = {}, db: Database = prisma) {
  return db.stockMovement.findMany({
    where: {
      organizationId,
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.usageContext ? { usageContext: filter.usageContext } : {}),
      ...(filter.from || filter.to ? { createdAt: { gte: filter.from, lte: filter.to } } : {}),
    },
    include: { product: { select: { id: true, name: true, unit: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export function listConsumptionMovements(organizationId: string, filter: MovementFilter = {}, db: Database = prisma) {
  return db.stockMovement.findMany({
    where: {
      organizationId,
      type: "CONSUMPTION",
      direction: "OUT",
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.usageContext ? { usageContext: filter.usageContext } : {}),
      ...(filter.from || filter.to ? { createdAt: { gte: filter.from, lte: filter.to } } : {}),
    },
    include: { product: { select: { id: true, name: true, unit: true } } },
    orderBy: { createdAt: "desc" },
  });
}
