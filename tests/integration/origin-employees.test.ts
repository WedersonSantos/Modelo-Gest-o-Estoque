import "./setup";
import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { prisma } from "@/shared/lib/prisma";
import { registerOrganization,createUser } from "@/modules/settings";
import { createEmployee,updateEmployee,setEmployeeActive,saveJobRole,listEmployees,getEmployee,employeeOptions } from "@/modules/employees/employee.service";
import { createProduct,updateProduct,getProduct,listInventory,getStockNeeds } from "@/modules/inventory";
import { createSupplier,updateSupplier,setSupplierPrice } from "@/modules/suppliers";
import { supplierCountries } from "@/modules/inventory/schemas/origin.schema";
import type { Actor } from "@/shared/types/actor";
let owner:Actor,foreign:Actor,kitchen:Actor,buyer:Actor,roleId:string,employeeId:string;
const suffix=randomUUID(),employee={name:"Funcionário fictício",phone:"(00) 90000-0000",email:"funcionario@example.test",department:"Cozinha",responsibilities:"Preparo dos pratos\nComunicação de perdas",hiredAt:"2026-01-10"};
beforeAll(async()=>{
 const u=await registerOrganization({organizationName:"Origem e equipe "+suffix,name:"Responsável",email:suffix+"@example.test",password:"Teste123456!"});owner={userId:u.id,organizationId:u.organizationId,role:"OWNER"};
 const f=await registerOrganization({organizationName:"Outra equipe "+suffix,name:"Responsável",email:"foreign-"+suffix+"@example.test",password:"Teste123456!"});foreign={userId:f.id,organizationId:f.organizationId,role:"OWNER"};
 for(const role of ["KITCHEN","BUYER"] as const){const user=await createUser(owner,{name:role,email:role+suffix+"@example.test",password:"Teste123456!",role});const actor={...owner,userId:user.id,role};if(role==="KITCHEN")kitchen=actor;else buyer=actor;}
 roleId=(await saveJobRole(owner,{name:"Cozinheiro",description:"Preparo e mise en place"})).id;
});
afterAll(async()=>{await prisma.$disconnect();});
describe("funcionários e funções",()=>{
 it("cadastra funcionário sem criar usuário, com função e responsabilidades",async()=>{
  const before=await prisma.user.count({where:{organizationId:owner.organizationId}});
  const e=await createEmployee(owner,{...employee,jobRoleId:roleId});employeeId=e.id;
  expect(e.userId).toBeNull();expect(e.jobRole?.name).toBe("Cozinheiro");expect(e.responsibilities).toContain("perdas");
  expect(await prisma.user.count({where:{organizationId:owner.organizationId}})).toBe(before);
 });
 it("edita e atualiza nome da função sem derivar permissões",async()=>{
  await saveJobRole(owner,{id:roleId,name:"Cozinheiro responsável",description:"Mise en place"});
  const e=await updateEmployee(owner,{...employee,id:employeeId,jobRoleId:roleId,department:"Cafeteria",responsibilities:"Atendimento\nPreparo de bebidas"});
  expect(e.department).toBe("Cafeteria");expect(e.jobRole?.name).toBe("Cozinheiro responsável");
 });
 it("associa Employee a User e mantém o role existente mesmo com cargo Gerente",async()=>{
  const manager=(await saveJobRole(owner,{name:"Gerente"})).id;
  await updateEmployee(owner,{...employee,id:employeeId,jobRoleId:manager,userId:kitchen.userId});
  expect((await getEmployee(owner,employeeId)).user?.role).toBe("KITCHEN");
  expect((await prisma.user.findFirstOrThrow({where:{id:kitchen.userId,organizationId:owner.organizationId}})).role).toBe("KITCHEN");
  await expect(createEmployee(owner,{name:"Segundo funcionário",userId:kitchen.userId})).rejects.toThrow("já está vinculado");
 });
 it("ativa e inativa o cadastro sem alterar o acesso da conta",async()=>{
  await setEmployeeActive(owner,{id:employeeId,active:false});
  expect((await getEmployee(owner,employeeId)).active).toBe(false);
  expect((await prisma.user.findFirstOrThrow({where:{id:kitchen.userId,organizationId:owner.organizationId}})).active).toBe(true);
  expect((await listEmployees(owner,{active:false})).employees.map(e=>e.id)).toContain(employeeId);
  await setEmployeeActive(owner,{id:employeeId,active:true});expect((await getEmployee(owner,employeeId)).active).toBe(true);
 });
 it("pesquisa e filtra por função e setor",async()=>{
  await updateEmployee(owner,{...employee,id:employeeId,jobRoleId:roleId,userId:null,department:"Cafeteria"});
  for(const search of ["fictício","funcionario@example.test","90000"]){expect((await listEmployees(owner,{search})).employees.map(e=>e.id)).toContain(employeeId);}
  expect((await listEmployees(owner,{jobRoleId:roleId,department:"Cafeteria"})).employees.map(e=>e.id)).toContain(employeeId);
  expect((await listEmployees(owner,{department:"Salão"})).employees).toEqual([]);
 });
 it("recusa gestão para KITCHEN, BUYER, OPERATOR e VIEWER",async()=>{
  for(const role of ["KITCHEN","BUYER","OPERATOR","VIEWER"] as const){
   const actor={...owner,role};
   await expect(listEmployees(actor)).rejects.toThrow("perfil");await expect(employeeOptions(actor)).rejects.toThrow("perfil");
   await expect(createEmployee(actor,employee)).rejects.toThrow("perfil");await expect(updateEmployee(actor,{...employee,id:employeeId})).rejects.toThrow("perfil");
   await expect(saveJobRole(actor,{name:"Função"})).rejects.toThrow("perfil");await expect(setEmployeeActive(actor,{id:employeeId,active:false})).rejects.toThrow("perfil");
  }
 });
 it("isola consultas e mutações de funcionários, funções e contas",async()=>{
  const externalRole=(await saveJobRole(foreign,{name:"Função externa"})).id;
  expect((await listEmployees(foreign)).employees).toEqual([]);expect((await employeeOptions(foreign)).jobRoles.map(r=>r.id)).not.toContain(roleId);
  await expect(getEmployee(foreign,employeeId)).rejects.toThrow("não encontrado");
  await expect(updateEmployee(foreign,{...employee,id:employeeId})).rejects.toThrow("não encontrado");
  await expect(setEmployeeActive(foreign,{id:employeeId,active:false})).rejects.toThrow("não encontrado");
  await expect(saveJobRole(foreign,{id:roleId,name:"Inválida"})).rejects.toThrow("não encontrada");
  await expect(createEmployee(owner,{...employee,jobRoleId:externalRole})).rejects.toThrow("não encontrada");
  await expect(createEmployee(owner,{...employee,userId:foreign.userId})).rejects.toThrow("não encontrado");
  await expect(prisma.employee.update({where:{id:employeeId},data:{jobRoleId:externalRole}})).rejects.toThrow();
  await expect(prisma.employee.update({where:{id:employeeId},data:{userId:foreign.userId}})).rejects.toThrow();
 });
 it("não expõe hashes nas opções nem nos perfis",async()=>{
  expect((await employeeOptions(owner)).users[0]).not.toHaveProperty("passwordHash");
  const e=await updateEmployee(owner,{...employee,id:employeeId,userId:buyer.userId});
  expect(e.user).not.toHaveProperty("passwordHash");
 });
});
describe("origem dos ingredientes",()=>{
 const base={name:"Ingrediente nacional",unit:"KG",minimumStock:"3",idealStock:"9"};
 let importedId:string;
 it("mantém produto nacional e BRL como padrão compatível",async()=>{
  const p=await createProduct(owner,base);
  expect(p.originType).toBe("NATIONAL");expect(p.purchaseCurrency).toBe("BRL");expect(p.averageLeadTimeDays).toBeNull();
  expect(p.currentStock).toBe("0");expect(p.belowMinimum).toBe(true);
 });
 it("cadastra produto importado com país independente da moeda e prazo",async()=>{
  const p=await createProduct(owner,{...base,name:"Tahine importado",originType:"IMPORTED",countryOfOrigin:"Lebanon",purchaseCurrency:"USD",averageLeadTimeDays:30,originNotes:"Origem fictícia"});importedId=p.id;
  expect(p).toMatchObject({originType:"IMPORTED",countryOfOrigin:"Lebanon",purchaseCurrency:"USD",averageLeadTimeDays:30});
 });
 it("deriva país do fornecedor sem confundir com origem do produto",async()=>{
  const s=await createSupplier(owner,{name:"Fornecedor nacional",country:"Brazil"});
  expect((await updateSupplier(owner,{id:s.id,name:"Fornecedor nacional atualizado"}))?.country).toBe("Brazil");
  await setSupplierPrice(owner,{supplierId:s.id,productId:importedId,price:"10"});
  const p=(await listInventory(owner)).products.find(p=>p.id===importedId)!;
  expect(p.countryOfOrigin).toBe("Lebanon");expect(supplierCountries(p)).toEqual(["Brazil"]);
 });
 it("filtra por origem e mantém isolamento",async()=>{
  expect((await listInventory(owner,{originType:"IMPORTED"})).products.map(p=>p.id)).toContain(importedId);
  expect((await listInventory(owner,{originType:"NATIONAL"})).products.map(p=>p.id)).not.toContain(importedId);
  expect((await listInventory(foreign,{originType:"IMPORTED"})).products).toEqual([]);
  await expect(getProduct(foreign,importedId)).rejects.toThrow("não encontrado");
  await expect(updateProduct(foreign,{...base,id:importedId})).rejects.toThrow("não encontrado");
  await expect(listInventory(kitchen)).rejects.toThrow("perfil");
  expect((await listInventory(buyer)).products.length).toBeGreaterThan(0);
 });
 it("edição antiga não apaga origem e prazo não modifica alerta ou sugestão atuais",async()=>{
  const before=(await getStockNeeds(owner)).find(p=>p.id===importedId)!;
  const p=await updateProduct(owner,{...base,id:importedId,name:"Tahine editado"});
  expect(p.originType).toBe("IMPORTED");expect(p.countryOfOrigin).toBe("Lebanon");expect(p.averageLeadTimeDays).toBe(30);
  const after=(await getStockNeeds(owner)).find(p=>p.id===importedId)!;expect(after.suggestedQuantity).toBe(before.suggestedQuantity);expect(after.belowMinimum).toBe(before.belowMinimum);
 });
 it("edita e limpa metadados de origem sem tocar saldo ou custo",async()=>{
  const changed=await updateProduct(owner,{...base,id:importedId,name:"Tahine atualizado",originType:"IMPORTED",countryOfOrigin:"Turkey",supplierCountry:"Portugal",purchaseCurrency:"EUR",averageLeadTimeDays:45,originNotes:"Outra origem"});
  expect(changed).toMatchObject({originType:"IMPORTED",countryOfOrigin:"Turkey",supplierCountry:"Portugal",purchaseCurrency:"EUR",averageLeadTimeDays:45,originNotes:"Outra origem",currentStock:"0",averageCost:"0"});
  const cleared=await updateProduct(owner,{...base,id:importedId,name:"Tahine atualizado",countryOfOrigin:null,supplierCountry:null,averageLeadTimeDays:null,originNotes:null});
  expect(cleared).toMatchObject({countryOfOrigin:null,supplierCountry:null,averageLeadTimeDays:null,originNotes:null});
 });
 it("aceita importado sem país informado e rejeita prazos negativos no SQL",async()=>{
  const p=await createProduct(owner,{...base,name:"Importado sem país",originType:"IMPORTED"});
  expect(p.countryOfOrigin).toBeNull();
  await expect(prisma.product.update({where:{id:p.id},data:{averageLeadTimeDays:-1}})).rejects.toThrow();
 });
});
