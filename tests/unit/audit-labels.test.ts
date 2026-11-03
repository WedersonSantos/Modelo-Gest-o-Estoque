import {describe,it,expect} from "vitest";
import {auditActionLabel,auditEntityLabel,auditRecordName,auditDateTime} from "@/modules/settings/audit-labels";
const row={action:"CREATE",entity:"Supplier",entityId:"id",details:null};
describe("apresentação da auditoria",()=>{
 it("traduz ações antigas e de demonstração",()=>{
  for(const [action,text] of [["ORGANIZATION_RENAMED","Nome do restaurante alterado"],["DEMO_ORDER_CREATED","Pedido de demonstração criado"],["DEMO_CUSTOMER_CREATED","Cliente de demonstração cadastrado"],["DEMO_MENU_CREATED","Item de demonstração cadastrado"],["PAID","Pagamento registrado"],["PURCHASE_PAYABLE_CREATED","Conta a pagar da compra criada"]])expect(auditActionLabel({...row,action})).toBe(text);
 });
 it("distingue recebimento parcial e cancelamento por registro",()=>{
  expect(auditActionLabel({...row,entity:"PurchaseOrder",action:"RECEIVED",details:{complete:false}})).toBe("Compra recebida parcialmente");
  expect(auditActionLabel({...row,action:"RECEIVED",details:{complete:true}})).toBe("Compra recebida");
  expect(auditActionLabel({...row,entity:"FinancialEntry",action:"CANCELED"})).toBe("Lançamento financeiro cancelado");
  expect(auditActionLabel({...row,entity:"Order",action:"CANCELED"})).toBe("Pedido do cliente cancelado");
 });
 it("traduz entidades e trata códigos novos sem expor termos técnicos na apresentação",()=>{
  expect(auditEntityLabel("StockMovement")).toBe("Movimentação de estoque");expect(auditEntityLabel("Order")).toBe("Pedido do cliente");
  for(const code of ["NEW_EVENT","__proto__","toString"]){expect(auditEntityLabel(code)).toBe("Registro");expect(auditActionLabel({...row,action:code})).toBe("Ação registrada");}
 });
 it("prioriza nome registrado no evento e usa nome atual como alternativa",()=>{
  expect(auditRecordName({...row,details:{name:"Nome histórico"}},"Nome atual")).toBe("Nome histórico");
  expect(auditRecordName(row,"Nome atual")).toBe("Nome atual");expect(auditRecordName(row)).toBeNull();
  expect(auditRecordName({...row,details:["não é um objeto"]},"Nome atual")).toBe("Nome atual");
 });
 it("identifica o nome resultante de uma renomeação sem reescrever o evento",()=>{
  const record={...row,entity:"Organization",action:"ORGANIZATION_RENAMED",details:{from:"Nome anterior",to:"Nome restaurante"}};
  expect(auditRecordName(record,"Outro nome")).toBe("Nome restaurante");expect(record.details.from).toBe("Nome anterior");
 });
 it("exibe data e hora de São Paulo",()=>{
  expect(auditDateTime("2026-11-03T02:30:00Z")).toContain("02/11/2026");
  expect(auditDateTime("2026-11-03T02:30:00Z")).toContain("23:30");
 });
});
