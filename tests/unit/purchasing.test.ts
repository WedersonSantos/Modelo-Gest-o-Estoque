import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { suggestedPurchaseQuantity, validateOrderTransition, validateReceiptQuantity, allocateReceiptFreight, receiptLineValue, quoteIsExpired } from "@/modules/purchasing/services/purchasing.rules";
import { quoteSchema, receivePurchaseOrderSchema } from "@/modules/purchasing/schemas/purchasing.schema";
import { supplierPriceSchema, updateSupplierSchema } from "@/modules/suppliers/schemas/supplier.schema";

describe("necessidades de compra", () => {
  it("gera reposição ao atingir o mínimo, até o estoque ideal", () => {
    expect(suggestedPurchaseQuantity("3", "8", "15").toString()).toBe("12");
    expect(suggestedPurchaseQuantity("8", "8", "15").toString()).toBe("7");
    expect(suggestedPurchaseQuantity("8.0001", "8", "15").toString()).toBe("0");
  });
  it("preserva precisão de ingredientes fracionados e não sugere valor negativo", () => {
    expect(suggestedPurchaseQuantity("0.0001", "0.0010", "0.0011").toString()).toBe("0.001");
    expect(suggestedPurchaseQuantity("5", "8", "3").toString()).toBe("0");
  });
});

describe("aprovação e recebimento de pedidos", () => {
  it("exige cada etapa e autorização para aprovação", () => {
    expect(() => validateOrderTransition("DRAFT", "PENDING_APPROVAL", "BUYER", false)).not.toThrow();
    expect(() => validateOrderTransition("PENDING_APPROVAL", "APPROVED", "OWNER", false)).not.toThrow();
    expect(() => validateOrderTransition("APPROVED", "ORDERED", "BUYER", false)).not.toThrow();
    expect(() => validateOrderTransition("DRAFT", "ORDERED", "ADMIN", false)).toThrow();
    expect(() => validateOrderTransition("PENDING_APPROVAL", "APPROVED", "BUYER", false)).toThrow();
    expect(() => validateOrderTransition("DRAFT", "PENDING_APPROVAL", "VIEWER", false)).toThrow();
  });
  it("preserva pedidos que já possuem recebimentos", () => {
    expect(() => validateOrderTransition("DRAFT", "CANCELED", "ADMIN", false)).not.toThrow();
    expect(() => validateOrderTransition("PARTIALLY_RECEIVED", "CANCELED", "OWNER", true)).toThrow();
    expect(() => validateOrderTransition("DRAFT", "CANCELED", "BUYER", false)).toThrow();
  });
  it("permite parcial exato e rejeita recebimento excessivo, zero ou negativo", () => {
    expect(validateReceiptQuantity("10", "4.9999", "5.0001").toString()).toBe("5.0001");
    expect(() => validateReceiptQuantity("10", "5", "5.0001")).toThrow();
    expect(() => validateReceiptQuantity("10", "0", "0")).toThrow();
    expect(() => validateReceiptQuantity("10", "0", "-1")).toThrow();
  });
  it("soma valores de recebimentos fracionados sem perder ou duplicar centavos", () => {
    const first = receiptLineValue("0", "0.005", "1");
    const second = receiptLineValue("0.005", "0.005", "1");
    expect(first.plus(second).toString()).toBe("0.01");
  });
  it("apropria frete proporcionalmente e encerra o último recebimento com o saldo exato", () => {
    const first = allocateReceiptFreight({ receiptGoods: "1", orderGoods: "3", freight: "10", previouslyAllocatedFreight: "0", complete: false });
    const second = allocateReceiptFreight({ receiptGoods: "1", orderGoods: "3", freight: "10", previouslyAllocatedFreight: first, complete: false });
    const last = allocateReceiptFreight({ receiptGoods: "1", orderGoods: "3", freight: "10", previouslyAllocatedFreight: first.plus(second), complete: true });
    expect(first.toString()).toBe("3.33");
    expect(last.toString()).toBe("3.34");
    expect(first.plus(second).plus(last).toString()).toBe("10");
    expect(new Prisma.Decimal("3").plus(first).plus(second).plus(last).toString()).toBe("13");
  });
  it("validação impede itens repetidos e admite quatro casas decimais", () => {
    const payload = { id: "pedido", idempotencyKey: "recebimento-01", items: [{ orderItemId: "item", quantity: "0.0001" }] };
    expect(receivePurchaseOrderSchema.safeParse(payload).success).toBe(true);
    expect(receivePurchaseOrderSchema.safeParse({ ...payload, items: [...payload.items, ...payload.items] }).success).toBe(false);
    expect(quoteSchema.safeParse({ purchaseRequestId: "lista", supplierId: "fornecedor", items: [{ productId: "produto", quantity: "1", unitPrice: "1.00001" }] }).success).toBe(false);
  });
  it("validade de cotação inclui todo o dia no horário de São Paulo", () => {
    const validity = new Date("2026-10-05T00:00:00-03:00");
    expect(quoteIsExpired(validity, new Date("2026-10-06T02:59:59Z"))).toBe(false);
    expect(quoteIsExpired(validity, new Date("2026-10-06T03:00:00Z"))).toBe(true);
    expect(quoteIsExpired(new Date("2026-10-05T23:00:00-03:00"), new Date("2026-10-06T03:00:00Z"))).toBe(true);
  });
  it("valida datas de cotação sem normalizar dias inexistentes ou números", () => {
    const payload = { purchaseRequestId: "lista", supplierId: "fornecedor", items: [{ productId: "produto", quantity: "1", unitPrice: "1" }] };
    for (const validUntil of ["2026-02-31", "2026-02-31T10:00:00Z", 0]) expect(quoteSchema.safeParse({ ...payload, validUntil }).success).toBe(false);
    expect(quoteSchema.parse({ ...payload, validUntil: "2026-10-05" }).validUntil?.toISOString()).toBe("2026-10-05T03:00:00.000Z");
  });
  it("preserva fornecedor inativo quando a edição não informa active e admite preço preciso", () => {
    expect(updateSupplierSchema.parse({ id: "fornecedor", name: "Distribuidora" }).active).toBeUndefined();
    expect(supplierPriceSchema.safeParse({ supplierId: "fornecedor", productId: "produto", price: "1.0001" }).success).toBe(true);
    expect(supplierPriceSchema.safeParse({ supplierId: "fornecedor", productId: "produto", price: "-1" }).success).toBe(false);
  });
});
