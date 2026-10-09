import { describe,expect,it } from "vitest";
import { customerSchema,normalizePhone,whatsappUrl } from "@/modules/customers/customer.rules";
describe("cadastro de clientes",()=>{
 it("exige apenas nome e não cria campos de CPF ou saúde",()=>{
  const d=customerSchema.parse({name:" Cliente teste ",cpf:"123",health:"ignorar"});
  expect(d.name).toBe("Cliente teste");expect(d.phone).toBeNull();expect(d.marketingConsent).toBe(false);expect(d).not.toHaveProperty("cpf");expect(d).not.toHaveProperty("health");
 });
 it("normaliza números locais e internacionais para comparação",()=>{
  expect(normalizePhone("(11) 99999-1234")).toBe("5511999991234");
  expect(normalizePhone("+55 11 99999-1234")).toBe("5511999991234");
  expect(normalizePhone("0055 11 99999-1234")).toBe("5511999991234");expect(normalizePhone("")).toBeNull();expect(normalizePhone("+1 212 555 1234")).toBe("12125551234");
 });
 it("gera WhatsApp somente para um número válido",()=>{
  expect(whatsappUrl("(11) 99999-1234")).toBe("https://wa.me/5511999991234");
  expect(whatsappUrl("+1 212 555 1234")).toBe("https://wa.me/12125551234");expect(whatsappUrl("+55 00 0000 0000")).toBeNull();expect(whatsappUrl("123")).toBeNull();expect(whatsappUrl("00000000000")).toBeNull();expect(whatsappUrl(null)).toBeNull();
 });
 it("valida nascimento e campos limitados",()=>{
  for(const birthDate of ["2025-02-30","3000-01-01","ontem"])expect(customerSchema.safeParse({name:"Cliente",birthDate}).success).toBe(false);
  expect(customerSchema.safeParse({name:"Cliente",birthDate:"2000-02-29"}).success).toBe(true);
  expect(customerSchema.safeParse({name:"Cliente",notes:"x".repeat(1001)}).success).toBe(false);
 });
});
