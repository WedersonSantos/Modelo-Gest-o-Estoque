import "./setup";
import {randomUUID} from "node:crypto";
import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {prisma,transaction} from "@/shared/lib/prisma";
import {audit} from "@/shared/lib/audit";
import {registerOrganization} from "@/modules/settings";
import {createEmployee} from "@/modules/employees/employee.service";
import {getAuditPage} from "@/modules/settings/audit-query";
import type {Actor} from "@/shared/types/actor";
let owner:Actor,foreign:Actor;const suffix=randomUUID();
const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
beforeAll(async()=>{
 for(const external of [false,true]){const u=await registerOrganization({organizationName:"Paginação "+external+" "+suffix,name:"Responsável",email:external+"-pages-"+suffix+"@example.test",password:"Teste123456!"});const a:Actor={userId:u.id,organizationId:u.organizationId,role:"OWNER"};if(external)foreign=a;else owner=a;}
});
afterAll(async()=>{await prisma.$disconnect();});
describe("auditoria paginada e perfil histórico",()=>{
 it("pagina todo o histórico de forma estável e sem repetir registros",async()=>{
  await prisma.auditLog.createMany({data:Array.from({length:32},(_,i)=>({organizationId:owner.organizationId,userId:owner.userId,action:"CREATE",entity:"ProductCategory",entityId:"page-"+i,createdAt:new Date("2030-02-01T12:00:00Z")}))});
  const filter={from:"2030-02-01",to:"2030-02-01"};
  const a=await getAuditPage(owner,{...filter,page:1}),b=await getAuditPage(owner,{...filter,page:2}),last=await getAuditPage(owner,{...filter,page:99});
  expect(a).toMatchObject({total:32,totalPages:4,pageSize:10,page:1});expect(a.rows).toHaveLength(10);expect(b.rows).toHaveLength(10);
  expect(a.rows.some(r=>b.rows.some(other=>r.id===other.id))).toBe(false);
  expect(last.page).toBe(4);expect(last.rows).toHaveLength(2);
  expect((await getAuditPage(owner,{...filter,page:1})).rows.map(r=>r.id)).toEqual(a.rows.map(r=>r.id));
 });
 it("filtra datas incluindo o fim do dia e respeitando o fuso brasileiro",async()=>{
  const dates=["2026-05-10T02:59:59Z","2026-05-10T03:00:00Z","2026-05-11T02:59:59Z","2026-05-11T03:00:00Z"];
  await prisma.auditLog.createMany({data:dates.map((date,i)=>({organizationId:owner.organizationId,userId:owner.userId,action:"CREATE",entity:"ProductCategory",entityId:"date-"+i,createdAt:new Date(date)}))});
  const d=await getAuditPage(owner,{from:"2026-05-10",to:"2026-05-10"});
  expect(d.total).toBe(2);expect(d.rows.map(r=>r.entityId).sort()).toEqual(["date-1","date-2"]);
  expect((await getAuditPage(owner,{from:"2000-01-01",to:"2000-01-01"}))).toMatchObject({total:0,page:1,totalPages:1,rows:[]});
 });
 it("registra o perfil e funcionário da operação sem reescrever o passado",async()=>{
  const employee=await createEmployee(owner,{name:"Funcionário original",userId:owner.userId});
  const row=await transaction(tx=>audit(tx,owner,"UPDATE","Employee",employee.id));
  await prisma.employee.update({where:{id:employee.id},data:{name:"Funcionário atual"}});
  await prisma.user.update({where:{id:owner.userId},data:{role:"ADMIN"}});
  const d=await getAuditPage(owner,{from:today,to:today});
  expect(d.rows.find(r=>r.id===row.id)?.operator).toEqual({role:"OWNER",source:"event",employeeName:"Funcionário original"});
  const registration=await prisma.auditLog.findFirstOrThrow({where:{organizationId:owner.organizationId,action:"REGISTER"}});
  expect(registration.actorEmployeeName).toBeNull();expect(registration.actorRole).toBe("OWNER");
 });
 it("apresenta o perfil atual nos eventos sem snapshot e preserva o evento original",async()=>{
  const legacy=await prisma.auditLog.create({data:{organizationId:owner.organizationId,userId:owner.userId,action:"UPDATE",entity:"Organization",entityId:owner.organizationId}});
  const d=await getAuditPage(owner,{from:today,to:today});
  expect(d.rows.find(r=>r.id===legacy.id)?.operator).toEqual({role:"ADMIN",source:"current",employeeName:"Funcionário atual"});
  expect((await prisma.auditLog.findUniqueOrThrow({where:{id:legacy.id}})).actorRole).toBeNull();
 });
 it("mantém isolamento por organização e bloqueia perfis sem acesso",async()=>{
  const d=await getAuditPage(foreign,{from:"2030-02-01",to:"2030-02-01"});expect(d.total).toBe(0);expect(d.rows).toEqual([]);
  for(const role of ["KITCHEN","BUYER","OPERATOR","VIEWER"] as const)await expect(getAuditPage({...owner,role},{page:1})).rejects.toThrow("perfil");
 });
 it("rejeita paginação e filtros inválidos no serviço",async()=>{
  await expect(getAuditPage(owner,{page:0})).rejects.toThrow();await expect(getAuditPage(owner,{from:"2026-02-30"})).rejects.toThrow();await expect(getAuditPage(owner,{from:"2026-05-12",to:"2026-05-10"})).rejects.toThrow();
 });
});
