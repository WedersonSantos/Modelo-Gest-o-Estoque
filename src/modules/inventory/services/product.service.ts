import { assertRole, type Actor } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { transaction } from "@/shared/lib/prisma";
import * as products from "../repositories/product.repository";
import { hasStockMovement } from "../repositories/stock-movement.repository";
import { createProductCategorySchema, createProductSchema, updateProductSchema } from "../schemas/inventory.schema";
import { productDto } from "./inventory.dto";
import { quantity, validateStockThresholds } from "./stock.rules";

export async function createProduct(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN"]);
  const data = createProductSchema.parse(input);
  validateStockThresholds(data.minimumStock, data.idealStock);
  return transaction(async (tx) => {
    if (data.categoryId && !await products.findProductCategory(actor.organizationId, data.categoryId, tx)) {
      throw new DomainError("Categoria não encontrada.", 404);
    }
    const product = await products.insertProduct(tx, {
      organizationId: actor.organizationId,
      name: data.name,
      description: data.description || null,
      categoryId: data.categoryId || null,
      unit: data.unit,
      minimumStock: quantity(data.minimumStock),
      idealStock: quantity(data.idealStock),
      currentStock: "0",
      averageCost: "0",
    });
    await audit(tx, actor, "PRODUCT_CREATED", "Product", product.id, { name: product.name });
    return productDto(product);
  });
}

export async function updateProduct(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN"]);
  const data = updateProductSchema.parse(input);
  validateStockThresholds(data.minimumStock, data.idealStock);
  return transaction(async (tx) => {
    const existing = await products.lockProduct(tx, actor.organizationId, data.id);
    if (!existing) throw new DomainError("Ingrediente não encontrado.", 404);
    if (data.categoryId && !await products.findProductCategory(actor.organizationId, data.categoryId, tx)) {
      throw new DomainError("Categoria não encontrada.", 404);
    }
    if (existing.unit !== data.unit && await hasStockMovement(actor.organizationId, data.id, tx)) {
      throw new DomainError("A unidade não pode ser alterada após movimentações. Cadastre um novo ingrediente.", 409);
    }
    if (data.active === false && existing.currentStock.gt(0)) {
      throw new DomainError("Zere o estoque por uma movimentação antes de desativar o ingrediente.", 409);
    }
    const product = await products.updateProductFields(tx, actor.organizationId, data.id, {
      name: data.name,
      description: data.description || null,
      categoryId: data.categoryId || null,
      unit: data.unit,
      minimumStock: quantity(data.minimumStock),
      idealStock: quantity(data.idealStock),
      ...(data.active === undefined ? {} : { active: data.active }),
    });
    if (!product) throw new DomainError("Ingrediente não encontrado.", 404);
    await audit(tx, actor, "PRODUCT_UPDATED", "Product", product.id, {
      name: product.name,
      minimumStock: data.minimumStock,
      idealStock: data.idealStock,
      active: product.active,
    });
    return productDto(product);
  });
}

export async function getProduct(actor: Actor, id: string) {
  const product = await products.findProduct(actor.organizationId, id);
  if (!product) throw new DomainError("Ingrediente não encontrado.", 404);
  return productDto(product);
}

export async function listProductCategories(actor: Actor) {
  return products.listProductCategories(actor.organizationId);
}

export async function createProductCategory(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN"]);
  const data = createProductCategorySchema.parse(input);
  return transaction(async (tx) => {
    const category = await products.insertProductCategory(tx, actor.organizationId, data.name);
    await audit(tx, actor, "PRODUCT_CATEGORY_CREATED", "ProductCategory", category.id, { name: category.name });
    return category;
  });
}
