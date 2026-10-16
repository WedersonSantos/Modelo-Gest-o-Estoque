import { describe,it,expect } from "vitest";
import { createProductSchema,updateProductSchema } from "@/modules/inventory";
import { supplierCountries } from "@/modules/inventory/schemas/origin.schema";
import { acquisitionCostBreakdown } from "@/modules/inventory/services/acquisition-cost";
import { employeeSchema } from "@/modules/employees/employee.schema";
const product={name:"Tahine",unit:"KG",minimumStock:"1",idealStock:"5"};
describe("origem e funcionários",()=>{
 it("preserva compatibilidade com payloads antigos sem apagar metadados",()=>{
  const d=updateProductSchema.parse({...product,id:"id"});
  for(const key of ["originType","countryOfOrigin","supplierCountry","purchaseCurrency","averageLeadTimeDays","originNotes"])expect(d).not.toHaveProperty(key);
 });
 it("valida origem, moeda e prazo sem exigir país",()=>{
  expect(createProductSchema.parse({...product,originType:"IMPORTED",purchaseCurrency:"usd",averageLeadTimeDays:"30"})).toMatchObject({originType:"IMPORTED",purchaseCurrency:"USD",averageLeadTimeDays:30});
  for(const averageLeadTimeDays of [-1,1.5,4000])expect(createProductSchema.safeParse({...product,averageLeadTimeDays}).success).toBe(false);
  expect(createProductSchema.safeParse({...product,purchaseCurrency:"DOLAR"}).success).toBe(false);
 });
 it("distingue origem do produto e países dos fornecedores sem escolher um arbitrariamente",()=>{
  const suppliers=[{supplier:{country:"Brazil"}},{supplier:{country:"Brazil"}},{supplier:{country:"Turkey"}}];
  expect(supplierCountries({suppliers})).toEqual(["Brazil","Turkey"]);
  expect(supplierCountries({supplierCountry:"Portugal",suppliers})).toEqual(["Portugal"]);
 });
 it("compõe frete, taxas e importação na mesma moeda, sem alterar estoque",()=>{
  expect(acquisitionCostBreakdown({currency:"USD",merchandise:"100",freight:"10",additionalFees:"2",importCosts:"8"}).total).toBe("120.00");
  expect(acquisitionCostBreakdown({currency:"BRL",merchandise:"2.55"}).total).toBe("2.55");
  expect(()=>acquisitionCostBreakdown({currency:"BRL",merchandise:"-1"})).toThrow();
 });
 it("permite funcionário sem função ou usuário e responsabilidades multilinha",()=>{
  const d=employeeSchema.parse({name:"Funcionário fictício",responsibilities:"Atendimento\nOrganização"});
  expect(d.userId).toBeNull();expect(d.jobRoleId).toBeNull();expect(d.active).toBe(true);expect(d.responsibilities).toContain("\n");
 });
 it("rejeita admissão inválida",()=>{
  expect(employeeSchema.safeParse({name:"Funcionário",hiredAt:"2026-02-30"}).success).toBe(false);
 });
});
