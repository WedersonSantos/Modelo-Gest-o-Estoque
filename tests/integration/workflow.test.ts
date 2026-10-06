import "./setup";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Actor } from "@/shared/types/actor";

let db: PrismaClient;
let inventory: typeof import("@/modules/inventory");
let purchasing: typeof import("@/modules/purchasing");
let suppliers: typeof import("@/modules/suppliers");
let finance: typeof import("@/modules/finance");
let settings: typeof import("@/modules/settings");
const runId = randomUUID();
let owner: Actor;
let foreignOwner: Actor;
let buyer: Actor;
let operator: Actor;
let viewer: Actor;
let productId: string;
let supplierId: string;
let orderId: string;
let payableId: string;
let foreignProductId: string;
let foreignSupplierId: string;
let foreignOrderItemId: string;

function required<T>(value: T | null | undefined): T {
  if (!value) throw new Error("A operação deveria retornar um registro.");
  return value;
}

beforeAll(async () => {
  // Import only after selecting the isolated test database. These are real services, with no mocks.
  const modules = await Promise.all([
    import("@/shared/lib/prisma"), import("@/modules/inventory"), import("@/modules/purchasing"),
    import("@/modules/suppliers"), import("@/modules/finance"), import("@/modules/settings"),
  ]);
  [inventory, purchasing, suppliers, finance, settings] = modules.slice(1) as [
    typeof inventory, typeof purchasing, typeof suppliers, typeof finance, typeof settings,
  ];
  db = modules[0].prisma;
  await db.$queryRaw`SELECT 1`;
  const user = await settings.registerOrganization({
    organizationName: `Integração ${runId}`, name: "Proprietário de teste", email: `owner-${runId}@example.test`, password: "TesteSeguro123!",
  });
  owner = { userId: user.id, organizationId: user.organizationId, role: user.role };
  const foreign = await settings.registerOrganization({
    organizationName: `Isolamento ${runId}`, name: "Outro proprietário", email: `foreign-${runId}@example.test`, password: "TesteSeguro123!",
  });
  foreignOwner = { userId: foreign.id, organizationId: foreign.organizationId, role: foreign.role };
  for (const role of ["BUYER", "OPERATOR", "VIEWER"] as const) {
    const created = await settings.createUser(owner, {
      name: `Usuário ${role}`, email: `${role.toLowerCase()}-${runId}@example.test`, password: "TesteSeguro123!", role,
    });
    const actor = { userId: created.id, organizationId: owner.organizationId, role };
    if (role === "BUYER") buyer = actor;
    if (role === "OPERATOR") operator = actor;
    if (role === "VIEWER") viewer = actor;
  }
  const foreignProduct = await inventory.createProduct(foreignOwner, { name: "Ingrediente externo", unit: "KG", minimumStock: "0", idealStock: "0" });
  foreignProductId = foreignProduct.id;
  const foreignSupplier = await suppliers.createSupplier(foreignOwner, { name: "Fornecedor externo" });
  foreignSupplierId = foreignSupplier.id;
  // A minimal fixture makes the submitted foreign order item real, rather than an arbitrary ID.
  const foreignOrder = await db.purchaseOrder.create({ data: {
    organizationId: foreignOwner.organizationId, supplierId: foreignSupplierId, createdBy: foreignOwner.userId,
    total: "2", status: "ORDERED",
  } });
  const foreignOrderItem = await db.purchaseOrderItem.create({ data: {
    organizationId: foreignOwner.organizationId, purchaseOrderId: foreignOrder.id,
    productId: foreignProductId, quantity: "2", unitPrice: "1", totalPrice: "2",
  } });
  foreignOrderItemId = foreignOrderItem.id;
}, 60_000);

// Append-only histories are intentionally retained in the test database under unique tenants.
afterAll(async () => { if (db) await db.$disconnect(); });

describe("fluxo operacional real em PostgreSQL", () => {
  it("faz inventário, consumo, pesquisa, aprovação, recebimento parcial e financeiro", async () => {
    const product = await inventory.createProduct(owner, { name: "Carne bovina", unit: "KG", minimumStock: "8", idealStock: "15" });
    productId = product.id;
    expect(product.currentStock).toBe("0");
    const count = await inventory.createInventoryCount(operator, { notes: "Inventário inicial de integração" });
    await inventory.finishInventoryCount(operator, { id: count.id, items: [{ productId, countedQuantity: "10" }] });
    expect((await inventory.getProduct(viewer, productId)).currentStock).toBe("10");
    await inventory.recordMovement(operator, { productId, type: "CONSUMPTION", quantity: "7", usageContext: "EVENT", notes: "Evento fictício" });
    const stock = await inventory.getProduct(viewer, productId);
    expect(stock.currentStock).toBe("3");
    expect(stock.belowMinimum).toBe(true);
    expect(stock.suggestedQuantity).toBe("12");
    expect((await inventory.getConsumptionReport(viewer, { usageContext: "EVENT" }))[0].quantity).toBe("7");
    expect(await inventory.getConsumptionReport(viewer, { usageContext: "RESTAURANT" })).toHaveLength(0);
    const needs = await purchasing.listPurchaseNeeds(buyer);
    expect(required(needs.find((item) => item.id === productId)).suggestedQuantity.toString()).toBe("12");
    const request = required(await purchasing.generatePurchaseRequest(buyer));
    const repeatedRequest = required(await purchasing.generatePurchaseRequest(buyer));
    expect(repeatedRequest.id).toBe(request.id);
    expect(repeatedRequest.items).toHaveLength(1);

    const economical = await suppliers.createSupplier(buyer, { name: "Fornecedor Econômico" });
    const reliable = await suppliers.createSupplier(buyer, { name: "Fornecedor Pontual" });
    supplierId = reliable.id;
    await suppliers.setSupplierPrice(buyer, { supplierId, productId, price: "23", minimumOrderQuantity: "5", leadTimeDays: 2 });
    await suppliers.setSupplierPrice(buyer, { supplierId, productId, price: "25", minimumOrderQuantity: "5", leadTimeDays: 2 });
    const validUntil = new Date(Date.now() + 7 * 86_400_000);
    const cheaperQuote = required(await purchasing.createQuote(buyer, {
      purchaseRequestId: request.id, supplierId: economical.id, validUntil, freight: "30", leadTimeDays: 5,
      qualityNotes: "Fornecedor sem histórico", items: [{ productId, quantity: "12", unitPrice: "24", available: true }],
    }));
    const selectedQuote = required(await purchasing.createQuote(buyer, {
      purchaseRequestId: request.id, supplierId, validUntil, freight: "12", leadTimeDays: 1,
      paymentTerms: "Pagamento em 7 dias", qualityNotes: "Qualidade conhecida e entrega mais rápida",
      items: [{ productId, quantity: "12", unitPrice: "26", available: true }],
    }));
    const comparison = await purchasing.compareQuotes(viewer, request.id);
    expect(comparison).toHaveLength(2);
    expect(required(comparison.find((quote) => quote.id === cheaperQuote.id)).total.toString()).toBe("318");
    expect(required(comparison.find((quote) => quote.id === selectedQuote.id)).total.toString()).toBe("324");
    expect(await purchasing.listPurchaseOrders(viewer)).toHaveLength(0);
    const order = required(await purchasing.createPurchaseOrder(buyer, {
      quoteId: selectedQuote.id, selectionReason: "Entrega mais rápida e qualidade conhecida para o evento.",
    }));
    orderId = order.id;
    expect(order.supplierId).toBe(supplierId);
    expect(order.status).toBe("DRAFT");
    expect(order.total.toString()).toBe("324");
    await purchasing.transitionPurchaseOrder(buyer, { id: orderId, status: "PENDING_APPROVAL" });
    await expect(purchasing.transitionPurchaseOrder(buyer, { id: orderId, status: "APPROVED" })).rejects.toMatchObject({ status: 403 });
    await purchasing.transitionPurchaseOrder(owner, { id: orderId, status: "APPROVED" });
    await purchasing.transitionPurchaseOrder(buyer, { id: orderId, status: "ORDERED" });
    const partialInput = { id: orderId, idempotencyKey: `${runId}-partial`, items: [{ orderItemId: order.items[0].id, quantity: "5" }] };
    const [partial, concurrentReplay] = await Promise.all([
      purchasing.receivePurchaseOrder(operator, partialInput), purchasing.receivePurchaseOrder(operator, partialInput),
    ]);
    expect(concurrentReplay.id).toBe(partial.id);
    expect(partial.total.toString()).toBe("135");
    expect((await purchasing.getPurchaseOrder(viewer, orderId)).status).toBe("PARTIALLY_RECEIVED");
    expect((await inventory.getProduct(viewer, productId)).currentStock).toBe("8");
    expect((await inventory.getProduct(viewer, productId)).averageCost).toBe("16.25");
    const beforeInvalid = {
      movements: await db.stockMovement.count({ where: { organizationId: owner.organizationId } }),
      receipts: await db.goodsReceipt.count({ where: { organizationId: owner.organizationId } }),
      entries: await db.financialEntry.count({ where: { organizationId: owner.organizationId } }),
    };
    await expect(purchasing.receivePurchaseOrder(operator, {
      id: orderId, idempotencyKey: `${runId}-foreign-item`, items: [
        { orderItemId: order.items[0].id, quantity: "1" }, { orderItemId: foreignOrderItemId, quantity: "1" },
      ],
    })).rejects.toThrow("não pertence a este pedido");
    expect((await inventory.getProduct(viewer, productId)).currentStock).toBe("8");
    expect(await db.stockMovement.count({ where: { organizationId: owner.organizationId } })).toBe(beforeInvalid.movements);
    expect(await db.goodsReceipt.count({ where: { organizationId: owner.organizationId } })).toBe(beforeInvalid.receipts);
    expect(await db.financialEntry.count({ where: { organizationId: owner.organizationId } })).toBe(beforeInvalid.entries);
    await expect(purchasing.receivePurchaseOrder(operator, { ...partialInput, items: [{ orderItemId: order.items[0].id, quantity: "4" }] }))
      .rejects.toMatchObject({ status: 409 });
    await expect(purchasing.receivePurchaseOrder(operator, { id: orderId, idempotencyKey: `${runId}-excess`, items: [{ orderItemId: order.items[0].id, quantity: "8" }] }))
      .rejects.toThrow("excede o saldo");
    const final = await purchasing.receivePurchaseOrder(operator, {
      id: orderId, idempotencyKey: `${runId}-final`, items: [{ orderItemId: order.items[0].id, quantity: "7" }],
    });
    expect(final.total.toString()).toBe("189");
    const receivedOrder = await purchasing.getPurchaseOrder(viewer, orderId);
    expect(receivedOrder.status).toBe("RECEIVED");
    expect(receivedOrder.items[0].receivedQuantity.toString()).toBe("12");
    expect(receivedOrder.receipts).toHaveLength(2);
    expect((await inventory.getProduct(viewer, productId)).currentStock).toBe("15");
    expect((await inventory.getProduct(viewer, productId)).averageCost).toBe("20.8");
    expect((await purchasing.getPurchaseRequest(viewer, request.id)).status).toBe("CLOSED");
    expect((await purchasing.listPurchaseNeeds(viewer)).find((item) => item.id === productId)).toBeUndefined();
    expect((await purchasing.receivePurchaseOrder(operator, partialInput)).id).toBe(partial.id);

    const entries = await finance.listFinancialEntries(viewer);
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.status === "PENDING" && entry.referenceType === "GOODS_RECEIPT")).toBe(true);
    expect(entries.reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0)).toString()).toBe("324");
    payableId = entries[0].id;
    let summary = await finance.financialSummary(viewer);
    expect(summary.purchases.toString()).toBe("324");
    expect(summary.accountsPayable.toString()).toBe("324");
    expect(summary.expenses.toString()).toBe("0");
    await finance.payFinancialEntry(owner, { id: payableId });
    summary = await finance.financialSummary(viewer);
    expect(summary.expenses.toString()).toBe(entries[0].amount.toString());
    expect(summary.accountsPayable.toString()).toBe(new Prisma.Decimal(324).minus(entries[0].amount).toString());
    const relation = required(await db.supplierProduct.findFirst({ where: { organizationId: owner.organizationId, supplierId, productId } }));
    const histories = await db.supplierPriceHistory.findMany({ where: { organizationId: owner.organizationId, supplierProductId: relation.id }, orderBy: { date: "asc" } });
    expect(histories).toHaveLength(5);
    expect(histories.map((history) => history.price.toString())).toEqual(["23", "25", "26", "26", "26"]);
    expect(histories.filter((history) => history.source === "PURCHASE")).toHaveLength(2);
    expect(relation.lastPurchaseAt).not.toBeNull();
    const ledger = await db.stockMovement.findMany({ where: { organizationId: owner.organizationId, productId } });
    expect(ledger).toHaveLength(4);
    expect(ledger.reduce((sum, movement) => movement.direction === "IN" ? sum.plus(movement.quantity) : sum.minus(movement.quantity), new Prisma.Decimal(0)).toString()).toBe("15");
  }, 60_000);

  it("isola organizações, aplica perfis e mantém um recebimento inválido sem efeitos", async () => {
    await expect(inventory.getProduct(foreignOwner, productId)).rejects.toMatchObject({ status: 404 });
    await expect(inventory.recordMovement(foreignOwner, { productId, type: "CONSUMPTION", quantity: "1" })).rejects.toMatchObject({ status: 404 });
    await expect(suppliers.getSupplier(foreignOwner, supplierId)).rejects.toMatchObject({ status: 404 });
    await expect(purchasing.getPurchaseOrder(foreignOwner, orderId)).rejects.toMatchObject({ status: 404 });
    await expect(finance.payFinancialEntry(foreignOwner, { id: payableId })).rejects.toMatchObject({ status: 404 });
    await expect(suppliers.setSupplierPrice(buyer, { supplierId: foreignSupplierId, productId, price: "1" })).rejects.toMatchObject({ status: 404 });
    await expect(inventory.recordMovement(viewer, { productId, type: "CONSUMPTION", quantity: "1" })).rejects.toMatchObject({ status: 403 });
    await expect(purchasing.generatePurchaseRequest(viewer)).rejects.toMatchObject({ status: 403 });
    await expect(finance.payFinancialEntry(viewer, { id: payableId })).rejects.toMatchObject({ status: 403 });
    const foreignCategory = required(await db.productCategory.findFirst({ where: { organizationId: foreignOwner.organizationId } }));
    await expect(inventory.createProduct(owner, { name: "Categoria externa", unit: "KG", minimumStock: "0", idealStock: "0", categoryId: foreignCategory.id }))
      .rejects.toMatchObject({ status: 404 });
    expect((await inventory.listInventory(foreignOwner)).products.map((product) => product.id)).toEqual([foreignProductId]);
    expect(await finance.listFinancialEntries(foreignOwner)).toHaveLength(0);
    await expect(db.supplierProduct.create({ data: {
      organizationId: owner.organizationId, supplierId: foreignSupplierId, productId, lastPrice: "1",
    } })).rejects.toThrow();

    const before = {
      product: await inventory.getProduct(owner, productId),
      receipts: await db.goodsReceipt.count({ where: { organizationId: owner.organizationId } }),
      movements: await db.stockMovement.count({ where: { organizationId: owner.organizationId } }),
      entries: await db.financialEntry.count({ where: { organizationId: owner.organizationId } }),
    };
    await expect(purchasing.receivePurchaseOrder(operator, {
      id: orderId, idempotencyKey: `${runId}-invalid-finalized`, items: [{ orderItemId: foreignOrderItemId, quantity: "1" }],
    })).rejects.toThrow();
    expect((await inventory.getProduct(owner, productId)).currentStock).toBe(before.product.currentStock);
    expect(await db.goodsReceipt.count({ where: { organizationId: owner.organizationId } })).toBe(before.receipts);
    expect(await db.stockMovement.count({ where: { organizationId: owner.organizationId } })).toBe(before.movements);
    expect(await db.financialEntry.count({ where: { organizationId: owner.organizationId } })).toBe(before.entries);
  });

  it("reverte recebimento inteiro quando uma falha ocorre após a primeira entrada", async () => {
    const products = [
      await inventory.createProduct(owner, { name: "Recebimento atômico A", unit: "KG", minimumStock: "1", idealStock: "2" }),
      await inventory.createProduct(owner, { name: "Recebimento atômico B", unit: "KG", minimumStock: "1", idealStock: "2" }),
    ].sort((a, b) => a.id.localeCompare(b.id));
    // The receiving service acquires product locks by ID; deactivate its second line deliberately.
    const [first, second] = products;
    const request = required(await purchasing.generatePurchaseRequest(buyer));
    const quote = required(await purchasing.createQuote(buyer, {
      purchaseRequestId: request.id, supplierId, items: request.items.map((item) => ({
        productId: item.productId, quantity: item.requestedQuantity.toString(), unitPrice: "2", available: true,
      })),
    }));
    const order = required(await purchasing.createPurchaseOrder(buyer, { quoteId: quote.id, selectionReason: "Pedido para verificar atomicidade." }));
    await purchasing.transitionPurchaseOrder(buyer, { id: order.id, status: "PENDING_APPROVAL" });
    await purchasing.transitionPurchaseOrder(owner, { id: order.id, status: "APPROVED" });
    await purchasing.transitionPurchaseOrder(buyer, { id: order.id, status: "ORDERED" });
    await inventory.updateProduct(owner, { id: second.id, name: second.name, unit: "KG", minimumStock: "1", idealStock: "2", active: false });
    const before = {
      receipts: await db.goodsReceipt.count({ where: { organizationId: owner.organizationId } }),
      entries: await db.financialEntry.count({ where: { organizationId: owner.organizationId } }),
      prices: await db.supplierPriceHistory.count({ where: { organizationId: owner.organizationId } }),
      audits: await db.auditLog.count({ where: { organizationId: owner.organizationId } }),
    };
    const firstLine = required(order.items.find((item) => item.productId === first.id));
    const secondLine = required(order.items.find((item) => item.productId === second.id));
    const idempotencyKey = `${runId}-rolled-back`;
    await expect(purchasing.receivePurchaseOrder(operator, { id: order.id, idempotencyKey, items: [
      { orderItemId: firstLine.id, quantity: "2" }, { orderItemId: secondLine.id, quantity: "2" },
    ] })).rejects.toThrow("desativado");
    expect((await inventory.getProduct(viewer, first.id)).currentStock).toBe("0");
    expect(await db.stockMovement.count({ where: { organizationId: owner.organizationId, productId: first.id } })).toBe(0);
    expect(await db.goodsReceipt.count({ where: { organizationId: owner.organizationId } })).toBe(before.receipts);
    expect(await db.financialEntry.count({ where: { organizationId: owner.organizationId } })).toBe(before.entries);
    expect(await db.supplierPriceHistory.count({ where: { organizationId: owner.organizationId } })).toBe(before.prices);
    expect(await db.auditLog.count({ where: { organizationId: owner.organizationId } })).toBe(before.audits);
    const unchangedOrder = await purchasing.getPurchaseOrder(viewer, order.id);
    expect(unchangedOrder.status).toBe("ORDERED");
    expect(unchangedOrder.items.every((item) => item.receivedQuantity.isZero())).toBe(true);
    expect(await db.goodsReceipt.findFirst({ where: { organizationId: owner.organizationId, idempotencyKey } })).toBeNull();
    await inventory.updateProduct(owner, { id: second.id, name: second.name, unit: "KG", minimumStock: "1", idealStock: "2", active: true });
    await purchasing.transitionPurchaseOrder(owner, { id: order.id, status: "CANCELED" });
  });

  it("separa produtos em listas por fornecedor sem duplicar a necessidade reservada", async () => {
    const first = await inventory.createProduct(owner, { name: "Reposição separada A", unit: "KG", minimumStock: "1", idealStock: "2" });
    const second = await inventory.createProduct(owner, { name: "Reposição separada B", unit: "KG", minimumStock: "1", idealStock: "2" });
    const firstSupplier = await suppliers.createSupplier(buyer, { name: "Fornecedor da lista A" });
    const secondSupplier = await suppliers.createSupplier(buyer, { name: "Fornecedor da lista B" });
    const combined = required(await purchasing.generatePurchaseRequest(buyer));
    expect(combined.items.map((item) => item.productId).sort()).toEqual([first.id, second.id].sort());
    const selected = required(await purchasing.updatePurchaseRequest(buyer, {
      id: combined.id, items: [{ productId: first.id, requestedQuantity: "2" }],
    }));
    expect(selected.items.map((item) => item.productId)).toEqual([first.id]);
    let needs = await purchasing.listPurchaseNeeds(buyer);
    expect(required(needs.find((item) => item.id === first.id)).alreadyRequested).toBe(true);
    expect(required(needs.find((item) => item.id === second.id)).alreadyRequested).toBe(false);
    const firstQuote = required(await purchasing.createQuote(buyer, {
      purchaseRequestId: selected.id, supplierId: firstSupplier.id,
      items: [{ productId: first.id, quantity: "2", unitPrice: "3", available: true }],
    }));
    await expect(purchasing.updatePurchaseRequest(buyer, { id: selected.id, items: [{ productId: first.id, requestedQuantity: "1" }] }))
      .rejects.toThrow("antes de registrar cotações");
    const other = required(await purchasing.generatePurchaseRequest(buyer));
    expect(other.id).not.toBe(selected.id);
    expect(other.items.map((item) => item.productId)).toEqual([second.id]);
    const repeated = required(await purchasing.generatePurchaseRequest(buyer));
    expect(repeated.id).toBe(other.id);
    expect(repeated.items).toHaveLength(1);
    const secondQuote = required(await purchasing.createQuote(buyer, {
      purchaseRequestId: other.id, supplierId: secondSupplier.id,
      items: [{ productId: second.id, quantity: "2", unitPrice: "4", available: true }],
    }));
    const firstOrder = required(await purchasing.createPurchaseOrder(buyer, { quoteId: firstQuote.id, selectionReason: "Especialidade do fornecedor A." }));
    const secondOrder = required(await purchasing.createPurchaseOrder(buyer, { quoteId: secondQuote.id, selectionReason: "Especialidade do fornecedor B." }));
    expect(firstOrder.supplierId).toBe(firstSupplier.id);
    expect(firstOrder.items.map((item) => item.productId)).toEqual([first.id]);
    expect(secondOrder.supplierId).toBe(secondSupplier.id);
    expect(secondOrder.items.map((item) => item.productId)).toEqual([second.id]);
    needs = await purchasing.listPurchaseNeeds(buyer);
    expect(required(needs.find((item) => item.id === first.id)).alreadyRequested).toBe(true);
    expect(required(needs.find((item) => item.id === second.id)).alreadyRequested).toBe(true);
  });

  it("serializa saídas concorrentes e recusa inventário desatualizado", async () => {
    const product = await inventory.createProduct(owner, { name: "Estoque concorrente", unit: "KG", minimumStock: "0", idealStock: "0" });
    await inventory.recordMovement(operator, { productId: product.id, type: "ADJUSTMENT_IN", quantity: "5", unitCost: "10", notes: "Estoque para teste concorrente" });
    const count = await inventory.createInventoryCount(operator);
    const outcomes = await Promise.allSettled([
      inventory.recordMovement(operator, { productId: product.id, type: "CONSUMPTION", quantity: "4" }),
      inventory.recordMovement(operator, { productId: product.id, type: "CONSUMPTION", quantity: "4" }),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await inventory.getProduct(viewer, product.id)).currentStock).toBe("1");
    expect(await db.stockMovement.count({ where: { organizationId: owner.organizationId, productId: product.id, type: "CONSUMPTION" } })).toBe(1);
    await expect(inventory.finishInventoryCount(operator, {
      id: count.id, items: count.items.map((item) => ({ productId: item.productId, countedQuantity: item.systemQuantity })),
    })).rejects.toMatchObject({ status: 409 });
    expect((await inventory.getProduct(viewer, product.id)).currentStock).toBe("1");
    expect((await inventory.getInventoryCount(viewer, count.id)).status).toBe("OPEN");
    await inventory.cancelInventoryCount(operator, { id: count.id });
    const starts = await Promise.allSettled([inventory.createInventoryCount(operator), inventory.createInventoryCount(operator)]);
    expect(starts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(starts.filter((result) => result.status === "rejected")).toHaveLength(1);
    const created = starts.find((result) => result.status === "fulfilled");
    if (created?.status === "fulfilled") await inventory.cancelInventoryCount(operator, { id: created.value.id });
  });

  it("impede alteração do histórico e saldo sem movimentação também no banco", async () => {
    const movement = required(await db.stockMovement.findFirst({ where: { organizationId: owner.organizationId, productId } }));
    const previous = await inventory.getProduct(viewer, productId);
    await expect(db.stockMovement.updateMany({ where: { organizationId: owner.organizationId, id: movement.id }, data: { notes: "Sobrescrever histórico" } })).rejects.toThrow();
    await expect(db.stockMovement.deleteMany({ where: { organizationId: owner.organizationId, id: movement.id } })).rejects.toThrow();
    await expect(db.product.updateMany({ where: { organizationId: owner.organizationId, id: productId }, data: { currentStock: { increment: 1 } } })).rejects.toThrow();
    expect((await inventory.getProduct(viewer, productId)).currentStock).toBe(previous.currentStock);
  });
});
