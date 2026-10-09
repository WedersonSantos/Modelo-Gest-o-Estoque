import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma, transaction } from "@/shared/lib/prisma";
import { assertRole } from "@/shared/lib/permissions";
import { assert } from "@/shared/lib/errors";
import { audit } from "@/shared/lib/audit";
import type { Actor } from "@/shared/types/actor";
import { customerSchema, normalizePhone } from "./customer.rules";

export const CUSTOMER_ROLES = ["OWNER", "ADMIN", "OPERATOR"] as const;
export const customerSelect = {id:true,name:true,phone:true,phoneNormalized:true,email:true,birthDate:true,notes:true,active:true,marketingConsent:true,marketingConsentAt:true,createdAt:true,updatedAt:true} as const;
export type CustomerDTO = {id:string;name:string;phone:string|null;phoneNormalized:string|null;email:string|null;birthDate:string|null;notes:string|null;active:boolean;marketingConsent:boolean;marketingConsentAt:string|null;createdAt:string;updatedAt:string};
export type CustomerList = {customers:CustomerDTO[];page:number;hasMore:boolean};
export async function listCustomers(actor: Actor, input: unknown = {}) {
  assertRole(actor, CUSTOMER_ROLES);
  const d=z.object({search:z.string().trim().max(120).default(""),page:z.coerce.number().int().min(1).max(100000).default(1),active:z.boolean().optional()}).parse(input);
  const digits=d.search.replace(/\D/g,"");
  const customers=await prisma.customer.findMany({
    where:{organizationId:actor.organizationId,...(d.active === undefined ? {} : {active:d.active}),...(d.search ? {OR:[{name:{contains:d.search,mode:"insensitive" as const}},{email:{contains:d.search,mode:"insensitive" as const}},{phone:{contains:d.search}},...(digits ? [{phoneNormalized:{contains:digits}}] : [])]} : {})},
    select:customerSelect,orderBy:[{name:"asc"},{id:"asc"}],skip:(d.page-1)*50,take:51,
  });
  return {customers:JSON.parse(JSON.stringify(customers.slice(0,50))) as CustomerDTO[],page:d.page,hasMore:customers.length>50};
}
export async function findPhoneDuplicates(actor: Actor, input: unknown) {
  assertRole(actor, CUSTOMER_ROLES);
  const d=z.object({phone:z.string().max(40),excludeId:z.string().optional()}).parse(input);
  const phoneNormalized=normalizePhone(d.phone);
  if(!phoneNormalized)return [];
  return prisma.customer.findMany({where:{organizationId:actor.organizationId,phoneNormalized,...(d.excludeId ? {id:{not:d.excludeId}} : {})},select:{id:true,name:true,active:true},take:10,orderBy:{name:"asc"}});
}
export async function saveCustomerInTransaction(tx: Prisma.TransactionClient, actor:Actor, input:unknown) {
  const d=customerSchema.parse(input);
  const customer=await tx.customer.create({data:{...d,birthDate:d.birthDate ? new Date(d.birthDate+"T00:00:00.000Z") : null,phoneNormalized:normalizePhone(d.phone),marketingConsentAt:d.marketingConsent ? new Date() : null,organizationId:actor.organizationId},select:customerSelect});
  await audit(tx,actor,"CUSTOMER_CREATED","Customer",customer.id);
  return customer;
}
export async function createCustomer(actor:Actor,input:unknown) {
  assertRole(actor,CUSTOMER_ROLES);
  return transaction(async tx => {
    const customer=await saveCustomerInTransaction(tx,actor,input);
    const possibleDuplicates=customer.phoneNormalized ? await tx.customer.findMany({where:{organizationId:actor.organizationId,phoneNormalized:customer.phoneNormalized,id:{not:customer.id}},select:{id:true,name:true,active:true},take:10}) : [];
    return {customer,possibleDuplicates};
  });
}
export async function updateCustomer(actor:Actor,input:unknown) {
  assertRole(actor,CUSTOMER_ROLES);
  const {id}=z.object({id:z.string().min(1)}).parse(input);
  const d=customerSchema.parse(input);
  return transaction(async tx => {
    const existing=await tx.customer.findFirst({where:{id,organizationId:actor.organizationId}});
    assert(existing,"Cliente não encontrado.",404);
    const customer=await tx.customer.update({where:{id_organizationId:{id,organizationId:actor.organizationId}},data:{...d,birthDate:d.birthDate ? new Date(d.birthDate+"T00:00:00.000Z") : null,phoneNormalized:normalizePhone(d.phone),marketingConsentAt:d.marketingConsent ? (existing.marketingConsentAt ?? new Date()) : null},select:customerSelect});
    await audit(tx,actor,"CUSTOMER_UPDATED","Customer",id,{marketingConsent:d.marketingConsent});
    const possibleDuplicates=customer.phoneNormalized ? await tx.customer.findMany({where:{organizationId:actor.organizationId,phoneNormalized:customer.phoneNormalized,id:{not:id}},select:{id:true,name:true,active:true},take:10}) : [];
    return {customer,possibleDuplicates};
  });
}
export async function setCustomerActive(actor:Actor,input:unknown) {
  assertRole(actor,CUSTOMER_ROLES);
  const d=z.object({id:z.string().min(1),active:z.boolean()}).parse(input);
  return transaction(async tx => {
    const changed=await tx.customer.updateMany({where:{id:d.id,organizationId:actor.organizationId},data:{active:d.active}});
    assert(changed.count===1,"Cliente não encontrado.",404);
    await audit(tx,actor,d.active?"CUSTOMER_ACTIVATED":"CUSTOMER_DEACTIVATED","Customer",d.id);
    return {id:d.id};
  });
}
export async function getCustomerProfile(actor:Actor,id:string,page=1) {
  assertRole(actor,CUSTOMER_ROLES);
  z.number().int().min(1).max(100000).parse(page);
  return transaction(async tx => {
    const customer=await tx.customer.findFirst({where:{id,organizationId:actor.organizationId},select:customerSelect});
    assert(customer,"Cliente não encontrado.",404);
    const where={organizationId:actor.organizationId,customerId:id};
    const [orders,totalOrders,completed,possibleDuplicates]=await Promise.all([
      tx.order.findMany({where,select:{id:true,number:true,type:true,status:true,total:true,createdAt:true,completedAt:true,items:{select:{id:true,name:true,quantity:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(page-1)*50,take:51}),
      tx.order.count({where}),
      tx.order.aggregate({where:{...where,status:"COMPLETED"},_count:true,_sum:{total:true},_min:{completedAt:true},_max:{completedAt:true}}),
      customer.phoneNormalized ? tx.customer.findMany({where:{organizationId:actor.organizationId,phoneNormalized:customer.phoneNormalized,id:{not:customer.id}},select:{id:true,name:true},take:10}) : Promise.resolve([])
    ]);
    const total=completed._sum.total ?? new Prisma.Decimal(0);
    return JSON.parse(JSON.stringify({customer,possibleDuplicates,orders:orders.slice(0,50),hasMore:orders.length>50,page,metrics:{totalOrders,completedOrders:completed._count,totalSpent:total.toFixed(2),averageTicket:completed._count ? total.div(completed._count).toFixed(2) : "0.00",firstPurchase:completed._min.completedAt,lastPurchase:completed._max.completedAt}})) as CustomerProfile;
  });
}
export type CustomerProfile={customer:CustomerDTO;possibleDuplicates:{id:string;name:string}[];orders:{id:string;number:number;type:string;status:string;total:string;createdAt:string;completedAt:string|null;items:{id:string;name:string;quantity:number}[]}[];hasMore:boolean;page:number;metrics:{totalOrders:number;completedOrders:number;totalSpent:string;averageTicket:string;firstPurchase:string|null;lastPurchase:string|null}};
