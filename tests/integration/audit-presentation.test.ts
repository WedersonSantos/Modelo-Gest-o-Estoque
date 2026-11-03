import "./setup";
import {randomUUID} from "node:crypto";
import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {prisma} from "@/shared/lib/prisma";
import {registerOrganization} from "@/modules/settings";
import {createSupplier} from "@/modules/suppliers";
import {createCustomer} from "@/modules/customers/customer.service";
import {getAuditHistory} from "@/modules/settings/audit-query";
import type {Actor} from "@/shared/types/actor";
let owner:Actor,foreign:Actor,supplierId:string,foreignSupplierId:string,customerId:string;
const suffix=randomUUID();
beforeAll(async()=>{
 for(const external of [false,true]){
  const u=await registerOrganization({organizationName:"Auditoria "+external+" "+suffix,name:"Responsável",email:external+"-audit-"+suffix+"@example.test",password:"Teste123456!"});
  const actor:Actor={userId:u.id,organizationId:u.organizationId,role:"OWNER"};if(external)foreign=actor;else owner=actor;
 }
 supplierId=(await createSupplier(owner,{name:"Fornecedor histórico"})).id;
 foreignSupplierId=(await createSupplier(foreign,{name:"Fornecedor de outra organização"})).id;
 customerId=(await createCustomer(owner,{name:"Cliente legível"})).customer.id;
 await prisma.supplier.update({where:{id:supplierId},data:{name:"Fornecedor atual"}});
});
afterAll(async()=>{await prisma.$disconnect();});
describe("auditoria legível e isolada",()=>{
 it("resolve nomes de registros antigos mantendo snapshots existentes",async()=>{
  const history=await getAuditHistory(owner);
  expect(history.find(r=>r.entityId===supplierId)).toMatchObject({actionLabel:"Cadastro criado",entityLabel:"Fornecedor",recordName:"Fornecedor histórico"});
  expect(history.find(r=>r.entityId===customerId)).toMatchObject({entityLabel:"Cliente",recordName:"Cliente legível"});
 });
 it("não consulta nomes de outra organização mesmo com referência indevida em evento local",async()=>{
  const row=await prisma.auditLog.create({data:{organizationId:owner.organizationId,userId:owner.userId,action:"CREATE",entity:"Supplier",entityId:foreignSupplierId}});
  const history=await getAuditHistory(owner);
  expect(history.find(r=>r.id===row.id)?.recordName).toBeNull();
  expect(history.every(r=>r.organizationId===owner.organizationId)).toBe(true);
  expect(JSON.stringify(history)).not.toContain("Fornecedor de outra organização");
 });
 it("mantém RBAC e não modifica logs ao consultá-los",async()=>{
  const before=await prisma.auditLog.findMany({where:{organizationId:owner.organizationId},orderBy:{id:"asc"}});
  await getAuditHistory(owner);
  const after=await prisma.auditLog.findMany({where:{organizationId:owner.organizationId},orderBy:{id:"asc"}});
  expect(after).toEqual(before);
  for(const role of ["BUYER","KITCHEN","OPERATOR","VIEWER"] as const)await expect(getAuditHistory({...owner,role})).rejects.toThrow("perfil");
 });
 it("limita a 50 eventos e lida com registros ausentes e entidades futuras",async()=>{
  const now=new Date(Date.now()+1000);
  await prisma.auditLog.createMany({data:Array.from({length:53},(_,i)=>({organizationId:owner.organizationId,userId:owner.userId,action:"FUTURE_EVENT",entity:i===0?"__proto__":"ProductCategory",entityId:"registro-ausente-"+i,createdAt:now}))});
  const history=await getAuditHistory(owner);
  expect(history).toHaveLength(50);expect(history.every(r=>r.actionLabel==="Ação registrada")).toBe(true);expect(history.every(r=>r.recordName===null)).toBe(true);
 });
});
