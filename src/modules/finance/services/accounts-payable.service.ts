import { Prisma } from "@prisma/client";
import type { Actor } from "@/shared/lib/auth";
import { audit } from "@/shared/lib/audit";
import { financeRepository } from "../repositories/financial-entry.repository";

/** Internal transactional interface. The caller must have authorized and validated the goods receipt. */
export async function createPurchasePayable(tx: Prisma.TransactionClient, actor: Actor, input: { receiptId: string; supplierName: string; amount: Prisma.Decimal; receivedAt: Date }) {
  if (input.amount.isZero()) return null;
  const category = await financeRepository.purchaseCategory(tx, actor.organizationId);
  const entry = await financeRepository.create(tx, {
    organizationId: actor.organizationId, categoryId: category.id, type: "EXPENSE",
    description: `Compra - ${input.supplierName}`, amount: input.amount,
    status: "PENDING", dueDate: input.receivedAt, createdBy: actor.userId,
    referenceType: "GOODS_RECEIPT", referenceId: input.receiptId,
  });
  await audit(tx, actor, "PURCHASE_PAYABLE_CREATED", "FinancialEntry", entry.id, { receiptId: input.receiptId, amount: input.amount.toString() });
  return entry;
}
