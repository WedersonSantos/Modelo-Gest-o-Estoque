import { z } from "zod";
import { prisma, transaction } from "@/shared/lib/prisma";
import { assertRole } from "@/shared/lib/permissions";
import type { Actor } from "@/shared/types/actor";
import { assert } from "@/shared/lib/errors";
import { audit } from "@/shared/lib/audit";
import { dec, money } from "@/shared/lib/money";
import { ORDER_ROLES,KITCHEN_ROLES,validateOrderTransition } from "./order.rules";
const text=z.string().trim().max(500).optional();
const menuSchema=z.object({id:z.string().optional(),name:z.string().trim().min(2).max(120),description:text,price:z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).refine(v=>dec(v).gt(0),"Informe um preço maior que zero."),active:z.boolean().default(true)});
export const createOrderSchema=z.object({type:z.enum(["TABLE","TAKEAWAY","DELIVERY"]),tableName:z.string().trim().max(60).optional(),customerName:z.string().trim().max(120).optional(),notes:text,items:z.array(z.object({menuItemId:z.string().min(1),quantity:z.coerce.number().int().min(1).max(999),notes:text})).min(1).max(100)}).refine(d=>d.type!=="TABLE"||!!d.tableName,"Informe a mesa.");
export async function saveMenuItem(actor:Actor,input:unknown){
 assertRole(actor,["OWNER","ADMIN"]);const d=menuSchema.parse(input);
 return transaction(async tx=>{
  if(d.id) assert(await tx.menuItem.findFirst({where:{id:d.id,organizationId:actor.organizationId}}),"Item não encontrado.",404);
  const record=d.id?await tx.menuItem.update({where:{id_organizationId:{id:d.id,organizationId:actor.organizationId}},data:{name:d.name,description:d.description,price:money(d.price),active:d.active}}):await tx.menuItem.create({data:{organizationId:actor.organizationId,name:d.name,description:d.description,price:money(d.price),active:d.active}});
  await audit(tx,actor,"MENU_SAVED","MenuItem",record.id);return record;
 });
}
export async function getOrders(actor:Actor){
 assertRole(actor,ORDER_ROLES);
 const [menu,orders]=await Promise.all([prisma.menuItem.findMany({where:{organizationId:actor.organizationId},orderBy:{name:"asc"}}),prisma.order.findMany({where:{organizationId:actor.organizationId},include:{items:true},orderBy:{createdAt:"desc"},take:100})]);
 return JSON.parse(JSON.stringify({menu,orders,role:actor.role})) as OrdersData;
}
export type OrdersData={role:string;menu:{id:string;name:string;description:string|null;price:string;active:boolean}[];orders:OrderDTO[]};
export type OrderDTO={id:string;number:number;type:string;tableName:string|null;customerName:string|null;notes:string|null;status:string;total:string;createdAt:string;sentToKitchenAt:string|null;items:{id:string;name:string;quantity:number;notes:string|null}[]};
export async function createOrder(actor:Actor,input:unknown){
 assertRole(actor,ORDER_ROLES);const d=createOrderSchema.parse(input);
 return transaction(async tx=>{
  const menu=await tx.menuItem.findMany({where:{organizationId:actor.organizationId,id:{in:d.items.map(i=>i.menuItemId)},active:true}});
  const items=d.items.map(i=>{const item=menu.find(m=>m.id===i.menuItemId);assert(item,"Há um item indisponível no cardápio.",409);return {...i,organizationId:actor.organizationId,name:item.name,unitPrice:item.price,totalPrice:money(item.price.mul(i.quantity))};});
  const org=await tx.organization.update({where:{id:actor.organizationId},data:{nextOrderNumber:{increment:1}},select:{nextOrderNumber:true}});
  const order=await tx.order.create({data:{organizationId:actor.organizationId,number:org.nextOrderNumber,type:d.type,tableName:d.type==="TABLE"?d.tableName:null,customerName:d.customerName,notes:d.notes,createdBy:actor.userId,total:items.reduce((s,i)=>s.plus(i.totalPrice),dec(0)),},include:{items:true}});
  await tx.orderItem.createMany({data:items.map(i=>({...i,orderId:order.id}))});
  order.items=await tx.orderItem.findMany({where:{orderId:order.id,organizationId:actor.organizationId}});
  await audit(tx,actor,"ORDER_CREATED","Order",order.id);return order;
 });
}
export async function transitionOrder(actor:Actor,input:unknown){
 assertRole(actor,KITCHEN_ROLES);
 const d=z.object({id:z.string().min(1),status:z.enum(["SENT_TO_KITCHEN","PREPARING","READY","COMPLETED","CANCELED"]),reason:z.string().trim().min(3).max(500).optional()}).parse(input);
 return transaction(async tx=>{
  const order=await tx.order.findFirst({where:{id:d.id,organizationId:actor.organizationId},include:{items:true}});
  assert(order,"Pedido não encontrado.",404);validateOrderTransition(order.status,d.status,actor.role);
  if(d.status==="CANCELED")assert(d.reason,"Informe o motivo do cancelamento.");
  const now=new Date();const stamp={SENT_TO_KITCHEN:{sentToKitchenAt:now},PREPARING:{preparingAt:now},READY:{readyAt:now},COMPLETED:{completedAt:now},CANCELED:{canceledAt:now,cancellationReason:d.reason}}[d.status];
  const changed=await tx.order.updateMany({where:{id:d.id,organizationId:actor.organizationId,status:order.status},data:{status:d.status,...stamp}});
  assert(changed.count===1,"O pedido foi atualizado por outra pessoa.",409);
  await audit(tx,actor,d.status,"Order",order.id);
  return {id:order.id,status:d.status};
 });
}
export async function getKitchen(actor:Actor){
 assertRole(actor,KITCHEN_ROLES);
 // Select only production information. Prices, totals and administrative data never leave this API.
 return prisma.order.findMany({where:{organizationId:actor.organizationId,status:{in:["SENT_TO_KITCHEN","PREPARING","READY"]}},select:{id:true,number:true,type:true,tableName:true,customerName:true,notes:true,status:true,sentToKitchenAt:true,items:{select:{id:true,name:true,quantity:true,notes:true}}},orderBy:{sentToKitchenAt:"asc"}});
}
