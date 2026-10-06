import { z } from "zod";

// PostgreSQL Decimal(14,4): ten whole digits, four fractional digits.
export const nonnegativeDecimalSchema = z.string().trim()
  .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,4})?$/, "Use um número positivo com até quatro casas decimais e ponto como separador.");

export const positiveDecimalSchema = nonnegativeDecimalSchema.refine(
  (value) => !/^0(?:\.0+)?$/.test(value),
  "A quantidade deve ser maior que zero.",
);

const identifier = z.string().trim().min(1).max(100);
const shortText = z.string().trim().max(2000).optional();
export const productUnitSchema = z.enum(["KG", "G", "L", "ML", "UNIT", "PACKAGE", "BOX"]);
export const usageContextSchema = z.enum(["RESTAURANT", "EVENT", "OTHER"]);

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do ingrediente.").max(160),
  description: shortText,
  categoryId: identifier.nullable().optional(),
  unit: productUnitSchema,
  minimumStock: nonnegativeDecimalSchema,
  idealStock: nonnegativeDecimalSchema,
});

export const updateProductSchema = createProductSchema.extend({
  id: identifier,
  active: z.boolean().optional(),
});

export const createProductCategorySchema = z.object({ name: z.string().trim().min(2).max(100) });

export const recordMovementSchema = z.object({
  productId: identifier,
  type: z.enum(["CONSUMPTION", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "LOSS", "OTHER"]),
  quantity: positiveDecimalSchema,
  unitCost: nonnegativeDecimalSchema.optional(),
  direction: z.enum(["IN", "OUT"]).optional(),
  usageContext: usageContextSchema.default("RESTAURANT"),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: identifier.optional(),
  notes: shortText,
}).superRefine((input, context) => {
  const expectedDirection = input.type === "ADJUSTMENT_IN" ? "IN" : "OUT";
  if (input.type !== "OTHER" && input.direction && input.direction !== expectedDirection) {
    context.addIssue({ code: "custom", path: ["direction"], message: "A direção não corresponde ao tipo de movimentação." });
  }
  if (input.type === "OTHER" && !input.direction) {
    context.addIssue({ code: "custom", path: ["direction"], message: "Informe se a movimentação é entrada ou saída." });
  }
  if (["OTHER", "LOSS", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].includes(input.type) && !input.notes?.trim()) {
    context.addIssue({ code: "custom", path: ["notes"], message: "Informe o motivo da movimentação." });
  }
});

export const receiveStockSchema = z.object({
  productId: identifier,
  quantity: positiveDecimalSchema,
  unitCost: nonnegativeDecimalSchema,
  usageContext: usageContextSchema.default("RESTAURANT"),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: identifier.optional(),
  notes: shortText,
});

export const createInventoryCountSchema = z.object({ notes: shortText });

export const finishInventoryCountSchema = z.object({
  id: identifier,
  items: z.array(z.object({ productId: identifier, countedQuantity: nonnegativeDecimalSchema })).min(1).max(2000),
}).superRefine((input, context) => {
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Cada ingrediente deve aparecer apenas uma vez." });
  }
});

export const cancelInventoryCountSchema = z.object({ id: identifier });

export const inventoryReportFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  productId: identifier.optional(),
  usageContext: usageContextSchema.optional(),
}).superRefine((input, context) => {
  if (input.from && input.to && input.from > input.to) {
    context.addIssue({ code: "custom", path: ["to"], message: "A data final deve ser igual ou posterior à data inicial." });
  }
});

export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type RecordMovementInput = z.input<typeof recordMovementSchema>;
export type ReceiveStockInput = z.input<typeof receiveStockSchema>;
export type CreateInventoryCountInput = z.input<typeof createInventoryCountSchema>;
export type FinishInventoryCountInput = z.input<typeof finishInventoryCountSchema>;
export type InventoryReportFilter = z.input<typeof inventoryReportFilterSchema>;
