import { Prisma } from "@prisma/client";
import { DomainError } from "@/shared/lib/errors";
import { dec } from "@/shared/lib/money";

type Entry = { type: "INCOME" | "EXPENSE"; status: "PENDING" | "PAID" | "CANCELED"; amount: Prisma.Decimal.Value; referenceType?: string | null };

export function summarizeFinancialEntries(entries: Entry[]) {
  let income = dec(0);
  let expenses = dec(0);
  let pendingIncome = dec(0);
  let accountsPayable = dec(0);
  let purchases = dec(0);
  for (const entry of entries) {
    if (entry.status === "CANCELED") continue;
    const amount = dec(entry.amount);
    if (entry.status === "PAID") {
      if (entry.type === "INCOME") income = income.plus(amount);
      else expenses = expenses.plus(amount);
    } else if (entry.type === "INCOME") pendingIncome = pendingIncome.plus(amount);
    else accountsPayable = accountsPayable.plus(amount);
    if (entry.referenceType === "GOODS_RECEIPT" && entry.type === "EXPENSE") purchases = purchases.plus(amount);
  }
  return { income, expenses, result: income.minus(expenses), pendingIncome, accountsPayable, purchases };
}

export function validatePayment(status: Entry["status"]) {
  if (status !== "PENDING") throw new DomainError("Apenas lançamentos pendentes podem ser pagos.");
}

export function validateFinancialCancellation(status: Entry["status"], referenceType?: string | null) {
  if (status !== "PENDING") throw new DomainError("Apenas lançamentos pendentes podem ser cancelados. Pagamentos realizados permanecem no histórico.");
  if (referenceType === "GOODS_RECEIPT") throw new DomainError("A conta gerada por um recebimento deve permanecer no histórico da compra. Registre uma compensação financeira quando necessário.");
}
