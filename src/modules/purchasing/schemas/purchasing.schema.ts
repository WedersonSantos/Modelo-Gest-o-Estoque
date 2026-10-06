import { z } from "zod";

const quantity = z.string().regex(/^\d{1,9}(\.\d{1,4})?$/, "Quantidade inválida: utilize até 4 casas decimais.").refine((value) => /[1-9]/.test(value), "A quantidade deve ser maior que zero.");
const money = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Valor inválido: utilize até 2 casas decimais.");
const optionalText = z.string().trim().max(2000).nullable().optional().transform((value) => value || null);
const validityDate = z.preprocess((input) => {
  if (typeof input !== "string") return input;
  const day = input.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day) return new Date(NaN);
  const calendar = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) return new Date(NaN);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00-03:00` : input);
}, z.date());

export const updatePurchaseRequestSchema = z.object({
  id: z.string().min(1),
  items: z.array(z.object({ productId: z.string().min(1), requestedQuantity: quantity })).min(1).max(500)
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, "Produtos repetidos na lista."),
});

export const quoteSchema = z.object({
  purchaseRequestId: z.string().min(1),
  supplierId: z.string().min(1),
  validUntil: validityDate.optional().nullable(),
  freight: money.default("0"),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(0),
  paymentTerms: optionalText,
  qualityNotes: optionalText,
  notes: optionalText,
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity,
    unitPrice: z.string().regex(/^\d{1,9}(\.\d{1,4})?$/, "Preço inválido: utilize até 4 casas decimais."),
    available: z.boolean().default(true),
    notes: optionalText,
  })).min(1).max(500).refine((items) => new Set(items.map((item) => item.productId)).size === items.length, "Produtos repetidos na cotação."),
});

export const purchaseOrderSchema = z.object({
  quoteId: z.string().min(1),
  selectionReason: z.string().trim().min(3, "Registre o motivo da escolha.").max(2000),
});

export const purchaseOrderTransitionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING_APPROVAL", "APPROVED", "ORDERED", "CANCELED"]),
});

export const receivePurchaseOrderSchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(8).max(100),
  items: z.array(z.object({ orderItemId: z.string().min(1), quantity })).min(1).max(500)
    .refine((items) => new Set(items.map((item) => item.orderItemId)).size === items.length, "Itens repetidos no recebimento."),
});

export type QuoteInput = z.input<typeof quoteSchema>;
export type ReceivePurchaseOrderInput = z.input<typeof receivePurchaseOrderSchema>;
