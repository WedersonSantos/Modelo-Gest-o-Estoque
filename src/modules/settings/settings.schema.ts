import { FinancialType, Role } from "@prisma/client";
import { z } from "zod";

const bcryptLength = (value: string) => new TextEncoder().encode(value).length <= 72;
export const passwordSchema = z.string().min(10, "Use uma senha com pelo menos 10 caracteres.").max(72).regex(/[a-zA-Z]/, "Inclua uma letra na senha.").regex(/[0-9]/, "Inclua um número na senha.").refine(bcryptLength, "A senha deve ter no máximo 72 bytes.");
export const emailSchema = z.string().trim().email("Informe um e-mail válido.").max(254).transform((v) => v.toLowerCase());
export const registerSchema = z.object({ organizationName: z.string().trim().min(2).max(120), name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(72).refine(bcryptLength, "Senha inválida.") });
export const createUserSchema = z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema, role: z.enum(Role) });
export const categorySchema = z.object({ name: z.string().trim().min(2).max(80) });
export const financialCategorySchema = categorySchema.extend({ type: z.enum(FinancialType) });
