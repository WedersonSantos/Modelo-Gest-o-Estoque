import { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;
const requestInclude = { items: { include: { product: true } }, orders: { include: { items: true } }, quotes: { include: { supplier: { include: { products: true } }, items: { include: { product: true } } } } } satisfies Prisma.PurchaseRequestInclude;
const quoteInclude = { items: { include: { product: true } }, supplier: { include: { products: true } }, purchaseRequest: { include: { items: true, orders: true } }, order: true } satisfies Prisma.SupplierQuoteInclude;
const orderInclude = { supplier: true, items: { include: { product: true } }, quote: true, receipts: { include: { items: true } } } satisfies Prisma.PurchaseOrderInclude;

export const purchasingRepository = {
  activeProducts: (db: Db, organizationId: string) => db.product.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" } }),
  listRequests: (db: Db, organizationId: string) => db.purchaseRequest.findMany({ where: { organizationId }, include: requestInclude, orderBy: { createdAt: "desc" } }),
  activeRequests: (db: Db, organizationId: string) => db.purchaseRequest.findMany({ where: { organizationId, status: { in: ["OPEN", "QUOTING", "ORDERED"] } }, include: requestInclude, orderBy: { createdAt: "asc" } }),
  findRequest: (db: Db, organizationId: string, id: string) => db.purchaseRequest.findFirst({ where: { id, organizationId }, include: requestInclude }),
  createRequest: (db: Db, data: Prisma.PurchaseRequestUncheckedCreateInput) => db.purchaseRequest.create({ data }),
  createRequestItems: (db: Db, data: Prisma.PurchaseRequestItemCreateManyInput[]) => db.purchaseRequestItem.createMany({ data }),
  updateRequestItem: (db: Db, organizationId: string, purchaseRequestId: string, productId: string, data: Prisma.PurchaseRequestItemUpdateManyMutationInput) => db.purchaseRequestItem.updateMany({ where: { organizationId, purchaseRequestId, productId }, data }),
  deleteExcludedRequestItems: (db: Db, organizationId: string, purchaseRequestId: string, includedProductIds: string[]) => db.purchaseRequestItem.deleteMany({ where: { organizationId, purchaseRequestId, productId: { notIn: includedProductIds } } }),
  updateRequest: (db: Db, organizationId: string, id: string, data: Prisma.PurchaseRequestUpdateManyMutationInput) => db.purchaseRequest.updateMany({ where: { id, organizationId }, data }),
  findSupplier: (db: Db, organizationId: string, id: string) => db.supplier.findFirst({ where: { id, organizationId }, include: { products: true } }),
  listQuotes: (db: Db, organizationId: string) => db.supplierQuote.findMany({ where: { organizationId }, include: quoteInclude, orderBy: { createdAt: "desc" } }),
  findQuote: (db: Db, organizationId: string, id: string) => db.supplierQuote.findFirst({ where: { id, organizationId }, include: quoteInclude }),
  createQuote: (db: Db, data: Prisma.SupplierQuoteUncheckedCreateInput) => db.supplierQuote.create({ data }),
  createQuoteItems: (db: Db, data: Prisma.SupplierQuoteItemCreateManyInput[]) => db.supplierQuoteItem.createMany({ data }),
  updateQuote: (db: Db, organizationId: string, id: string, data: Prisma.SupplierQuoteUpdateManyMutationInput) => db.supplierQuote.updateMany({ where: { id, organizationId }, data }),
  listOrders: (db: Db, organizationId: string) => db.purchaseOrder.findMany({ where: { organizationId }, include: orderInclude, orderBy: { createdAt: "desc" } }),
  findOrder: (db: Db, organizationId: string, id: string) => db.purchaseOrder.findFirst({ where: { id, organizationId }, include: orderInclude }),
  createOrder: (db: Db, data: Prisma.PurchaseOrderUncheckedCreateInput) => db.purchaseOrder.create({ data }),
  createOrderItems: (db: Db, data: Prisma.PurchaseOrderItemCreateManyInput[]) => db.purchaseOrderItem.createMany({ data }),
  updateOrder: (db: Db, organizationId: string, id: string, data: Prisma.PurchaseOrderUpdateManyMutationInput) => db.purchaseOrder.updateMany({ where: { id, organizationId }, data }),
  updateOrderItem: (db: Db, organizationId: string, id: string, data: Prisma.PurchaseOrderItemUpdateManyMutationInput) => db.purchaseOrderItem.updateMany({ where: { id, organizationId }, data }),
  findReceipt: (db: Db, organizationId: string, idempotencyKey: string) => db.goodsReceipt.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } }, include: { items: true } }),
  createReceipt: (db: Db, data: Prisma.GoodsReceiptUncheckedCreateInput) => db.goodsReceipt.create({ data }),
  createReceiptItem: (db: Db, data: Prisma.GoodsReceiptItemUncheckedCreateInput) => db.goodsReceiptItem.create({ data }),
};
