import { z } from "zod";

const optionalText = z.string().trim().max(1000).nullable().optional().transform((value) => value || null);
const decimal = z.string().regex(/^\d{1,9}(\.\d{1,4})?$/, "Informe um valor positivo com até 4 casas decimais.");

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do fornecedor.").max(120),
  companyName: optionalText,
  document: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: z.union([z.email(), z.literal("")]).nullable().optional().transform((value) => value || null),
  address: optionalText,
  notes: optionalText,
  active: z.boolean().default(true),
});

export const updateSupplierSchema = supplierSchema.extend({ id: z.string().min(1), active: z.boolean().optional() });

export const supplierPriceSchema = z.object({
  supplierId: z.string().min(1),
  productId: z.string().min(1),
  price: decimal,
  minimumOrderQuantity: decimal.default("0"),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(0),
  paymentTerms: optionalText,
  notes: optionalText,
});

export type SupplierInput = z.input<typeof supplierSchema>;
export type SupplierPriceInput = z.input<typeof supplierPriceSchema>;
