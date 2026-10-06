import { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;
export const supplierRepository = {
  list: (db: Db, organizationId: string) => db.supplier.findMany({ where: { organizationId }, orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }),
  find: (db: Db, organizationId: string, id: string) => db.supplier.findFirst({ where: { id, organizationId }, include: { products: { include: { product: true, priceHistory: { orderBy: { date: "desc" }, take: 20 } } } } }),
  create: (db: Db, data: Prisma.SupplierUncheckedCreateInput) => db.supplier.create({ data }),
  update: (db: Db, organizationId: string, id: string, data: Prisma.SupplierUpdateManyMutationInput) => db.supplier.updateMany({ where: { id, organizationId }, data }),
  findProduct: (db: Db, organizationId: string, id: string) => db.product.findFirst({ where: { id, organizationId } }),
  findSupplierProduct: (db: Db, organizationId: string, supplierId: string, productId: string) => db.supplierProduct.findFirst({ where: { organizationId, supplierId, productId } }),
  upsertProduct: (db: Db, organizationId: string, supplierId: string, productId: string, data: Prisma.SupplierProductUncheckedUpdateInput, create: Prisma.SupplierProductUncheckedCreateInput) => db.supplierProduct.upsert({ where: { supplierId_productId: { supplierId, productId }, organizationId }, update: data, create }),
  createHistory: (db: Db, data: Prisma.SupplierPriceHistoryUncheckedCreateInput) => db.supplierPriceHistory.create({ data }),
};
