import { Prisma } from "@prisma/client";
import { prisma, transaction } from "@/shared/lib/prisma";
import { type Actor, assertRole } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { DomainError } from "@/shared/lib/errors";
import { financeRepository } from "../repositories/financial-entry.repository";
import { financialCategorySchema, financialEntrySchema, financialPeriodSchema, payFinancialEntrySchema, cancelFinancialEntrySchema } from "../schemas/finance.schema";
import { summarizeFinancialEntries, validatePayment, validateFinancialCancellation } from "./finance.rules";

export async function listFinancialEntries(actor: Actor, period: { from?: Date | string; to?: Date | string } = {}) {
  assertRole(actor, ["OWNER", "ADMIN", "VIEWER"]);
  const { from, to } = financialPeriodSchema.parse(period);
  return financeRepository.list(prisma, actor.organizationId, from || to ? { dueDate: { gte: from, lte: to } } : {});
}

export async function listFinancialCategories(actor: Actor) {
  assertRole(actor, ["OWNER", "ADMIN", "VIEWER"]);
  return financeRepository.listCategories(prisma, actor.organizationId);
}

export async function createFinancialCategory(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN"]);
  const data = financialCategorySchema.parse(input);
  return transaction(async (tx) => {
    const category = await financeRepository.createCategory(tx, { ...data, organizationId: actor.organizationId });
    await audit(tx, actor, "CREATE", "FinancialCategory", category.id, { name: data.name, type: data.type });
    return category;
  });
}

export async function createFinancialEntry(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN"]);
  const data = financialEntrySchema.parse(input);
  const paidAt = data.status === "PAID" ? data.paidAt ?? new Date() : null;
  if (paidAt && paidAt > new Date()) throw new DomainError("A data do pagamento não pode estar no futuro.");
  if (data.status !== "PAID" && data.paidAt) throw new DomainError("Informe a data de pagamento somente para lançamentos pagos.");
  return transaction(async (tx) => {
    const category = await financeRepository.findCategory(tx, actor.organizationId, data.categoryId);
    if (!category) throw new DomainError("Categoria financeira não encontrada.", 404);
    if (category.type !== data.type) throw new DomainError("A categoria deve corresponder ao tipo de lançamento.");
    const entry = await financeRepository.create(tx, {
      ...data, amount: new Prisma.Decimal(data.amount), organizationId: actor.organizationId,
      createdBy: actor.userId, paidAt,
    });
    await audit(tx, actor, "CREATE", "FinancialEntry", entry.id, { amount: entry.amount.toString(), status: entry.status, type: entry.type });
    return entry;
  });
}

export async function payFinancialEntry(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN"]);
  const { id, paidAt: inputPaidAt } = payFinancialEntrySchema.parse(input);
  const paidAt = inputPaidAt ?? new Date();
  if (paidAt > new Date()) throw new DomainError("A data do pagamento não pode estar no futuro.");
  return transaction(async (tx) => {
    const entry = await financeRepository.find(tx, actor.organizationId, id);
    if (!entry) throw new DomainError("Lançamento financeiro não encontrado.", 404);
    validatePayment(entry.status);
    await financeRepository.update(tx, actor.organizationId, id, { status: "PAID", paidAt });
    await audit(tx, actor, "PAID", "FinancialEntry", id, { amount: entry.amount.toString(), paidAt: paidAt.toISOString() });
    return financeRepository.find(tx, actor.organizationId, id);
  });
}

export async function cancelFinancialEntry(actor: Actor, input: unknown) {
  assertRole(actor, ["OWNER", "ADMIN"]);
  const { id, reason } = cancelFinancialEntrySchema.parse(input);
  return transaction(async (tx) => {
    const entry = await financeRepository.find(tx, actor.organizationId, id);
    if (!entry) throw new DomainError("Lançamento financeiro não encontrado.", 404);
    validateFinancialCancellation(entry.status, entry.referenceType);
    await financeRepository.update(tx, actor.organizationId, id, { status: "CANCELED", cancellationReason: reason });
    await audit(tx, actor, "CANCELED", "FinancialEntry", id, { reason });
    return financeRepository.find(tx, actor.organizationId, id);
  });
}

export async function financialSummary(actor: Actor, period: { from?: Date | string; to?: Date | string } = {}) {
  assertRole(actor, ["OWNER", "ADMIN", "VIEWER"]);
  const { from, to } = financialPeriodSchema.parse(period);
  const dateRange = from || to ? { gte: from, lte: to } : undefined;
  const [paid, pending, purchaseEntries, allPaid] = await Promise.all([
    financeRepository.list(prisma, actor.organizationId, { status: "PAID", paidAt: dateRange }),
    financeRepository.list(prisma, actor.organizationId, { status: "PENDING" }),
    financeRepository.list(prisma, actor.organizationId, { status: { not: "CANCELED" }, referenceType: "GOODS_RECEIPT", createdAt: dateRange }),
    financeRepository.list(prisma, actor.organizationId, { status: "PAID" }),
  ]);
  const cash = summarizeFinancialEntries(paid);
  const liabilities = summarizeFinancialEntries(pending);
  return {
    income: cash.income, expenses: cash.expenses, result: cash.result,
    balance: summarizeFinancialEntries(allPaid).result,
    accountsPayable: liabilities.accountsPayable, pendingIncome: liabilities.pendingIncome,
    purchases: summarizeFinancialEntries(purchaseEntries).purchases,
  };
}
