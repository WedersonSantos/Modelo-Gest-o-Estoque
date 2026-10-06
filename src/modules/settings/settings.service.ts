import { hash } from "bcryptjs";
import { prisma, transaction } from "@/shared/lib/prisma";
import { assertRole, ADMIN_ROLES } from "@/shared/lib/permissions";
import { audit } from "@/shared/lib/audit";
import { assert } from "@/shared/lib/errors";
import type { Actor } from "@/shared/types/actor";
import { categorySchema, createUserSchema, financialCategorySchema, registerSchema } from "./settings.schema";

const userSelection = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;

/** New tenants start with zero stock and no invented financial history. */
export async function registerOrganization(input: unknown) {
  const data = registerSchema.parse(input);
  const passwordHash = await hash(data.password, 12);
  return transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: data.organizationName } });
    const user = await tx.user.create({ data: { organizationId: organization.id, name: data.name, email: data.email, passwordHash, role: "OWNER" } });
    await tx.productCategory.createMany({ data: ["Proteínas", "Grãos e farinhas", "Temperos e molhos", "Hortifruti", "Padaria"].map((name) => ({ organizationId: organization.id, name })) });
    await tx.financialCategory.createMany({ data: [
      { organizationId: organization.id, name: "Vendas do restaurante", type: "INCOME" },
      { organizationId: organization.id, name: "Eventos", type: "INCOME" },
      { organizationId: organization.id, name: "Compras de ingredientes", type: "EXPENSE" },
      { organizationId: organization.id, name: "Despesas operacionais", type: "EXPENSE" },
    ] });
    await audit(tx, { userId: user.id, organizationId: organization.id, role: "OWNER" }, "REGISTER", "Organization", organization.id);
    return { id: user.id, organizationId: organization.id, role: user.role };
  });
}

export async function listUsers(actor: Actor) {
  assertRole(actor, ADMIN_ROLES);
  return prisma.user.findMany({ where: { organizationId: actor.organizationId }, select: userSelection, orderBy: { name: "asc" } });
}

export async function getAccount(actor: Actor) {
  const user = await prisma.user.findFirst({
    where: { id: actor.userId, organizationId: actor.organizationId, active: true },
    select: { ...userSelection, organization: { select: { id: true, name: true } } },
  });
  assert(user, "Sua conta não está disponível.", 401);
  return user;
}

export async function listSettings(actor: Actor) {
  assertRole(actor, ADMIN_ROLES);
  const [organization, users, productCategories, financialCategories] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: actor.organizationId }, select: { id: true, name: true } }),
    listUsers(actor),
    prisma.productCategory.findMany({ where: { organizationId: actor.organizationId }, orderBy: { name: "asc" } }),
    prisma.financialCategory.findMany({ where: { organizationId: actor.organizationId }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);
  return { organization, users, productCategories, financialCategories };
}

export async function createUser(actor: Actor, input: unknown) {
  assertRole(actor, ADMIN_ROLES);
  const data = createUserSchema.parse(input);
  assert(data.role !== "OWNER" || actor.role === "OWNER", "Somente um proprietário pode cadastrar outro proprietário.", 403);
  const passwordHash = await hash(data.password, 12);
  return transaction(async (tx) => {
    const user = await tx.user.create({ data: { organizationId: actor.organizationId, name: data.name, email: data.email, role: data.role, passwordHash }, select: userSelection });
    await audit(tx, actor, "CREATE", "User", user.id, { name: user.name, role: user.role });
    return user;
  });
}

export async function createCategory(actor: Actor, input: unknown) {
  assertRole(actor, ADMIN_ROLES);
  const data = categorySchema.parse(input);
  return transaction(async (tx) => {
    const category = await tx.productCategory.create({ data: { organizationId: actor.organizationId, name: data.name } });
    await audit(tx, actor, "CREATE", "ProductCategory", category.id, { name: category.name });
    return category;
  });
}

export async function createFinancialCategory(actor: Actor, input: unknown) {
  assertRole(actor, ADMIN_ROLES);
  const data = financialCategorySchema.parse(input);
  return transaction(async (tx) => {
    const category = await tx.financialCategory.create({ data: { organizationId: actor.organizationId, ...data } });
    await audit(tx, actor, "CREATE", "FinancialCategory", category.id, data);
    return category;
  });
}
