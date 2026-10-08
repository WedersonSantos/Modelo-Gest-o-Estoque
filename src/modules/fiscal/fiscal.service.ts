import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma,transaction } from "@/shared/lib/prisma";
import type { Actor } from "@/shared/types/actor";
import { assertRole } from "@/shared/lib/permissions";
import { assert,DomainError } from "@/shared/lib/errors";
import { dec,money,quantity } from "@/shared/lib/money";
import { receiveStock } from "@/modules/inventory";
import { recordSupplierPrice } from "@/modules/suppliers";
import { createPurchasePayable } from "@/modules/finance";
import { audit } from "@/shared/lib/audit";
import { fiscalDraftSchema,parseFiscalXml,parseFiscalReference,fiscalMappingKey,type FiscalDraft } from "./fiscal.rules";
const ROLES=["OWNER","ADMIN","OPERATOR"] as const;
export async function previewFiscal(actor:Actor,input:unknown){
 assertRole(actor,ROLES);
 const d=z.object({xml:z.string().optional(),reference:z.string().optional()}).parse(input);
 if(d.reference){const reference=parseFiscalReference(d.reference);assert(!await prisma.fiscalDocument.findUnique({where:{organizationId_accessKey:{organizationId:actor.organizationId,accessKey:reference.accessKey}}}),"Esta nota já foi importada.",409);return {reference};}
 assert(d.xml,"Envie um XML ou informe a chave.");
 const draft=parseFiscalXml(d.xml);
 if(draft.accessKey)assert(!await prisma.fiscalDocument.findUnique({where:{organizationId_accessKey:{organizationId:actor.organizationId,accessKey:draft.accessKey}}}),"Esta nota já foi importada.",409);
 return suggestFiscalMappings(actor,draft);
}
export async function suggestFiscalMappings(actor:Actor,draft:FiscalDraft){
 assertRole(actor,ROLES);const supplier=await prisma.supplier.findFirst({where:{organizationId:actor.organizationId,document:draft.supplierDocument,active:true}});
 const mappings=supplier?await prisma.supplierFiscalMapping.findMany({where:{organizationId:actor.organizationId,supplierId:supplier.id}}):[];
 return {draft,supplierId:supplier?.id??"",associations:draft.items.map(i=>({productId:mappings.find(m=>m.mappingKey===fiscalMappingKey(i))?.productId??"",remember:false,quantity:i.quantity}))};
}
export const confirmFiscalSchema=z.object({draft:fiscalDraftSchema,supplierId:z.string().optional(),associations:z.array(z.object({productId:z.string().min(1,"Associe todos os produtos."),quantity:z.string().regex(/^\d{1,10}(\.\d{1,4})?$/).refine(v=>dec(v).gt(0)),remember:z.boolean().default(false)})).min(1).max(500)});
export async function confirmFiscal(actor:Actor,input:unknown){
 assertRole(actor,ROLES);const d=confirmFiscalSchema.parse(input);const {draft}=d;
 assert(d.associations.length===draft.items.length,"Confira a associação de todos os itens.");
 try{return await transaction(async tx=>{
  if(draft.accessKey)assert(!await tx.fiscalDocument.findUnique({where:{organizationId_accessKey:{organizationId:actor.organizationId,accessKey:draft.accessKey}}}),"Esta nota já foi importada.",409);
  let supplier=await tx.supplier.findFirst({where:{organizationId:actor.organizationId,...(d.supplierId?{id:d.supplierId}:{document:draft.supplierDocument})}});
  if(d.supplierId)assert(supplier,"Fornecedor não encontrado.",404);
  if(supplier){assert(supplier.active,"Fornecedor inativo.");assert(!supplier.document||supplier.document===draft.supplierDocument,"O CNPJ não corresponde ao fornecedor selecionado.");if(!supplier.document)supplier=await tx.supplier.update({where:{id_organizationId:{id:supplier.id,organizationId:actor.organizationId}},data:{document:draft.supplierDocument}});}
  else supplier=await tx.supplier.create({data:{organizationId:actor.organizationId,name:draft.supplierName+" · "+draft.supplierDocument,companyName:draft.supplierName,document:draft.supplierDocument}});
  const productIds=[...new Set(d.associations.map(a=>a.productId))].sort();
  const products=await tx.product.findMany({where:{organizationId:actor.organizationId,id:{in:productIds},active:true}});
  assert(products.length===productIds.length,"Há produtos indisponíveis ou de outra organização.");
  const lines=productIds.map(productId=>{
   const indexes=d.associations.flatMap((a,i)=>a.productId===productId?[i]:[]);
   const amount=indexes.reduce((s,i)=>s.plus(d.associations[i].quantity),dec(0));
   const total=indexes.reduce((s,i)=>s.plus(dec(draft.items[i].total).minus(draft.items[i].discount)),dec(0));
   return {productId,quantity:quantity(amount),unitPrice:quantity(total.div(amount)),totalPrice:money(total)};
  });
  const now=new Date(),receivedAt=now;
  const order=await tx.purchaseOrder.create({data:{organizationId:actor.organizationId,supplierId:supplier.id,status:"RECEIVED",total:money(draft.total),freight:money(dec(draft.freight).plus(draft.additionalCosts)),selectionReason:"Importação fiscal conferida pelo responsável",orderedAt:new Date(draft.issuedAt),receivedAt,createdBy:actor.userId,},include:{items:true}});
  await tx.purchaseOrderItem.createMany({data:lines.map(l=>({...l,organizationId:actor.organizationId,purchaseOrderId:order.id,receivedQuantity:l.quantity}))});
  order.items=await tx.purchaseOrderItem.findMany({where:{purchaseOrderId:order.id,organizationId:actor.organizationId}});
  const receipt=await tx.goodsReceipt.create({data:{organizationId:actor.organizationId,purchaseOrderId:order.id,idempotencyKey:"fiscal:"+order.id,total:money(draft.total),freight:money(dec(draft.freight).plus(draft.additionalCosts)),createdBy:actor.userId,receivedAt}});
  const document=await tx.fiscalDocument.create({data:{organizationId:actor.organizationId,accessKey:draft.accessKey,source:draft.source,model:draft.model,number:draft.number,series:draft.series,issuedAt:receivedAt,total:money(draft.total),data:JSON.parse(JSON.stringify({...draft,associations:d.associations})),supplierId:supplier.id,purchaseOrderId:order.id,goodsReceiptId:receipt.id,createdBy:actor.userId}});
  for(const line of lines){
   const item=order.items.find(i=>i.productId===line.productId)!;
   await tx.goodsReceiptItem.create({data:{organizationId:actor.organizationId,goodsReceiptId:receipt.id,orderItemId:item.id,productId:line.productId,quantity:line.quantity,unitCost:line.unitPrice,totalCost:line.totalPrice}});
   await receiveStock(tx,actor,{productId:line.productId,quantity:line.quantity.toString(),unitCost:line.unitPrice.toString(),referenceType:"GOODS_RECEIPT",referenceId:receipt.id,notes:"Importação fiscal "+(draft.accessKey??document.id)});
   await recordSupplierPrice(tx,actor,{supplierId:supplier.id,productId:line.productId,price:line.unitPrice.toString()}, "PURCHASE");
  }
  for(let i=0;i<d.associations.length;i++){const a=d.associations[i],line=draft.items[i];if(a.remember){const mappingKey=fiscalMappingKey(line);await tx.supplierFiscalMapping.upsert({where:{organizationId_supplierId_mappingKey:{organizationId:actor.organizationId,supplierId:supplier.id,mappingKey}},create:{organizationId:actor.organizationId,supplierId:supplier.id,productId:a.productId,mappingKey,supplierProductCode:line.code,gtin:line.gtin,fiscalDescription:line.description},update:{productId:a.productId,gtin:line.gtin,fiscalDescription:line.description}});}}
  await createPurchasePayable(tx,actor,{receiptId:receipt.id,supplierName:supplier.name,amount:money(draft.total),receivedAt});
  await audit(tx,actor,"FISCAL_IMPORTED","FiscalDocument",document.id,{accessKey:draft.accessKey??null,receiptId:receipt.id,confirmedAt:now.toISOString()});
  return {id:document.id,purchaseOrderId:order.id};
 });}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002"&&draft.accessKey){const prior=await prisma.fiscalDocument.findUnique({where:{organizationId_accessKey:{organizationId:actor.organizationId,accessKey:draft.accessKey}}});if(prior)throw new DomainError("Esta nota já foi importada.",409);}throw e;}
}
