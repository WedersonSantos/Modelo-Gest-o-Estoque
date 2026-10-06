import { z } from "zod";

const isCalendarDate = (input: unknown): input is string => typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input);
function parseBusinessDate(input: unknown, endOfDay = false) {
  if (typeof input !== "string") return input;
  const day = input.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day) return new Date(NaN);
  const calendar = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) return new Date(NaN);
  if (isCalendarDate(input)) return new Date(`${input}T${endOfDay ? "23:59:59.999" : "00:00:00"}-03:00`);
  return new Date(input);
}
const businessDate = z.preprocess((input) => parseBusinessDate(input), z.date());
const businessPeriodEnd = z.preprocess((input) => parseBusinessDate(input, true), z.date());

export const financialCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export const financialEntrySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().min(1),
  description: z.string().trim().min(3).max(300),
  amount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Informe um valor com até 2 casas decimais.")
    .refine((value) => /[1-9]/.test(value), "O valor deve ser maior que zero."),
  dueDate: businessDate,
  status: z.enum(["PENDING", "PAID"]).default("PENDING"),
  paidAt: businessDate.optional().nullable(),
});

export const payFinancialEntrySchema = z.object({ id: z.string().min(1), paidAt: businessDate.optional().nullable() });
export const cancelFinancialEntrySchema = z.object({ id: z.string().min(1), reason: z.string().trim().min(3).max(1000) });
export const financialPeriodSchema = z.object({ from: businessDate.optional(), to: businessPeriodEnd.optional() })
  .refine((period) => !period.from || !period.to || period.from <= period.to, "O início deve anteceder o fim do período.");

export type FinancialEntryInput = z.input<typeof financialEntrySchema>;
