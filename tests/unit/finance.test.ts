import { describe, expect, it } from "vitest";
import { summarizeFinancialEntries, validatePayment, validateFinancialCancellation } from "@/modules/finance/services/finance.rules";
import { financialEntrySchema, financialPeriodSchema, payFinancialEntrySchema } from "@/modules/finance/schemas/finance.schema";

describe("controle financeiro gerencial", () => {
  it("separa caixa realizado, contas pendentes e compras recebidas", () => {
    const result = summarizeFinancialEntries([
      { type: "INCOME", status: "PAID", amount: "100.10" },
      { type: "INCOME", status: "PAID", amount: "0.20" },
      { type: "EXPENSE", status: "PAID", amount: "20.30", referenceType: "GOODS_RECEIPT" },
      { type: "EXPENSE", status: "PENDING", amount: "50", referenceType: "GOODS_RECEIPT" },
      { type: "INCOME", status: "PENDING", amount: "15" },
      { type: "EXPENSE", status: "CANCELED", amount: "999", referenceType: "GOODS_RECEIPT" },
    ]);
    expect(result.income.toString()).toBe("100.3");
    expect(result.expenses.toString()).toBe("20.3");
    expect(result.result.toString()).toBe("80");
    expect(result.accountsPayable.toString()).toBe("50");
    expect(result.pendingIncome.toString()).toBe("15");
    expect(result.purchases.toString()).toBe("70.3");
  });
  it("permite pagamento uma vez e mantém pagamentos no histórico", () => {
    expect(() => validatePayment("PENDING")).not.toThrow();
    expect(() => validatePayment("PAID")).toThrow();
    expect(() => validatePayment("CANCELED")).toThrow();
    expect(() => validateFinancialCancellation("PAID")).toThrow();
    expect(() => validateFinancialCancellation("PENDING", "GOODS_RECEIPT")).toThrow();
    expect(() => validateFinancialCancellation("PENDING")).not.toThrow();
  });
  it("não aceita valores negativos, zerados ou com centavos fracionados", () => {
    const entry = { type: "INCOME", categoryId: "categoria", description: "Venda diária", dueDate: "2026-10-05" };
    for (const amount of ["-1", "0", "0.00", "1.001", "NaN"]) expect(financialEntrySchema.safeParse({ ...entry, amount }).success).toBe(false);
    expect(financialEntrySchema.safeParse({ ...entry, amount: "0.01" }).success).toBe(true);
  });
  it("preserva o dia de São Paulo nas datas do formulário e inclui o último dia do período", () => {
    const entry = financialEntrySchema.parse({ type: "INCOME", categoryId: "categoria", description: "Venda diária", dueDate: "2026-10-05", paidAt: "2026-10-05", amount: "1", status: "PAID" });
    expect(entry.dueDate.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(entry.paidAt?.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    const period = financialPeriodSchema.parse({ from: "2026-10-05", to: "2026-10-05" });
    expect(period.from?.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(period.to?.toISOString()).toBe("2026-10-06T02:59:59.999Z");
    expect(payFinancialEntrySchema.parse({ id: "lancamento", paidAt: "2026-10-05T17:35:00Z" }).paidAt?.toISOString()).toBe("2026-10-05T17:35:00.000Z");
  });
  it("rejeita datas de calendário inválidas e valores nulos para o vencimento", () => {
    const entry = { type: "INCOME", categoryId: "categoria", description: "Venda diária", amount: "1" };
    for (const dueDate of ["2026-02-31", "2026-02-31T10:00:00Z", null, 0, ""]) expect(financialEntrySchema.safeParse({ ...entry, dueDate }).success).toBe(false);
    expect(financialEntrySchema.safeParse({ ...entry, dueDate: "2028-02-29" }).success).toBe(true);
  });
});
