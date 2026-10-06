import { z } from "zod";
import { getActor, assertSameOrigin } from "@/shared/lib/auth";
import { errorResponse, assert } from "@/shared/lib/errors";
import type { Actor } from "@/shared/types/actor";
import * as inventory from "@/modules/inventory";
import * as purchasing from "@/modules/purchasing";
import * as suppliers from "@/modules/suppliers";
import * as finance from "@/modules/finance";
import * as settings from "@/modules/settings";
const commands:Record<string,(actor:Actor,input:unknown)=>Promise<unknown>>={
 createProduct:(a,p)=>inventory.createProduct(a,p),updateProduct:(a,p)=>inventory.updateProduct(a,p),recordMovement:(a,p)=>inventory.recordMovement(a,p),createInventoryCount:(a,p)=>inventory.createInventoryCount(a,p),finishInventoryCount:(a,p)=>inventory.finishInventoryCount(a,p),cancelInventoryCount:(a,p)=>inventory.cancelInventoryCount(a,p),
 createSupplier:(a,p)=>suppliers.createSupplier(a,p),updateSupplier:(a,p)=>suppliers.updateSupplier(a,p),setSupplierPrice:(a,p)=>suppliers.setSupplierPrice(a,p),
 generatePurchaseRequest:a=>purchasing.generatePurchaseRequest(a),updatePurchaseRequest:(a,p)=>purchasing.updatePurchaseRequest(a,p),createQuote:(a,p)=>purchasing.createQuote(a,p),createPurchaseOrder:(a,p)=>purchasing.createPurchaseOrder(a,p),transitionPurchaseOrder:(a,p)=>purchasing.transitionPurchaseOrder(a,p),receivePurchaseOrder:(a,p)=>purchasing.receivePurchaseOrder(a,p),
 createFinancialEntry:(a,p)=>finance.createFinancialEntry(a,p),payFinancialEntry:(a,p)=>finance.payFinancialEntry(a,p),cancelFinancialEntry:(a,p)=>finance.cancelFinancialEntry(a,p),
 createUser:(a,p)=>settings.createUser(a,p),createCategory:(a,p)=>settings.createCategory(a,p),createFinancialCategory:(a,p)=>settings.createFinancialCategory(a,p)
};
const bodySchema=z.object({command:z.string().refine(c=>Object.hasOwn(commands,c),"Ação desconhecida."),payload:z.unknown()});
export async function POST(request:Request){try{assertSameOrigin(request);const actor=await getActor();const raw=await request.text();assert(raw.length<=200_000,"Solicitação muito grande.",413);const {command,payload}=bodySchema.parse(JSON.parse(raw));const result=await commands[command](actor,payload);return Response.json({ok:true,result});}catch(e){return errorResponse(e);}}
