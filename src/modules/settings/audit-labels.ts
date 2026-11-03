export const auditEntities:Record<string,string>={
 Organization:"Restaurante",User:"Usuário",Product:"Ingrediente",ProductCategory:"Categoria de ingredientes",FinancialCategory:"Categoria financeira",
 Supplier:"Fornecedor",SupplierProduct:"Preço de fornecedor",StockMovement:"Movimentação de estoque",InventoryCount:"Inventário",
 PurchaseRequest:"Lista de compras",SupplierQuote:"Cotação",PurchaseOrder:"Pedido de compra",GoodsReceipt:"Recebimento",
 FinancialEntry:"Lançamento financeiro",MenuItem:"Item do cardápio",Order:"Pedido do cliente",Customer:"Cliente",Employee:"Funcionário",JobRole:"Função",FiscalDocument:"Nota fiscal"
};
const actions:Record<string,string>={
 CREATE:"Cadastro criado",UPDATE:"Cadastro atualizado",REGISTER:"Restaurante cadastrado",SEED:"Dados de demonstração cadastrados",
 ORGANIZATION_RENAMED:"Nome do restaurante alterado",
 DEMO_ORDER_CREATED:"Pedido de demonstração criado",DEMO_CUSTOMER_CREATED:"Cliente de demonstração cadastrado",DEMO_MENU_CREATED:"Item de demonstração cadastrado",
 PRODUCT_CREATED:"Ingrediente cadastrado",PRODUCT_UPDATED:"Ingrediente atualizado",PRODUCT_CATEGORY_CREATED:"Categoria de ingredientes criada",
 STOCK_MOVEMENT_CREATED:"Movimentação de estoque registrada",INVENTORY_STARTED:"Inventário iniciado",INVENTORY_FINISHED:"Inventário finalizado",INVENTORY_CANCELED:"Inventário cancelado",
 PRICE_UPDATED:"Preço do fornecedor atualizado",PURCHASE_PAYABLE_CREATED:"Conta a pagar da compra criada",
 GENERATED:"Lista de compras gerada",QUANTITIES_UPDATED:"Quantidades da lista atualizadas",
 APPROVED:"Pedido de compra aprovado",ORDERED:"Compra enviada ao fornecedor",PENDING_APPROVAL:"Compra enviada para aprovação",PARTIALLY_RECEIVED:"Compra recebida parcialmente",RECEIVED:"Compra recebida",
 PAID:"Pagamento registrado",CANCELED:"Registro cancelado",
 CUSTOMER_CREATED:"Cliente cadastrado",CUSTOMER_UPDATED:"Cliente atualizado",CUSTOMER_ACTIVATED:"Cliente ativado",CUSTOMER_DEACTIVATED:"Cliente inativado",
 EMPLOYEE_CREATED:"Funcionário cadastrado",EMPLOYEE_UPDATED:"Funcionário atualizado",EMPLOYEE_ACTIVATED:"Funcionário ativado",EMPLOYEE_DEACTIVATED:"Funcionário inativado",
 MENU_SAVED:"Item do cardápio salvo",ORDER_CREATED:"Pedido do cliente criado",SENT_TO_KITCHEN:"Pedido enviado à cozinha",PREPARING:"Preparo do pedido iniciado",READY:"Pedido pronto",COMPLETED:"Pedido finalizado",
 JOB_ROLE_SAVED:"Função salva",FISCAL_IMPORTED:"Nota fiscal importada"
};
export type AuditRecord={action:string;entity:string;entityId:string;details:unknown};
function objectDetails(value:unknown):Record<string,unknown>{
 return value && typeof value==="object" && !Array.isArray(value)?value as Record<string,unknown>:{};
}
export function auditActionLabel(row:AuditRecord):string{
 const details=objectDetails(row.details);
 if(row.action==="RECEIVED" && details.complete===false)return "Compra recebida parcialmente";
 if(row.action==="CANCELED")return row.entity==="FinancialEntry"?"Lançamento financeiro cancelado":row.entity==="Order"?"Pedido do cliente cancelado":row.entity==="PurchaseOrder"?"Pedido de compra cancelado":"Registro cancelado";
 return Object.hasOwn(actions,row.action)?actions[row.action]:"Ação registrada";
}
export function auditRecordName(row:AuditRecord,resolvedName?:string):string|null{
 const details=objectDetails(row.details);
 if(row.entity==="Organization" && row.action==="ORGANIZATION_RENAMED" && typeof details.to==="string" && details.to.trim())return details.to;
 if(typeof details.name==="string" && details.name.trim())return details.name;
 return resolvedName??null;
}
export function auditEntityLabel(entity:string){return Object.hasOwn(auditEntities,entity)?auditEntities[entity]:"Registro";}
export function auditDateTime(value:string|Date){
 return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value));
}
