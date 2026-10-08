import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "@/shared/types/actor";
import { assertRole } from "@/shared/lib/permissions";
import { workspaceQuery, type WorkspaceFocus } from "../queries/workspace.repository";
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T12:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},"Data inválida.");
const filters=z.object({from:day.optional(),to:day.optional(),context:z.enum(["RESTAURANT","EVENT","OTHER"]).optional()}).refine(f=>!f.from||!f.to||f.from<=f.to,"Período inválido.");
const focusSchema=z.object({kind:z.enum(["count","request","quote","order"]),id:z.string().trim().min(1).max(100)}).optional();
type Json<T> = T extends Prisma.Decimal ? string : T extends Date ? string : T extends Array<infer U>? Json<U>[] : T extends object ? {[K in keyof T]:Json<T[K]>} : T;
function asJson<T>(value:T):Json<T>{return JSON.parse(JSON.stringify(value));}
export async function getWorkspaceData(actor:Actor,input:unknown={},includeAllPayables=false,focus?:WorkspaceFocus) {
 assertRole(actor,["OWNER","ADMIN","BUYER","OPERATOR","VIEWER"]);
 const f=filters.parse(input);
 const selectedFocus=focusSchema.parse(focus);
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
 const start=f.from??today.slice(0,8)+"01";
 const end=f.to??today;
 const from=new Date(start+"T00:00:00-03:00"),to=new Date(new Date(end+"T00:00:00-03:00").getTime()+86400000);
 const result=await workspaceQuery(actor,from,to,f.context,includeAllPayables,selectedFocus);
 const amount=(rows:{type:string;_sum:{amount:Prisma.Decimal|null}}[],type:string)=>new Prisma.Decimal(rows.find(r=>r.type===type)?._sum.amount??0);
 const income=amount(result.periodTotals,"INCOME"),expenses=amount(result.periodTotals,"EXPENSE");
 const alerts=result.products.filter(p=>p.active&&p.currentStock.lte(p.minimumStock)).map(p=>({...p,suggestedQuantity:Prisma.Decimal.max(0,p.idealStock.minus(p.currentStock))}));
 const consumption=result.consumption.map(c=>({product:result.products.find(p=>p.id===c.productId)!,quantity:c._sum.quantity??new Prisma.Decimal(0),cost:c._sum.totalCost??new Prisma.Decimal(0)})).sort((a,b)=>b.cost.comparedTo(a.cost));
 const quotes=result.quotes.map(q=>({...q,total:q.items.filter(i=>i.available).reduce((sum,i)=>sum.plus(i.totalPrice),new Prisma.Decimal(0)).plus(q.freight)}));
 const orders=result.orders.map(o=>({...o,items:o.items.map(i=>({...i,remainingQuantity:i.quantity.minus(i.receivedQuantity)}))}));
 return asJson({...result,quotes,orders,alerts,consumption,period:{from:start,to:end,context:f.context??""},summary:{
  income,expenses,result:income.minus(expenses),balance:amount(result.paidTotals,"INCOME").minus(amount(result.paidTotals,"EXPENSE")),
  payable:amount(result.pendingTotals,"EXPENSE"),receivable:amount(result.pendingTotals,"INCOME"),payableCount:result.pendingTotals.find(r=>r.type==="EXPENSE")?._count??0,
  purchases:result.purchaseTotals._sum.total??new Prisma.Decimal(0),pendingOrders:result.pendingOrderCount
 }});
}
export type WorkspaceData=Awaited<ReturnType<typeof getWorkspaceData>>;
export type { WorkspaceFocus };
