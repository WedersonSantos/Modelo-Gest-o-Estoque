import "./setup";
import { randomUUID } from "node:crypto";
import { afterAll,beforeAll,describe,it,expect,vi } from "vitest";
import type { Actor } from "@/shared/types/actor";
import { accessKey,invoiceXml } from "../fixtures/fiscal";
import { parseFiscalXml } from "@/modules/fiscal/fiscal.rules";
import { prisma } from "@/shared/lib/prisma";
import { registerOrganization,createUser } from "@/modules/settings";
import { createProduct } from "@/modules/inventory";
import { createOrder,saveMenuItem,transitionOrder,getKitchen,getOrders } from "@/modules/orders/order.service";
import { confirmFiscal,previewFiscal } from "@/modules/fiscal/fiscal.service";
import { getWorkspaceData } from "@/modules/dashboard";
import * as finance from "@/modules/finance";
let owner:Actor,kitchen:Actor,foreign:Actor,menuId:string,productId:string,otherProduct:string;
const suffix=randomUUID();
beforeAll(async()=>{
 const user=await registerOrganization({organizationName:"Novos módulos "+suffix,name:"Responsável",email:suffix+"@example.test",password:"Teste123456!"});owner={userId:user.id,organizationId:user.organizationId,role:"OWNER"};
 const ku=await createUser(owner,{name:"Cozinha",email:"kitchen-"+suffix+"@example.test",password:"Teste123456!",role:"KITCHEN"});kitchen={...owner,userId:ku.id,role:"KITCHEN"};
 const fu=await registerOrganization({organizationName:"Outra organização "+suffix,name:"Responsável",email:"foreign-"+suffix+"@example.test",password:"Teste123456!"});foreign={userId:fu.id,organizationId:fu.organizationId,role:"OWNER"};
 menuId=(await saveMenuItem(owner,{name:"Quibe fictício",price:"15.90"})).id;
 productId=(await createProduct(owner,{name:"Carne de teste fiscal",unit:"KG",minimumStock:"1",idealStock:"20"})).id;
 otherProduct=(await createProduct(foreign,{name:"Produto externo",unit:"KG",minimumStock:"0",idealStock:"0"})).id;
});
afterAll(async()=>{vi.restoreAllMocks();await prisma.$disconnect();});
describe("pedidos com PostgreSQL",()=>{
 it("cria snapshots e calcula total sem baixar ingredientes",async()=>{const order=await createOrder(owner,{type:"TABLE",tableName:"12",notes:"Prioridade",items:[{menuItemId:menuId,quantity:2,notes:"Sem cebola"}]});expect(order.total.toString()).toBe("31.8");expect(order.items[0].notes).toBe("Sem cebola");expect((await prisma.product.findUniqueOrThrow({where:{id:productId}})).currentStock.toString()).toBe("0");
 await saveMenuItem(owner,{id:menuId,name:"Quibe fictício",price:"20.00"});expect((await prisma.orderItem.findFirstOrThrow({where:{orderId:order.id}})).unitPrice.toString()).toBe("15.9");
 await expect(transitionOrder(owner,{id:order.id,status:"READY"})).rejects.toThrow();await transitionOrder(owner,{id:order.id,status:"SENT_TO_KITCHEN"});const dto=await getKitchen(kitchen);expect(dto.find(o=>o.id===order.id)).not.toHaveProperty("total");
 for(const status of ["PREPARING","READY","COMPLETED"])await transitionOrder(kitchen,{id:order.id,status});
 const complete=await prisma.order.findUniqueOrThrow({where:{id:order.id}});expect(complete.completedAt).toBeTruthy();expect(complete.preparingAt).toBeTruthy();expect(complete.readyAt).toBeTruthy();await expect(transitionOrder(kitchen,{id:order.id,status:"PREPARING"})).rejects.toThrow();
 });
 it("isola organizações e bloqueia dados administrativos para KITCHEN",async()=>{await expect(getWorkspaceData(kitchen)).rejects.toThrow();await expect(getOrders(kitchen)).rejects.toThrow();await expect(createOrder(kitchen,{type:"TAKEAWAY",items:[{menuItemId:menuId,quantity:1}]})).rejects.toThrow();await expect(createOrder(foreign,{type:"TAKEAWAY",items:[{menuItemId:menuId,quantity:1}]})).rejects.toThrow();});
 it("cancela com motivo e cozinha não pode cancelar",async()=>{const o=await createOrder(owner,{type:"DELIVERY",items:[{menuItemId:menuId,quantity:1}]});await expect(transitionOrder(owner,{id:o.id,status:"CANCELED"})).rejects.toThrow();await expect(transitionOrder(kitchen,{id:o.id,status:"CANCELED",reason:"Cancelado"})).rejects.toThrow();await transitionOrder(owner,{id:o.id,status:"CANCELED",reason:"Cliente desistiu"});expect((await prisma.order.findUniqueOrThrow({where:{id:o.id}})).cancellationReason).toBe("Cliente desistiu");});
});
describe("importação fiscal atômica",()=>{
 it("confere sem gravar, importa compra, estoque, histórico e financeiro",async()=>{
 const before=await prisma.stockMovement.count({where:{organizationId:owner.organizationId}});
 const preview=await previewFiscal(owner,{xml:invoiceXml()});expect(preview).toHaveProperty("draft");expect(await prisma.stockMovement.count({where:{organizationId:owner.organizationId}})).toBe(before);
 const result=await confirmFiscal(owner,{draft:parseFiscalXml(invoiceXml()),associations:[{productId,quantity:"10",remember:true}]});
 const document=await prisma.fiscalDocument.findUniqueOrThrow({where:{id:result.id}});const receipt=await prisma.goodsReceipt.findUniqueOrThrow({where:{id:document.goodsReceiptId}});expect(receipt.total.toString()).toBe("320");
 const movement=await prisma.stockMovement.findFirstOrThrow({where:{referenceId:receipt.id}});expect(movement.quantity.toString()).toBe("10");expect(movement.unitCost.toString()).toBe("31");expect(movement.totalCost.toString()).toBe("310");
 expect((await prisma.product.findUniqueOrThrow({where:{id:productId}})).currentStock.toString()).toBe("10");expect((await prisma.financialEntry.findFirstOrThrow({where:{referenceId:receipt.id}})).amount.toString()).toBe("320");
 expect(await prisma.supplierPriceHistory.count({where:{organizationId:owner.organizationId,source:"PURCHASE"}})).toBe(1);
 const next=await previewFiscal(owner,{xml:invoiceXml(2)});expect(next).toHaveProperty("associations");if("associations" in next)expect(next.associations[0].productId).toBe(productId);
 });
 it("bloqueia nota duplicada, inclusive chamadas concorrentes",async()=>{await expect(previewFiscal(owner,{reference:accessKey()})).rejects.toThrow("já foi importada");const payload={draft:parseFiscalXml(invoiceXml(3)),associations:[{productId,quantity:"10",remember:false}]};const results=await Promise.allSettled([confirmFiscal(owner,payload),confirmFiscal(owner,payload)]);expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(await prisma.fiscalDocument.count({where:{organizationId:owner.organizationId,accessKey:accessKey(3)}})).toBe(1);});
 it("impede associação externa e acesso da cozinha",async()=>{const payload={draft:parseFiscalXml(invoiceXml(4)),associations:[{productId:otherProduct,quantity:"10",remember:true}]};await expect(confirmFiscal(owner,payload)).rejects.toThrow();await expect(previewFiscal(kitchen,{xml:invoiceXml()})).rejects.toThrow();expect(await prisma.fiscalDocument.count({where:{organizationId:owner.organizationId,accessKey:accessKey(4)}})).toBe(0);});
 it("faz rollback após estoque e histórico se o financeiro falhar",async()=>{
 const stock=(await prisma.product.findUniqueOrThrow({where:{id:productId}})).currentStock.toString();const movementCount=await prisma.stockMovement.count({where:{organizationId:owner.organizationId}});const historyCount=await prisma.supplierPriceHistory.count({where:{organizationId:owner.organizationId}});const orderCount=await prisma.purchaseOrder.count({where:{organizationId:owner.organizationId}});
 const spy=vi.spyOn(finance,"createPurchasePayable").mockRejectedValueOnce(new Error("Falha financeira simulada"));
 await expect(confirmFiscal(owner,{draft:parseFiscalXml(invoiceXml(5)),associations:[{productId,quantity:"10",remember:true}]})).rejects.toThrow("Falha financeira");spy.mockRestore();
 expect((await prisma.product.findUniqueOrThrow({where:{id:productId}})).currentStock.toString()).toBe(stock);expect(await prisma.stockMovement.count({where:{organizationId:owner.organizationId}})).toBe(movementCount);expect(await prisma.supplierPriceHistory.count({where:{organizationId:owner.organizationId}})).toBe(historyCount);expect(await prisma.purchaseOrder.count({where:{organizationId:owner.organizationId}})).toBe(orderCount);expect(await prisma.fiscalDocument.count({where:{organizationId:owner.organizationId,accessKey:accessKey(5)}})).toBe(0);
 });
});
