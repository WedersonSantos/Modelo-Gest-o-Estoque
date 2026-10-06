import "./setup";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/shared/lib/prisma";

const suffix = randomUUID();
let organizationId: string;
let userId: string;
let productId: string;
let foreignCategoryId: string;
let movementId: string;

describe("PostgreSQL invariants", () => {
  beforeAll(async () => {
    const [organization, other] = await prisma.$transaction([
      prisma.organization.create({ data: { name: `Invariant test ${suffix}` } }),
      prisma.organization.create({ data: { name: `Other invariant test ${suffix}` } }),
    ]);
    organizationId = organization.id;
    const user = await prisma.user.create({ data: { organizationId, name: "Test owner", email: `invariant-${suffix}@example.test`, passwordHash: "test-not-a-login-hash", role: "OWNER" } });
    userId = user.id;
    const category = await prisma.productCategory.create({ data: { organizationId: other.id, name: "Foreign category" } });
    foreignCategoryId = category.id;
    const product = await prisma.product.create({ data: { organizationId, name: "Invariant ingredient", unit: "KG", minimumStock: 1, idealStock: 5 } });
    productId = product.id;
  });

  it("rejects a category belonging to another tenant", async () => {
    await expect(prisma.product.update({ where: { id: productId }, data: { categoryId: foreignCategoryId } })).rejects.toThrow();
  });

  it("rejects direct stock mutation without a ledger record", async () => {
    await expect(prisma.product.update({ where: { id: productId }, data: { currentStock: 2 } })).rejects.toThrow();
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.currentStock.toString()).toBe("0");
  });

  it("accepts atomic stock and ledger updates then preserves historical movement", async () => {
    const movement = await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { currentStock: 2 } });
      return tx.stockMovement.create({ data: { organizationId, productId, type: "ADJUSTMENT_IN", direction: "IN", quantity: 2, unitCost: 10, totalCost: 20, stockBefore: 0, stockAfter: 2, createdBy: userId, notes: "Test adjustment" } });
    });
    movementId = movement.id;
    await expect(prisma.stockMovement.update({ where: { id: movementId }, data: { notes: "Rewrite history" } })).rejects.toThrow();
    await expect(prisma.stockMovement.delete({ where: { id: movementId } })).rejects.toThrow();
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.currentStock.toString()).toBe("2");
  });
});
