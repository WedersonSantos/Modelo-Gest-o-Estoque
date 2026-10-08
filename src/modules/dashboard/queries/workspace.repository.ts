import { prisma } from "@/shared/lib/prisma";
import type { Actor } from "@/shared/types/actor";
export type WorkspaceFocus = { kind: "count" | "request" | "quote" | "order"; id: string };
export async function workspaceQuery(actor:Actor,from:Date,to:Date,usageContext?:string,includeAllPayables=false,focus?:WorkspaceFocus) {
 const organizationId=actor.organizationId;
 const financeVisible=["OWNER","ADMIN","VIEWER"].includes(actor.role);
 const admin=["OWNER","ADMIN"].includes(actor.role);
 const [organization,user,products,categories,movements,counts,suppliers,requests,quotes,orders,financialCategories,entries,paidTotals,periodTotals,pendingTotals,purchaseTotals,consumption,audits,users,pendingOrderCount,financialSeries,previousTotals,overdueCount] = await Promise.all([
  prisma.organization.findUniqueOrThrow({where:{id:organizationId},select:{id:true,name:true}}),
  prisma.user.findFirstOrThrow({where:{id:actor.userId,organizationId},select:{id:true,name:true,email:true,role:true}}),
  prisma.product.findMany({where:{organizationId},include:{category:true},orderBy:{name:"asc"}}),
  prisma.productCategory.findMany({where:{organizationId},orderBy:{name:"asc"}}),
  prisma.stockMovement.findMany({where:{organizationId,createdAt:{gte:from,lt:to},...(usageContext?{usageContext}:{})},include:{product:true,creator:{select:{name:true}}},orderBy:{createdAt:"desc"},take:100}),
  prisma.inventoryCount.findMany({where:{organizationId,...(focus?.kind==="count"?{id:focus.id}:{})},include:{items:{include:{product:true}},creator:{select:{name:true}}},orderBy:{startedAt:"desc"},take:focus?.kind==="count"?undefined:30}),
  prisma.supplier.findMany({where:{organizationId},include:{products:{include:{product:true,priceHistory:{orderBy:{date:"desc"},take:12}}}},orderBy:{name:"asc"}}),
  prisma.purchaseRequest.findMany({where:{organizationId,...(focus?.kind==="request"?{id:focus.id}:{})},include:{items:{include:{product:true}}},orderBy:{createdAt:"desc"},take:focus?.kind==="request"?undefined:40}),
  prisma.supplierQuote.findMany({where:{organizationId,...(focus?.kind==="quote"?{id:focus.id}:focus?.kind==="request"?{purchaseRequestId:focus.id}:{})},include:{supplier:true,items:{include:{product:true}},order:{select:{id:true}}},orderBy:{createdAt:"desc"},take:focus?.kind==="quote"||focus?.kind==="request"?undefined:100}),
  prisma.purchaseOrder.findMany({where:{organizationId,...(focus?.kind==="order"?{id:focus.id}:{})},include:{supplier:true,items:{include:{product:true}},receipts:true},orderBy:{createdAt:"desc"},take:focus?.kind==="order"?undefined:100}),
  financeVisible?prisma.financialCategory.findMany({where:{organizationId},orderBy:{name:"asc"}}):Promise.resolve([]),
  financeVisible?prisma.financialEntry.findMany({where:includeAllPayables?{organizationId,type:"EXPENSE",status:"PENDING"}:{organizationId,OR:[{paidAt:{gte:from,lt:to}},{status:"PENDING",dueDate:{gte:from,lt:to}},{status:"CANCELED",createdAt:{gte:from,lt:to}}]},include:{category:true},orderBy:{dueDate:includeAllPayables?"asc":"desc"},take:includeAllPayables?undefined:200}):Promise.resolve([]),
  financeVisible?prisma.financialEntry.groupBy({by:["type"],where:{organizationId,status:"PAID"},_sum:{amount:true}}):Promise.resolve([]),
  financeVisible?prisma.financialEntry.groupBy({by:["type"],where:{organizationId,status:"PAID",paidAt:{gte:from,lt:to}},_sum:{amount:true}}):Promise.resolve([]),
  financeVisible?prisma.financialEntry.groupBy({by:["type"],where:{organizationId,status:"PENDING"},_sum:{amount:true},_count:true}):Promise.resolve([]),
  financeVisible?prisma.goodsReceipt.aggregate({where:{organizationId,receivedAt:{gte:from,lt:to}},_sum:{total:true}}):Promise.resolve({_sum:{total:null}}),
  prisma.stockMovement.groupBy({by:["productId"],where:{organizationId,type:"CONSUMPTION",createdAt:{gte:from,lt:to},...(usageContext?{usageContext}:{})},_sum:{quantity:true,totalCost:true}}),
  admin?prisma.auditLog.findMany({where:{organizationId},include:{user:{select:{name:true}}},orderBy:{createdAt:"desc"},take:50}):Promise.resolve([]),
  admin?prisma.user.findMany({where:{organizationId},select:{id:true,name:true,email:true,role:true,active:true},orderBy:{name:"asc"}}):Promise.resolve([]),
  prisma.purchaseOrder.count({where:{organizationId,status:{notIn:["RECEIVED","CANCELED"]}}}),
  financeVisible?prisma.financialEntry.groupBy({by:["paidAt","type"],where:{organizationId,status:"PAID",paidAt:{gte:from,lt:to}},_sum:{amount:true}}):Promise.resolve([]),
  financeVisible?prisma.financialEntry.groupBy({by:["type"],where:{organizationId,status:"PAID",paidAt:{gte:new Date(from.getTime()-(to.getTime()-from.getTime())),lt:from}},_sum:{amount:true}}):Promise.resolve([]),
  financeVisible?prisma.financialEntry.count({where:{organizationId,type:"EXPENSE",status:"PENDING",dueDate:{lt:new Date(new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})+"T00:00:00-03:00")}}}):Promise.resolve(0)
 ]);
 return {organization,user,products,categories,movements,counts,suppliers,requests,quotes,orders,financialCategories,entries,paidTotals,periodTotals,pendingTotals,purchaseTotals,consumption,audits,users,pendingOrderCount,financeVisible,financialSeries,previousTotals,overdueCount};
}
