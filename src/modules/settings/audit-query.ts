import { prisma } from "@/shared/lib/prisma";
import { assertRole,ADMIN_ROLES } from "@/shared/lib/permissions";
import type { Actor } from "@/shared/types/actor";
import { auditActionLabel,auditEntityLabel,auditRecordName } from "./audit-labels";
type Name={id:string;name:string};
export async function getAuditHistory(actor:Actor){
 assertRole(actor,ADMIN_ROLES);
 const organizationId=actor.organizationId;
 const rows=await prisma.auditLog.findMany({where:{organizationId},include:{user:{select:{name:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:50});
 const where=(ids:string[])=>({organizationId,id:{in:ids}});
 const named={id:true,name:true} as const;
 const resolvers:Record<string,(ids:string[])=>Promise<Name[]>>={
  Organization:ids=>prisma.organization.findMany({where:{id:organizationId,AND:{id:{in:ids}}},select:named}),
  User:ids=>prisma.user.findMany({where:where(ids),select:named}),
  Product:ids=>prisma.product.findMany({where:where(ids),select:named}),
  ProductCategory:ids=>prisma.productCategory.findMany({where:where(ids),select:named}),
  FinancialCategory:ids=>prisma.financialCategory.findMany({where:where(ids),select:named}),
  Supplier:ids=>prisma.supplier.findMany({where:where(ids),select:named}),
  MenuItem:ids=>prisma.menuItem.findMany({where:where(ids),select:named}),
  Customer:ids=>prisma.customer.findMany({where:where(ids),select:named}),
  Employee:ids=>prisma.employee.findMany({where:where(ids),select:named}),
  JobRole:ids=>prisma.jobRole.findMany({where:where(ids),select:named}),
  Order:async ids=>(await prisma.order.findMany({where:where(ids),select:{id:true,number:true,customerName:true}})).map(r=>({id:r.id,name:"Pedido #"+r.number+(r.customerName?" · "+r.customerName:"")})),
  PurchaseOrder:async ids=>(await prisma.purchaseOrder.findMany({where:where(ids),select:{id:true,supplier:{select:{name:true}}}})).map(r=>({id:r.id,name:"Compra de "+r.supplier.name})),
  SupplierQuote:async ids=>(await prisma.supplierQuote.findMany({where:where(ids),select:{id:true,supplier:{select:{name:true}}}})).map(r=>({id:r.id,name:"Cotação de "+r.supplier.name})),
  SupplierProduct:async ids=>(await prisma.supplierProduct.findMany({where:where(ids),select:{id:true,supplier:{select:{name:true}},product:{select:{name:true}}}})).map(r=>({id:r.id,name:r.product.name+" · "+r.supplier.name})),
  FinancialEntry:async ids=>(await prisma.financialEntry.findMany({where:where(ids),select:{id:true,description:true}})).map(r=>({id:r.id,name:r.description})),
  StockMovement:async ids=>(await prisma.stockMovement.findMany({where:where(ids),select:{id:true,product:{select:{name:true}}}})).map(r=>({id:r.id,name:r.product.name})),
  InventoryCount:async ids=>(await prisma.inventoryCount.findMany({where:where(ids),select:{id:true,startedAt:true}})).map(r=>({id:r.id,name:"Contagem de "+new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(r.startedAt)})),
  PurchaseRequest:async ids=>(await prisma.purchaseRequest.findMany({where:where(ids),select:{id:true,title:true}})).map(r=>({id:r.id,name:r.title??"Lista de compras"})),
  GoodsReceipt:async ids=>(await prisma.goodsReceipt.findMany({where:where(ids),select:{id:true,purchaseOrder:{select:{supplier:{select:{name:true}}}}}})).map(r=>({id:r.id,name:"Recebimento de "+r.purchaseOrder.supplier.name})),
  FiscalDocument:async ids=>(await prisma.fiscalDocument.findMany({where:where(ids),select:{id:true,number:true,supplier:{select:{name:true}}}})).map(r=>({id:r.id,name:"Nota "+(r.number??"sem número")+" · "+r.supplier.name}))
 };
 const names=new Map<string,string>();
 // Batch only entity types represented in these 50 events; never perform a query per event.
 await Promise.all([...new Set(rows.map(row=>row.entity))].map(async entity=>{
  const resolve=Object.hasOwn(resolvers,entity)?resolvers[entity]:undefined;if(!resolve)return;
  const ids=[...new Set(rows.filter(row=>row.entity===entity).map(row=>row.entityId))];
  for(const record of await resolve(ids))names.set(entity+":"+record.id,record.name);
 }));
 return rows.map(row=>({...row,actionLabel:auditActionLabel(row),entityLabel:auditEntityLabel(row.entity),recordName:auditRecordName(row,names.get(row.entity+":"+row.entityId))}));
}
