import { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;
export const financeRepository = {
  list: (db: Db, organizationId: string, filter: Prisma.FinancialEntryWhereInput = {}) => db.financialEntry.findMany({ where: { ...filter, organizationId }, include: { category: true }, orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }] }),
  find: (db: Db, organizationId: string, id: string) => db.financialEntry.findFirst({ where: { id, organizationId }, include: { category: true } }),
  create: (db: Db, data: Prisma.FinancialEntryUncheckedCreateInput) => db.financialEntry.create({ data }),
  update: (db: Db, organizationId: string, id: string, data: Prisma.FinancialEntryUpdateManyMutationInput) => db.financialEntry.updateMany({ where: { id, organizationId }, data }),
  listCategories: (db: Db, organizationId: string) => db.financialCategory.findMany({ where: { organizationId }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
  findCategory: (db: Db, organizationId: string, id: string) => db.financialCategory.findFirst({ where: { id, organizationId } }),
  createCategory: (db: Db, data: Prisma.FinancialCategoryUncheckedCreateInput) => db.financialCategory.create({ data }),
  purchaseCategory: (db: Db, organizationId: string) => db.financialCategory.upsert({ where: { organizationId_name_type: { organizationId, name: "Compras de ingredientes", type: "EXPENSE" } }, update: {}, create: { organizationId, name: "Compras de ingredientes", type: "EXPENSE" } }),
};
