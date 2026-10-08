import { notFound, redirect } from "next/navigation";
import { getActor } from "@/shared/lib/auth";
import { DomainError } from "@/shared/lib/errors";
import { assertRole } from "@/shared/lib/permissions";
import { getWorkspaceData, type WorkspaceFocus } from "@/modules/dashboard";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import { InventoryView } from "@/modules/inventory/components/inventory-view";
import { PurchasingView } from "@/modules/purchasing/components/purchasing-view";
import { SuppliersView } from "@/modules/suppliers/components/suppliers-view";
import { FinanceView } from "@/modules/finance/components/finance-view";
import { ReportsView } from "@/shared/components/reports-view";
import { SettingsView } from "@/modules/settings/components/settings-view";
export default async function WorkspacePage({params,searchParams}:{params:Promise<{section:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {section}=await params;const query=await searchParams;const actor=await getActor().catch(e=>{if(e instanceof DomainError&&e.status===401)redirect("/login");throw e;});
 if(actor.role==="KITCHEN")redirect("/cozinha");
 if(!["dashboard","estoque","compras","fornecedores","financeiro","relatorios","configuracoes"].includes(section[0]))notFound();
 const children:Record<string,string[]>={estoque:["produtos","movimentacoes","inventarios"],compras:["necessidades","listas","cotacoes","pedidos"],financeiro:["lancamentos","contas-pagar","categorias"]};
 if(section.length>3||(children[section[0]]&&section[1]&&!children[section[0]].includes(section[1])))notFound();
 if(["dashboard","relatorios","configuracoes"].includes(section[0])&&section.length>1)notFound();
 if(section[0]==="financeiro")assertRole(actor,["OWNER","ADMIN","VIEWER"]);
 if(section[0]==="configuracoes")assertRole(actor,["OWNER","ADMIN"]);
 const kinds:Record<string,WorkspaceFocus["kind"]>={"estoque/inventarios":"count","compras/listas":"request","compras/cotacoes":"quote","compras/pedidos":"order"};
 const kind=kinds[section.slice(0,2).join("/")];
 const focus=kind&&section[2]&&section[2]!=="novo"?{kind,id:section[2]}:undefined;
 const data=await getWorkspaceData(actor,{from:typeof query.from==="string"?query.from:undefined,to:typeof query.to==="string"?query.to:undefined,context:typeof query.context==="string"&&query.context?query.context:undefined},section[0]==="financeiro"&&section[1]==="contas-pagar",focus);
 if(focus&&!({count:data.counts,request:data.requests,quote:data.quotes,order:data.orders}[focus.kind].some(r=>r.id===focus.id)))notFound();
 if(section[0]==="estoque"&&section[1]==="produtos"&&section[2]&&section[2]!=="novo"&&!data.products.some(p=>p.id===section[2]))notFound();
 if(section[0]==="fornecedores"&&section[1]&&section[1]!=="novo"&&!data.suppliers.some(s=>s.id===section[1]))notFound();
 switch(section[0]) {case "dashboard":return <DashboardView data={data}/>;case "estoque":return <InventoryView data={data} parts={section}/>;case "compras":return <PurchasingView data={data} parts={section}/>;case "fornecedores":return <SuppliersView data={data} parts={section}/>;case "financeiro":return <FinanceView data={data} parts={section}/>;case "relatorios":return <ReportsView data={data}/>;case "configuracoes":return <SettingsView data={data}/>;default:notFound();}
}
