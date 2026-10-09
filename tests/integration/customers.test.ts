import "./setup";
import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { prisma } from "@/shared/lib/prisma";
import { registerOrganization } from "@/modules/settings";
import { createCustomer,updateCustomer,setCustomerActive,listCustomers,findPhoneDuplicates,getCustomerProfile } from "@/modules/customers/customer.service";
import { createOrder,saveMenuItem,transitionOrder } from "@/modules/orders/order.service";
import type { Actor } from "@/shared/types/actor";
let owner:Actor,foreign:Actor,menuId:string,customerId:string;
const suffix=randomUUID();
const customerData={name:"Cliente fictício",phone:"(11) 99999-1234",email:"cliente-"+suffix+"@example.test",birthDate:"1990-01-02",notes:"Contato de demonstração",marketingConsent:true};
beforeAll(async()=>{
 const u=await registerOrganization({organizationName:"Clientes teste "+suffix,name:"Responsável",email:suffix+"@example.test",password:"Teste123456!"});
 owner={userId:u.id,organizationId:u.organizationId,role:"OWNER"};
 const f=await registerOrganization({organizationName:"Clientes externos "+suffix,name:"Responsável",email:"foreign-"+suffix+"@example.test",password:"Teste123456!"});
 foreign={userId:f.id,organizationId:f.organizationId,role:"OWNER"};
 menuId=(await saveMenuItem(owner,{name:"Quibe de demonstração",price:"10.00"})).id;
});
afterAll(async()=>{await prisma.$disconnect();});
describe("clientes e pedidos em PostgreSQL",()=>{
 it("cadastra com normalização e consentimento separado",async()=>{
  const {customer}=await createCustomer(owner,customerData);customerId=customer.id;
  expect(customer.phoneNormalized).toBe("5511999991234");expect(customer.marketingConsentAt).toBeInstanceOf(Date);expect(customer.birthDate?.toISOString().slice(0,10)).toBe("1990-01-02");
 });
 it("edita preservando a data de consentimento, revoga e concede novamente",async()=>{
  const previous=await prisma.customer.findUniqueOrThrow({where:{id:customerId}});
  const a=await updateCustomer(owner,{...customerData,id:customerId,name:"Cliente atualizado"});
  expect(a.customer.marketingConsentAt).toEqual(previous.marketingConsentAt);
  const b=await updateCustomer(owner,{...customerData,id:customerId,marketingConsent:false});
  expect(b.customer.marketingConsentAt).toBeNull();
  const c=await updateCustomer(owner,{...customerData,id:customerId,marketingConsent:true});
  expect(c.customer.marketingConsentAt).toBeInstanceOf(Date);
 });
 it("busca por nome, telefone com formatação e e-mail sem distinguir caixa",async()=>{
  for(const search of ["CLIENTE","(11) 99999-1234","11999991234","CLIENTE-"+suffix]){
   expect((await listCustomers(owner,{search})).customers.map(c=>c.id)).toContain(customerId);
  }
 });
 it("alerta duplicidade sem bloquear famílias e não revela outras organizações",async()=>{
  const second=await createCustomer(owner,{name:"Familiar fictício",phone:"+55 11 99999-1234"});
  expect(second.possibleDuplicates.map(c=>c.id)).toContain(customerId);
  expect((await getCustomerProfile(owner,second.customer.id)).possibleDuplicates.map(c=>c.id)).toContain(customerId);
  expect(await findPhoneDuplicates(foreign,{phone:customerData.phone})).toEqual([]);
  expect((await findPhoneDuplicates(owner,{phone:customerData.phone,excludeId:customerId})).map(c=>c.id)).toContain(second.customer.id);
 });
 it("isola listagem, perfil, edição e ativação por organização",async()=>{
  expect((await listCustomers(foreign)).customers).toEqual([]);
  await expect(getCustomerProfile(foreign,customerId)).rejects.toThrow("não encontrado");
  await expect(updateCustomer(foreign,{...customerData,id:customerId})).rejects.toThrow("não encontrado");
  await expect(setCustomerActive(foreign,{id:customerId,active:false})).rejects.toThrow("não encontrado");
  for(const role of ["KITCHEN","BUYER","VIEWER"] as const)await expect(listCustomers({...owner,role})).rejects.toThrow("perfil");
 });
 it("permite pedido com e sem cliente e impede vínculo de outro tenant no serviço e no banco",async()=>{
  const linked=await createOrder(owner,{type:"TAKEAWAY",customerId,items:[{menuItemId:menuId,quantity:1}]});
  expect(linked.customerId).toBe(customerId);expect(linked.customerName).toBe(customerData.name);
  const anonymous=await createOrder(owner,{type:"TAKEAWAY",customerName:"Visitante",items:[{menuItemId:menuId,quantity:1}]});
  expect(anonymous.customerId).toBeNull();expect(anonymous.customerName).toBe("Visitante");
  const external=(await createCustomer(foreign,{name:"Cliente externo"})).customer;
  await expect(createOrder(owner,{type:"TAKEAWAY",customerId:external.id,items:[{menuItemId:menuId,quantity:1}]})).rejects.toThrow("não encontrado");
  await expect(prisma.order.update({where:{id:anonymous.id},data:{customerId:external.id}})).rejects.toThrow();
  await expect(prisma.customerAddress.create({data:{organizationId:owner.organizationId,customerId:external.id,street:"Rua fictícia",city:"Cidade"}})).rejects.toThrow();
 });
 it("cadastro rápido é atômico com pedido, e erro no item faz rollback do cliente",async()=>{
  const o=await createOrder(owner,{type:"DELIVERY",newCustomer:{name:"Cliente rápido",phone:customerData.phone,marketingConsent:false},items:[{menuItemId:menuId,quantity:2}]});
  expect(o.possibleCustomerDuplicates.map(c=>c.id)).toContain(customerId);expect(o.customerId).toBeTruthy();expect(o.customerName).toBe("Cliente rápido");
  const before=await prisma.customer.count({where:{organizationId:owner.organizationId}});
  await expect(createOrder(owner,{type:"TAKEAWAY",newCustomer:{name:"Cliente rollback"},items:[{menuItemId:"inexistente",quantity:1}]})).rejects.toThrow();
  expect(await prisma.customer.count({where:{organizationId:owner.organizationId}})).toBe(before);
 });
 it("inativa sem apagar histórico e reativa para novos pedidos",async()=>{
  await setCustomerActive(owner,{id:customerId,active:false});
  await expect(createOrder(owner,{type:"TAKEAWAY",customerId,items:[{menuItemId:menuId,quantity:1}]})).rejects.toThrow("inativo");
  expect((await getCustomerProfile(owner,customerId)).orders.length).toBeGreaterThan(0);
  expect((await listCustomers(owner,{active:true})).customers.map(c=>c.id)).not.toContain(customerId);
  await setCustomerActive(owner,{id:customerId,active:true});
 });
 it("métricas usam finalizados, excluindo rascunhos e cancelados",async()=>{
  const c=(await createCustomer(owner,{name:"Cliente métricas"})).customer;
  for(const quantity of [1,3]){
   const o=await createOrder(owner,{type:"TAKEAWAY",customerId:c.id,items:[{menuItemId:menuId,quantity}]});
   for(const status of ["SENT_TO_KITCHEN","PREPARING","READY","COMPLETED"])await transitionOrder(owner,{id:o.id,status});
  }
  await createOrder(owner,{type:"TAKEAWAY",customerId:c.id,items:[{menuItemId:menuId,quantity:5}]});
  const cancelled=await createOrder(owner,{type:"TAKEAWAY",customerId:c.id,items:[{menuItemId:menuId,quantity:7}]});
  await transitionOrder(owner,{id:cancelled.id,status:"CANCELED",reason:"Desistência fictícia"});
  const d=await getCustomerProfile(owner,c.id);
  expect(d.metrics).toMatchObject({totalOrders:4,completedOrders:2,totalSpent:"40.00",averageTicket:"20.00"});
  expect(d.metrics.firstPurchase).toBeTruthy();expect(d.metrics.lastPurchase).toBeTruthy();expect(d.metrics.firstPurchase!<=d.metrics.lastPurchase!).toBe(true);
  expect(d.orders).toHaveLength(4);
  const empty=(await createCustomer(owner,{name:"Sem pedidos"})).customer;
  expect((await getCustomerProfile(owner,empty.id)).metrics).toEqual({totalOrders:0,completedOrders:0,totalSpent:"0.00",averageTicket:"0.00",firstPurchase:null,lastPurchase:null});
 });
});
