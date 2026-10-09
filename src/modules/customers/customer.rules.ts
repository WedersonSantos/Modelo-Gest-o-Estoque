import { z } from "zod";

export function normalizePhone(value: string | null | undefined): string | null {
  let digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^(\+|00)/.test((value ?? "").trim()) && (digits.length === 10 || digits.length === 11)) digits = "55" + digits;
  return digits;
}
export function whatsappUrl(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  // Brazil: DDD + eight/nine digit subscriber. Other countries require an explicit + prefix.
  if (!normalized) return null;
  const brazil = /^55[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(normalized);
  const international = (phone ?? "").trim().startsWith("+") && /^[1-9]\d{7,14}$/.test(normalized);
  return brazil || (!normalized.startsWith("55") && international) ? "https://wa.me/" + normalized : null;
}
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform(v => v || null);
export const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  phone: optionalText(40),
  email: z.union([z.email().max(254), z.literal("")]).nullish().transform(v => v?.toLowerCase() || null),
  birthDate: z.string().nullish().transform(v => v || null).refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v && v <= new Date().toISOString().slice(0, 10)), "Informe uma data de nascimento válida, sem data futura."),
  notes: optionalText(1000),
  active: z.boolean().default(true),
  marketingConsent: z.boolean().default(false),
});
export type CustomerInput = z.input<typeof customerSchema>;
