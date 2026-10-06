import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { createProduct, updateProduct } from "@/modules/inventory/services/product.service";
import { recordMovement, receiveStock } from "@/modules/inventory/services/stock-movement.service";
import { finishInventoryCount } from "@/modules/inventory/services/inventory-count.service";
import type { Actor } from "@/shared/types/actor";
import {
  assertFreshInventorySnapshot,
  inventoryDifference,
  movementTotalCost,
  positiveQuantity,
  quantity,
  stockAfterMovement,
  stockAlert,
  suggestedQuantity,
  validateStockThresholds,
  weightedAverageCost,
} from "@/modules/inventory/services/stock.rules";
import { finishInventoryCountSchema, recordMovementSchema } from "@/modules/inventory/schemas/inventory.schema";

const persistence = vi.hoisted(() => ({
  transaction: vi.fn(), audit: vi.fn(), lockProduct: vi.fn(), updateProductFields: vi.fn(),
  insertProduct: vi.fn(), findProductCategory: vi.fn(), hasStockMovement: vi.fn(), insertStockMovement: vi.fn(),
  lockInventoryCount: vi.fn(), findInventoryCount: vi.fn(), updateInventoryCountItem: vi.fn(), updateInventoryCountFields: vi.fn(),
}));

vi.mock("@/shared/lib/auth", async () => await import("@/shared/lib/permissions"));
vi.mock("@/shared/lib/prisma", () => ({ prisma: {}, transaction: persistence.transaction }));
vi.mock("@/shared/lib/audit", () => ({ audit: persistence.audit }));
vi.mock("@/modules/inventory/repositories/product.repository", () => ({
  lockProduct: persistence.lockProduct,
  updateProductFields: persistence.updateProductFields,
  insertProduct: persistence.insertProduct,
  findProductCategory: persistence.findProductCategory,
  listActiveProducts: vi.fn(), findProduct: vi.fn(), listProductCategories: vi.fn(), insertProductCategory: vi.fn(),
}));
vi.mock("@/modules/inventory/repositories/stock-movement.repository", () => ({
  insertStockMovement: persistence.insertStockMovement, hasStockMovement: persistence.hasStockMovement,
}));
vi.mock("@/modules/inventory/repositories/inventory-count.repository", () => ({
  lockInventoryCount: persistence.lockInventoryCount,
  findInventoryCount: persistence.findInventoryCount,
  updateInventoryCountItem: persistence.updateInventoryCountItem,
  updateInventoryCountFields: persistence.updateInventoryCountFields,
  findOpenInventoryCount: vi.fn(), listInventoryCounts: vi.fn(), lockOrganization: vi.fn(),
  insertInventoryCount: vi.fn(), insertInventoryCountItems: vi.fn(),
}));

const actor: Actor = { userId: "user-a", organizationId: "org-a", role: "OPERATOR" };
const snapshotDate = new Date("2026-01-01T12:00:00Z");
function fixtureProduct(stock = "7", cost = "20") {
  return {
    id: "product-a", organizationId: "org-a", name: "Tahine", description: null, categoryId: null, category: null,
    unit: "KG" as const, currentStock: new Prisma.Decimal(stock), averageCost: new Prisma.Decimal(cost),
    minimumStock: new Prisma.Decimal("2"), idealStock: new Prisma.Decimal("10"), active: true,
    createdAt: snapshotDate, updatedAt: snapshotDate,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  persistence.transaction.mockImplementation((callback) => callback({}));
});

describe("regras de estoque", () => {
  it("mantém precisão decimal em entradas e saídas fracionárias", () => {
    expect(stockAfterMovement("0.1", "0.2", "IN").toString()).toBe("0.3");
    expect(stockAfterMovement("0.3", "0.1", "OUT").toString()).toBe("0.2");
  });

  it("permite zerar o saldo e impede estoque negativo", () => {
    expect(stockAfterMovement("10", "10", "OUT").toString()).toBe("0");
    expect(() => stockAfterMovement("1", "1.0001", "OUT")).toThrow("Estoque insuficiente");
  });

  it("impede entradas negativas, zero e quantidades além da coluna Decimal", () => {
    expect(() => positiveQuantity("0")).toThrow();
    expect(() => quantity("-1")).toThrow();
    expect(() => quantity("0.00001")).toThrow();
    expect(() => stockAfterMovement("9999999999.9999", "0.0001", "IN")).toThrow();
  });

  it("alerta no limite mínimo e abaixo dele", () => {
    expect(stockAlert("8", "8")).toBe(true);
    expect(stockAlert("7.9999", "8")).toBe(true);
    expect(stockAlert("8.0001", "8")).toBe(false);
  });

  it("sugere recompor até o ideal, sem compras negativas", () => {
    expect(suggestedQuantity("3", "15").toString()).toBe("12");
    expect(suggestedQuantity("15.1", "15").toString()).toBe("0");
    expect(suggestedQuantity("0.1", "0.3").toString()).toBe("0.2");
    expect(() => validateStockThresholds("10", "9.9999")).toThrow("estoque ideal");
  });
});

describe("custo médio e valor de estoque", () => {
  it("pondera custos pela quantidade presente e recebida", () => {
    expect(weightedAverageCost("10", "20", "5", "26").toString()).toBe("22");
    expect(weightedAverageCost("0", "30", "5", "12.1234").toString()).toBe("12.1234");
  });

  it("arredonda apenas o resultado final para quatro casas", () => {
    expect(weightedAverageCost("1", "1", "2", "2").toString()).toBe("1.6667");
    expect(weightedAverageCost("0.1", "0.1", "0.2", "0.2").toString()).toBe("0.1667");
    // The exact value is just below 5000000000.00015; 20-digit intermediate precision would round up too soon.
    expect(weightedAverageCost("7999999999.9998", "5000000000.0001", "0.0001", "9000000000").toString()).toBe("5000000000.0001");
  });

  it("valoriza quantidades fracionadas sem floating point e respeita teto monetário", () => {
    expect(movementTotalCost("0.1", "0.2").toString()).toBe("0.02");
    expect(movementTotalCost("1", "0.005").toString()).toBe("0.01");
    expect(() => movementTotalCost("9999999999", "9999999999")).toThrow("limite permitido");
  });
});

describe("inventário", () => {
  it("calcula ajustes positivos, negativos e inventário inicial", () => {
    expect(inventoryDifference("0", "10.25").toString()).toBe("10.25");
    expect(inventoryDifference("8", "5.5").toString()).toBe("-2.5");
    expect(inventoryDifference("3", "3").toString()).toBe("0");
  });

  it("recusa contagem quando o estoque mudou após o snapshot", () => {
    const start = new Date("2026-01-01T12:00:00Z");
    expect(() => assertFreshInventorySnapshot("10", "9", start, start)).toThrow("estoque mudou");
    expect(() => assertFreshInventorySnapshot("10", "10", start, new Date("2026-01-01T12:01:00Z"))).toThrow("estoque mudou");
    expect(() => assertFreshInventorySnapshot("10", "10", start, start)).not.toThrow();
  });

  it("impede duplicar um ingrediente na mesma contagem", () => {
    expect(finishInventoryCountSchema.safeParse({ id: "count", items: [
      { productId: "p1", countedQuantity: "5" }, { productId: "p1", countedQuantity: "6" },
    ] }).success).toBe(false);
  });
});

describe("validação de movimentações", () => {
  it("aceita consumo de evento e exige quantidade positiva", () => {
    expect(recordMovementSchema.safeParse({ productId: "p1", type: "CONSUMPTION", quantity: "0.5", usageContext: "EVENT" }).success).toBe(true);
    for (const value of [0.5, "0", "-1", "1e2", "1,5", "10000000000", "1.00001"]) {
      expect(recordMovementSchema.safeParse({ productId: "p1", type: "CONSUMPTION", quantity: value }).success).toBe(false);
    }
  });

  it("exige motivo e direção explícita em outras movimentações", () => {
    expect(recordMovementSchema.safeParse({ productId: "p1", type: "OTHER", quantity: "1", notes: "Correção" }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ productId: "p1", type: "OTHER", quantity: "1", direction: "OUT", notes: "Transferência" }).success).toBe(true);
    expect(recordMovementSchema.safeParse({ productId: "p1", type: "LOSS", quantity: "1" }).success).toBe(false);
  });

  it("impede direção incompatível e ajustes de inventário fora da finalização", () => {
    expect(recordMovementSchema.safeParse({ productId: "p1", type: "CONSUMPTION", direction: "IN", quantity: "1" }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ productId: "p1", type: "INVENTORY_ADJUSTMENT", quantity: "1" }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ productId: "p1", type: "PURCHASE", quantity: "1", unitCost: "10" }).success).toBe(false);
  });
});

describe("coordenação do estoque e isolamento", () => {
  it("nega gravação aos perfis de leitura e compra antes de abrir transação", async () => {
    for (const role of ["VIEWER", "BUYER"] as const) {
      await expect(recordMovement({ ...actor, role }, { productId: "product-a", type: "CONSUMPTION", quantity: "1" }))
        .rejects.toMatchObject({ status: 403 });
    }
    expect(persistence.transaction).not.toHaveBeenCalled();
  });

  it("consulta o ingrediente na organização e bloqueia referências externas", async () => {
    persistence.lockProduct.mockResolvedValue(null);
    await expect(recordMovement(actor, { productId: "foreign-product", type: "CONSUMPTION", quantity: "1" }))
      .rejects.toMatchObject({ status: 404 });
    expect(persistence.lockProduct).toHaveBeenCalledWith({}, "org-a", "foreign-product");
    expect(persistence.insertStockMovement).not.toHaveBeenCalled();
    expect(persistence.updateProductFields).not.toHaveBeenCalled();
  });

  it("não grava movimentação nem saldo quando uma saída excede o estoque", async () => {
    persistence.lockProduct.mockResolvedValue(fixtureProduct("0.5"));
    await expect(recordMovement(actor, { productId: "product-a", type: "LOSS", quantity: "1", notes: "Vencimento" }))
      .rejects.toMatchObject({ status: 409 });
    expect(persistence.insertStockMovement).not.toHaveBeenCalled();
    expect(persistence.updateProductFields).not.toHaveBeenCalled();
  });

  it("faz entrada de compra, custo médio e auditoria na transação do recebimento", async () => {
    const product = fixtureProduct();
    const tx = {} as Prisma.TransactionClient;
    persistence.lockProduct.mockResolvedValue(product);
    persistence.insertStockMovement.mockImplementation((_tx, data) => ({ ...data, id: "movement-a", createdAt: snapshotDate }));
    persistence.updateProductFields.mockImplementation((_tx, _org, _id, data) => ({ ...product, ...data }));
    const result = await receiveStock(tx, actor, {
      productId: "product-a", quantity: "3", unitCost: "30", referenceType: "GOODS_RECEIPT", referenceId: "receipt-a",
    });
    expect(result.product.currentStock).toBe("10");
    expect(result.product.averageCost).toBe("23");
    expect(result.movement.totalCost).toBe("90");
    expect(persistence.insertStockMovement).toHaveBeenCalledWith(tx, expect.objectContaining({
      organizationId: "org-a", createdBy: "user-a", type: "PURCHASE", direction: "IN", referenceId: "receipt-a",
    }));
    expect(persistence.updateProductFields).toHaveBeenCalledWith(tx, "org-a", "product-a", expect.any(Object));
    expect(persistence.audit).toHaveBeenCalledWith(tx, actor, "STOCK_MOVEMENT_CREATED", "StockMovement", "movement-a", expect.any(Object));
    expect(persistence.transaction).not.toHaveBeenCalled();
  });

  it("cria ingredientes com saldo zero mesmo que o payload tente definir estoque", async () => {
    const product = fixtureProduct("0", "0");
    persistence.insertProduct.mockResolvedValue(product);
    await createProduct({ ...actor, role: "ADMIN" }, {
      name: "Tahine", unit: "KG", minimumStock: "2", idealStock: "10", currentStock: "100", averageCost: "30",
    });
    expect(persistence.insertProduct).toHaveBeenCalledWith({}, expect.objectContaining({
      organizationId: "org-a", currentStock: "0", averageCost: "0",
    }));
  });

  it("preserva a unidade de um ingrediente com histórico e impede desativar saldo existente", async () => {
    persistence.lockProduct.mockResolvedValue(fixtureProduct());
    persistence.hasStockMovement.mockResolvedValue(true);
    await expect(updateProduct({ ...actor, role: "ADMIN" }, {
      id: "product-a", name: "Tahine", unit: "G", minimumStock: "2", idealStock: "10",
    })).rejects.toMatchObject({ status: 409 });
    await expect(updateProduct({ ...actor, role: "ADMIN" }, {
      id: "product-a", name: "Tahine", unit: "KG", minimumStock: "2", idealStock: "10", active: false,
    })).rejects.toMatchObject({ status: 409 });
    expect(persistence.updateProductFields).not.toHaveBeenCalled();
  });

  it("recusa finalizar inventário incompleto antes de alterar qualquer saldo", async () => {
    persistence.lockInventoryCount.mockResolvedValue({ id: "count-a", status: "OPEN", items: [
      { productId: "product-a" }, { productId: "product-b" },
    ] });
    await expect(finishInventoryCount(actor, { id: "count-a", items: [{ productId: "product-a", countedQuantity: "1" }] }))
      .rejects.toThrow("Conte todos os ingredientes");
    expect(persistence.lockProduct).not.toHaveBeenCalled();
    expect(persistence.insertStockMovement).not.toHaveBeenCalled();
  });

  it("impede inventário desatualizado e não sobrescreve movimentações posteriores", async () => {
    const product = fixtureProduct();
    persistence.lockInventoryCount.mockResolvedValue({ id: "count-a", status: "OPEN", items: [
      { productId: product.id, systemQuantity: new Prisma.Decimal("10"), snapshotUpdatedAt: snapshotDate },
    ] });
    persistence.lockProduct.mockResolvedValue(product);
    await expect(finishInventoryCount(actor, { id: "count-a", items: [{ productId: product.id, countedQuantity: "9" }] }))
      .rejects.toMatchObject({ status: 409 });
    expect(persistence.insertStockMovement).not.toHaveBeenCalled();
    expect(persistence.updateInventoryCountFields).not.toHaveBeenCalled();
  });

  it("inventário inicial gera ajuste positivo e não permite finalizar novamente", async () => {
    const product = fixtureProduct("0", "0");
    const item = { productId: product.id, systemQuantity: product.currentStock, snapshotUpdatedAt: snapshotDate,
      countedQuantity: new Prisma.Decimal("10"), difference: new Prisma.Decimal("10"), product };
    const count = { id: "count-a", status: "OPEN", items: [item] };
    persistence.lockInventoryCount.mockResolvedValue(count);
    persistence.lockProduct.mockResolvedValue(product);
    persistence.insertStockMovement.mockImplementation((_tx, data) => ({ ...data, id: "movement-a", createdAt: snapshotDate }));
    persistence.updateProductFields.mockImplementation((_tx, _org, _id, data) => ({ ...product, ...data }));
    persistence.findInventoryCount.mockResolvedValue({ ...count, status: "COMPLETED" });
    await finishInventoryCount(actor, { id: count.id, items: [{ productId: product.id, countedQuantity: "10" }] });
    expect(persistence.insertStockMovement).toHaveBeenCalledWith({}, expect.objectContaining({
      type: "INVENTORY_ADJUSTMENT", direction: "IN", referenceType: "INVENTORY_COUNT", referenceId: count.id,
    }));
    expect(persistence.updateInventoryCountFields).toHaveBeenCalledWith({}, "org-a", count.id,
      expect.objectContaining({ status: "COMPLETED", finishedBy: actor.userId }));
    persistence.lockInventoryCount.mockResolvedValue({ ...count, status: "COMPLETED" });
    await expect(finishInventoryCount(actor, { id: count.id, items: [{ productId: product.id, countedQuantity: "10" }] }))
      .rejects.toMatchObject({ status: 409 });
    expect(persistence.insertStockMovement).toHaveBeenCalledTimes(1);
  });
});
