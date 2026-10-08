import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

if (process.env.NODE_ENV === "production") throw new Error("O seed de demonstração não pode ser executado em produção.");
if (process.env.ALLOW_DEMO_SEED !== "true") throw new Error("Defina ALLOW_DEMO_SEED=true somente no banco de desenvolvimento para autorizar dados fictícios.");
if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL antes de executar o seed.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const d = (value: string | number) => new Prisma.Decimal(value);
const ago = (days: number) => new Date(Date.now() - days * 86_400_000);
const organizationId = "demo_restaurante";
const userId = "demo_admin";

async function seedMenu(tx: Prisma.TransactionClient) {
  for (const [id,name,price] of [["demo_menu_quibe","Quibe assado","28.00"],["demo_menu_esfiha","Esfiha de carne","12.00"],["demo_menu_homus","Homus com pão sírio","24.00"]]) {
    await tx.menuItem.upsert({where:{id},update:{},create:{id,organizationId,name,price:d(price),description:"Item fictício de demonstração"}});
  }
}
async function main() {
  if (await prisma.organization.findUnique({ where: { id: organizationId } })) {
    await prisma.$transaction(async tx=>{await tx.organization.updateMany({where:{id:organizationId,name:"Casa Zaatar · Demonstração"},data:{name:"Casa Anatolia · Demonstração"}});await seedMenu(tx);});
    console.log("Demonstração já cadastrada. Seed preservou os dados existentes.");
    return;
  }
  const passwordHash = await hash("Demo@123456", 12);
  await prisma.$transaction(async (tx) => {
    await tx.organization.create({ data: { id: organizationId, name: "Casa Anatolia · Demonstração" } });
    await tx.user.create({ data: { id: userId, organizationId, name: "Administrador de demonstração", email: "admin@exemplo.com", passwordHash, role: "OWNER" } });
    await seedMenu(tx);
    const categoryNames = ["Proteínas", "Grãos e farinhas", "Temperos e molhos", "Hortifruti", "Padaria"];
    await tx.productCategory.createMany({ data: categoryNames.map((name, i) => ({ id: `demo_cat_${i}`, organizationId, name })) });
    await tx.financialCategory.createMany({ data: [
      { id: "demo_fc_sales", organizationId, name: "Vendas do restaurante", type: "INCOME" },
      { id: "demo_fc_events", organizationId, name: "Eventos", type: "INCOME" },
      { id: "demo_fc_purchases", organizationId, name: "Compras de ingredientes", type: "EXPENSE" },
      { id: "demo_fc_operational", organizationId, name: "Despesas operacionais", type: "EXPENSE" },
    ] });
    const products = [
      { id: "demo_beef", name: "Carne bovina", unit: "KG", category: 0, minimum: 8, ideal: 20, initial: 18, current: 3, cost: 32 },
      { id: "demo_chickpea", name: "Grão-de-bico", unit: "KG", category: 1, minimum: 5, ideal: 18, initial: 15, current: 4, cost: 12 },
      { id: "demo_tahini", name: "Tahine", unit: "KG", category: 2, minimum: 2, ideal: 8, initial: 8, current: 6, cost: 38 },
      { id: "demo_wheat", name: "Trigo para quibe", unit: "KG", category: 1, minimum: 5, ideal: 20, initial: 18, current: 12, cost: 8 },
      { id: "demo_oil", name: "Azeite", unit: "L", category: 2, minimum: 3, ideal: 10, initial: 8, current: 2, cost: 29 },
      { id: "demo_lemon", name: "Limão", unit: "KG", category: 3, minimum: 5, ideal: 12, initial: 10, current: 4, cost: 7 },
      { id: "demo_onion", name: "Cebola", unit: "KG", category: 3, minimum: 4, ideal: 15, initial: 20, current: 10, cost: 4.5 },
      { id: "demo_garlic", name: "Alho", unit: "KG", category: 3, minimum: 1, ideal: 5, initial: 5, current: 1.5, cost: 18 },
      { id: "demo_bread", name: "Pão sírio", unit: "UNIT", category: 4, minimum: 20, ideal: 80, initial: 80, current: 15, cost: 1.8 },
    ] as const;
    await tx.inventoryCount.create({ data: { id: "demo_initial_count", organizationId, status: "COMPLETED", notes: "Inventário inicial fictício", createdBy: userId, finishedBy: userId, startedAt: ago(10), createdAt: ago(10), finishedAt: ago(10) } });
    for (const p of products) {
      const averageCost = p.cost;
      await tx.product.create({ data: { id: p.id, organizationId, name: p.name, unit: p.unit, categoryId: `demo_cat_${p.category}`, minimumStock: p.minimum, idealStock: p.ideal, currentStock: p.current, averageCost, createdAt: ago(10) } });
      await tx.inventoryCountItem.create({ data: { organizationId, inventoryCountId: "demo_initial_count", productId: p.id, systemQuantity: 0, countedQuantity: p.initial, difference: p.initial, snapshotUpdatedAt: ago(10) } });
      await tx.stockMovement.create({ data: { organizationId, productId: p.id, type: "INVENTORY_ADJUSTMENT", direction: "IN", quantity: p.initial, unitCost: p.cost, totalCost: d(p.initial).mul(p.cost).toDecimalPlaces(2), stockBefore: 0, stockAfter: p.initial, referenceType: "INVENTORY_COUNT", referenceId: "demo_initial_count", notes: "Saldo inicial de demonstração", createdBy: userId, createdAt: ago(10) } });
    }
    const suppliers = [
      { id: "demo_supplier_central", name: "Distribuidora Central", companyName: "Distribuidora Central Exemplo", phone: "(11) 4000-0001", payment: "14 dias", lead: 2 },
      { id: "demo_supplier_market", name: "Mercado Regional", companyName: "Mercado Regional Exemplo", phone: "(11) 4000-0002", payment: "À vista", lead: 1 },
      { id: "demo_supplier_meat", name: "Casa de Carnes Exemplo", companyName: "Casa de Carnes Exemplo", phone: "(11) 4000-0003", payment: "7 dias", lead: 1 },
    ];
    for (const s of suppliers) {
      await tx.supplier.create({ data: { id: s.id, organizationId, name: s.name, companyName: s.companyName, phone: s.phone, notes: "Fornecedor fictício; contatos de demonstração." } });
      for (const p of products.filter((p) => s.id !== "demo_supplier_meat" || p.id === "demo_beef")) {
        const lastPrice = d(p.cost).mul(s.id === "demo_supplier_market" ? 1.08 : s.id === "demo_supplier_meat" ? 0.97 : 1).toDecimalPlaces(4);
        const sp = await tx.supplierProduct.create({ data: { organizationId, supplierId: s.id, productId: p.id, lastPrice, minimumOrderQuantity: 1, leadTimeDays: s.lead, paymentTerms: s.payment, lastPurchaseAt: p.id === "demo_chickpea" && s.id === "demo_supplier_central" ? ago(3) : null } });
        await tx.supplierPriceHistory.createMany({ data: [
          { organizationId, supplierProductId: sp.id, price: lastPrice.mul("0.95").toDecimalPlaces(4), date: ago(9), source: "QUOTE", notes: "Preço fictício anterior" },
          { organizationId, supplierProductId: sp.id, price: lastPrice, date: ago(3), source: "QUOTE", notes: "Pesquisa de demonstração" },
        ] });
      }
    }
    await tx.purchaseRequest.create({ data: { id: "demo_request_received", organizationId, title: "Reposição de grão-de-bico", status: "CLOSED", createdBy: userId, createdAt: ago(4) } });
    await tx.purchaseRequestItem.create({ data: { organizationId, purchaseRequestId: "demo_request_received", productId: "demo_chickpea", currentStock: 15, minimumStock: 5, idealStock: 25, suggestedQuantity: 10, requestedQuantity: 10 } });
    await tx.supplierQuote.create({ data: { id: "demo_quote_received", organizationId, purchaseRequestId: "demo_request_received", supplierId: "demo_supplier_central", status: "SELECTED", freight: 10, leadTimeDays: 1, paymentTerms: "À vista", createdAt: ago(4) } });
    await tx.supplierQuoteItem.create({ data: { organizationId, supplierQuoteId: "demo_quote_received", productId: "demo_chickpea", quantity: 10, unitPrice: 12, totalPrice: 120 } });
    await tx.purchaseOrder.create({ data: { id: "demo_order_received", organizationId, supplierId: "demo_supplier_central", purchaseRequestId: "demo_request_received", quoteId: "demo_quote_received", status: "RECEIVED", total: 130, freight: 10, selectionReason: "Disponibilidade e entrega no dia seguinte", orderedAt: ago(4), receivedAt: ago(3), createdAt: ago(4), createdBy: userId } });
    await tx.purchaseOrderItem.create({ data: { id: "demo_order_item", organizationId, purchaseOrderId: "demo_order_received", productId: "demo_chickpea", quantity: 10, receivedQuantity: 10, unitPrice: 12, totalPrice: 120 } });
    await tx.goodsReceipt.create({ data: { id: "demo_receipt", organizationId, purchaseOrderId: "demo_order_received", idempotencyKey: "demo-receipt-1", total: 130, freight: 10, createdBy: userId, receivedAt: ago(3), createdAt: ago(3) } });
    await tx.goodsReceiptItem.create({ data: { organizationId, goodsReceiptId: "demo_receipt", orderItemId: "demo_order_item", productId: "demo_chickpea", quantity: 10, unitCost: 12, totalCost: 120 } });
    await tx.stockMovement.create({ data: { organizationId, productId: "demo_chickpea", type: "PURCHASE", direction: "IN", quantity: 10, unitCost: 12, totalCost: 120, stockBefore: 15, stockAfter: 25, referenceType: "GOODS_RECEIPT", referenceId: "demo_receipt", notes: "Compra fictícia recebida", createdBy: userId, createdAt: ago(3) } });
    for (const p of products) {
      const before = p.initial + (p.id === "demo_chickpea" ? 10 : 0);
      const quantity = d(before).sub(p.current);
      const unitCost = p.cost;
      await tx.stockMovement.create({ data: { organizationId, productId: p.id, type: "CONSUMPTION", direction: "OUT", quantity, unitCost, totalCost: quantity.mul(unitCost).toDecimalPlaces(2), stockBefore: before, stockAfter: p.current, usageContext: p.id === "demo_beef" ? "EVENT" : "RESTAURANT", notes: "Consumo de demonstração", createdBy: userId, createdAt: ago(2) } });
    }
    await tx.purchaseRequest.create({ data: { id: "demo_request_pending", organizationId, title: "Reposição da semana", status: "ORDERED", createdBy: userId, createdAt: ago(1) } });
    for (const [productId, stock, min, ideal, qty] of [["demo_beef", 3, 8, 20, 17], ["demo_oil", 2, 3, 10, 8]] as const) {
      await tx.purchaseRequestItem.create({ data: { organizationId, purchaseRequestId: "demo_request_pending", productId, currentStock: stock, minimumStock: min, idealStock: ideal, suggestedQuantity: qty, requestedQuantity: qty } });
    }
    for (const [id, supplierId, meatPrice, oilPrice, freight, lead, payment] of [
      ["demo_quote_pending", "demo_supplier_central", 32, 29, 15, 2, "14 dias"],
      ["demo_quote_alternative", "demo_supplier_market", 34.56, 31.32, 0, 1, "À vista"],
    ] as const) {
      await tx.supplierQuote.create({ data: { id, organizationId, purchaseRequestId: "demo_request_pending", supplierId, status: id === "demo_quote_pending" ? "SELECTED" : "RECEIVED", freight, leadTimeDays: lead, paymentTerms: payment, validUntil: ago(-5), createdAt: ago(1) } });
      await tx.supplierQuoteItem.createMany({ data: [
        { organizationId, supplierQuoteId: id, productId: "demo_beef", quantity: 17, unitPrice: meatPrice, totalPrice: d(17).mul(meatPrice).toDecimalPlaces(2) },
        { organizationId, supplierQuoteId: id, productId: "demo_oil", quantity: 8, unitPrice: oilPrice, totalPrice: d(8).mul(oilPrice).toDecimalPlaces(2) },
      ] });
    }
    await tx.purchaseOrder.create({ data: { id: "demo_order_pending", organizationId, supplierId: "demo_supplier_central", purchaseRequestId: "demo_request_pending", quoteId: "demo_quote_pending", status: "ORDERED", total: 791, freight: 15, selectionReason: "Preço total e pagamento em 14 dias", createdBy: userId, orderedAt: ago(1), expectedAt: ago(-1), createdAt: ago(1) } });
    await tx.purchaseOrderItem.createMany({ data: [
      { organizationId, purchaseOrderId: "demo_order_pending", productId: "demo_beef", quantity: 17, unitPrice: 32, totalPrice: 544 },
      { organizationId, purchaseOrderId: "demo_order_pending", productId: "demo_oil", quantity: 8, unitPrice: 29, totalPrice: 232 },
    ] });
    await tx.financialEntry.createMany({ data: [
      { organizationId, categoryId: "demo_fc_sales", type: "INCOME", description: "Vendas da semana · fictício", amount: 3200, status: "PAID", dueDate: ago(3), paidAt: ago(3), createdBy: userId, createdAt: ago(3) },
      { organizationId, categoryId: "demo_fc_events", type: "INCOME", description: "Evento familiar · fictício", amount: 1800, status: "PAID", dueDate: ago(2), paidAt: ago(2), createdBy: userId, createdAt: ago(2) },
      { organizationId, categoryId: "demo_fc_purchases", type: "EXPENSE", description: "Compra - Distribuidora Central · fictício", amount: 130, status: "PAID", dueDate: ago(3), paidAt: ago(3), referenceType: "GOODS_RECEIPT", referenceId: "demo_receipt", createdBy: userId, createdAt: ago(3) },
      { organizationId, categoryId: "demo_fc_operational", type: "EXPENSE", description: "Aluguel · fictício", amount: 1500, status: "PAID", dueDate: ago(4), paidAt: ago(4), createdBy: userId, createdAt: ago(4) },
      { organizationId, categoryId: "demo_fc_operational", type: "EXPENSE", description: "Energia · fictício", amount: 320, status: "PENDING", dueDate: ago(-3), createdBy: userId, createdAt: ago(1) },
      { organizationId, categoryId: "demo_fc_operational", type: "EXPENSE", description: "Internet · fictício", amount: 99, status: "PENDING", dueDate: ago(-6), createdBy: userId, createdAt: ago(1) },
    ] });
    await tx.auditLog.create({ data: { organizationId, userId, action: "SEED", entity: "Organization", entityId: organizationId, details: { fictitious: true, products: 9, suppliers: 3 } } });
  }, { timeout: 60_000 });
  console.log("Demonstração criada: admin@exemplo.com / Demo@123456 (somente desenvolvimento).");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
