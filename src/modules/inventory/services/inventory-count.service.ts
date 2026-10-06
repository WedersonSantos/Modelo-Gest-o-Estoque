import { assertRole, type Actor } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { transaction } from "@/shared/lib/prisma";
import * as counts from "../repositories/inventory-count.repository";
import { listActiveProducts, lockProduct } from "../repositories/product.repository";
import { cancelInventoryCountSchema, createInventoryCountSchema, finishInventoryCountSchema } from "../schemas/inventory.schema";
import { productDto } from "./inventory.dto";
import { assertFreshInventorySnapshot, inventoryDifference, quantity } from "./stock.rules";
import { applyStockChange } from "./stock-movement.service";

function countDto(count: NonNullable<Awaited<ReturnType<typeof counts.findInventoryCount>>>) {
  return {
    ...count,
    items: count.items.map((item) => ({
      ...item,
      systemQuantity: item.systemQuantity.toString(),
      countedQuantity: item.countedQuantity?.toString() ?? null,
      difference: item.difference?.toString() ?? null,
      product: productDto(item.product),
    })),
  };
}

export async function createInventoryCount(actor: Actor, input: unknown = {}) {
  assertRole(actor, ["OWNER", "ADMIN", "OPERATOR"]);
  const data = createInventoryCountSchema.parse(input);
  return transaction(async (tx) => {
    // One open count per organization; the lock also serializes simultaneous starts.
    await counts.lockOrganization(tx, actor.organizationId);
    if (await counts.findOpenInventoryCount(actor.organizationId, tx)) {
      throw new DomainError("Já existe um inventário aberto. Finalize ou cancele a contagem antes de iniciar outra.", 409);
    }
    const products = await listActiveProducts(actor.organizationId, tx);
    if (!products.length) throw new DomainError("Cadastre ao menos um ingrediente ativo antes de iniciar o inventário.");
    const count = await counts.insertInventoryCount(tx, {
      organizationId: actor.organizationId,
      status: "OPEN",
      createdBy: actor.userId,
      notes: data.notes || null,
    });
    await counts.insertInventoryCountItems(tx, products.map((product) => ({
      organizationId: actor.organizationId,
      inventoryCountId: count.id,
      productId: product.id,
      systemQuantity: product.currentStock,
      snapshotUpdatedAt: product.updatedAt,
    })));
    await audit(tx, actor, "INVENTORY_STARTED", "InventoryCount", count.id, { productCount: products.length });
    const result = await counts.findInventoryCount(actor.organizationId, count.id, tx);
    if (!result) throw new DomainError("Inventário não encontrado.", 404);
    return countDto(result);
  });
}

export async function finishInventoryCount(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN", "OPERATOR"]);
  const data = finishInventoryCountSchema.parse(input);
  return transaction(async (tx) => {
    const count = await counts.lockInventoryCount(tx, actor.organizationId, data.id);
    if (!count) throw new DomainError("Inventário não encontrado.", 404);
    if (count.status !== "OPEN") throw new DomainError("Este inventário já foi finalizado ou cancelado.", 409);
    const inputByProduct = new Map(data.items.map((item) => [item.productId, item.countedQuantity]));
    if (data.items.length !== count.items.length || count.items.some((item) => !inputByProduct.has(item.productId))) {
      throw new DomainError("Conte todos os ingredientes deste inventário e somente os que pertencem a ele.");
    }
    let adjustmentCount = 0;
    // A common lock order avoids deadlocks when a receipt touches several ingredients.
    for (const item of [...count.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
      const product = await lockProduct(tx, actor.organizationId, item.productId);
      if (!product || !product.active) throw new DomainError("Um ingrediente da contagem não está mais disponível. Inicie um novo inventário.", 409);
      assertFreshInventorySnapshot(item.systemQuantity, product.currentStock, item.snapshotUpdatedAt, product.updatedAt);
      const counted = quantity(inputByProduct.get(item.productId)!);
      const difference = inventoryDifference(item.systemQuantity, counted);
      if (!difference.isZero()) {
        await applyStockChange(tx, actor, {
          productId: item.productId,
          type: "INVENTORY_ADJUSTMENT",
          direction: difference.isPositive() ? "IN" : "OUT",
          quantity: difference.abs(),
          referenceType: "INVENTORY_COUNT",
          referenceId: count.id,
          usageContext: "OTHER",
          notes: `Ajuste do inventário ${count.id}`,
        }, product);
        adjustmentCount += 1;
      }
      await counts.updateInventoryCountItem(tx, actor.organizationId, count.id, item.productId, {
        countedQuantity: counted,
        difference,
      });
    }
    await counts.updateInventoryCountFields(tx, actor.organizationId, count.id, {
      status: "COMPLETED",
      finishedAt: new Date(),
      finishedBy: actor.userId,
    });
    await audit(tx, actor, "INVENTORY_FINISHED", "InventoryCount", count.id, { adjustmentCount });
    const result = await counts.findInventoryCount(actor.organizationId, count.id, tx);
    if (!result) throw new DomainError("Inventário não encontrado.", 404);
    return countDto(result);
  });
}

export async function cancelInventoryCount(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN", "OPERATOR"]);
  const data = cancelInventoryCountSchema.parse(input);
  return transaction(async (tx) => {
    const count = await counts.lockInventoryCount(tx, actor.organizationId, data.id);
    if (!count) throw new DomainError("Inventário não encontrado.", 404);
    if (count.status !== "OPEN") throw new DomainError("Somente inventários abertos podem ser cancelados.", 409);
    await counts.updateInventoryCountFields(tx, actor.organizationId, count.id, {
      status: "CANCELED", finishedAt: new Date(), finishedBy: actor.userId,
    });
    await audit(tx, actor, "INVENTORY_CANCELED", "InventoryCount", count.id);
    const result = await counts.findInventoryCount(actor.organizationId, count.id, tx);
    if (!result) throw new DomainError("Inventário não encontrado.", 404);
    return countDto(result);
  });
}

export async function listInventoryCounts(actor: Actor) {
  return counts.listInventoryCounts(actor.organizationId);
}

export async function getInventoryCount(actor: Actor, id: string) {
  const count = await counts.findInventoryCount(actor.organizationId, id);
  if (!count) throw new DomainError("Inventário não encontrado.", 404);
  return countDto(count);
}
