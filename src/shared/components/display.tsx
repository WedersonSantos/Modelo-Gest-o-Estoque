import type { ReactNode } from "react";
const labels: Record<string,string> = {
 KG:"kg", G:"g", L:"L", ML:"mL", UNIT:"un", PACKAGE:"pacote", BOX:"caixa", PURCHASE:"Compra", CONSUMPTION:"Consumo", ADJUSTMENT_IN:"Ajuste de entrada", ADJUSTMENT_OUT:"Ajuste de saída", INVENTORY_ADJUSTMENT:"Inventário", LOSS:"Perda", OTHER:"Outros", RESTAURANT:"Restaurante", EVENT:"Evento",
 OPEN:"Aberto", COMPLETED:"Finalizado", CANCELED:"Cancelado", DRAFT:"Rascunho", PENDING_APPROVAL:"Aguardando aprovação", APPROVED:"Aprovado", ORDERED:"Pedido realizado", PARTIALLY_RECEIVED:"Recebido parcialmente", RECEIVED:"Recebido", CLOSED:"Encerrado", QUOTING:"Em cotação", SELECTED:"Selecionada", REJECTED:"Não selecionada", EXPIRED:"Vencida", PENDING:"Pendente", PAID:"Pago", INCOME:"Receita", EXPENSE:"Despesa", OWNER:"Proprietário", ADMIN:"Administrador", BUYER:"Comprador", OPERATOR:"Operador", VIEWER:"Consulta", IN:"Entrada", OUT:"Saída"
};
export function label(value:string) { return labels[value] ?? value; }
export function currency(value:string|number|null|undefined) { return Number(value??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
export function quantity(value:string|number|null|undefined) { return Number(value??0).toLocaleString("pt-BR",{maximumFractionDigits:4}); }
export function date(value:string|Date|null|undefined) { return value ? new Date(value).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}) : "—"; }
export function Badge({value}:{value:string}) { return <span className={`badge ${["PENDING","PENDING_APPROVAL","PARTIALLY_RECEIVED","OPEN"].includes(value)?"badge-warn":["PAID","RECEIVED","COMPLETED","APPROVED"].includes(value)?"badge-ok":""}`}>{label(value)}</span>; }
export function Empty({children}:{children:ReactNode}) { return <div className="empty">{children}</div>; }
export function Panel({title,description,action,children}:{title:string;description?:string;action?:ReactNode;children:ReactNode}) { return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>{children}</section>; }
export function Table({headers,children}:{headers:string[];children:ReactNode}) { return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
