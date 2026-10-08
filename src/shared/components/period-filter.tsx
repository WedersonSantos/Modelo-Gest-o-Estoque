"use client";
import { usePathname,useRouter } from "next/navigation";
import { useRef } from "react";
import { SlidersHorizontal,X } from "lucide-react";
import { Button } from "./ui/button";
export function PeriodFilter({from,to,context="",showContext=false}:{from:string;to:string;context?:string;showContext?:boolean}) {
 const pathname=usePathname(),router=useRouter(),dialog=useRef<HTMLDialogElement>(null);
 function preset(days:number){const d=new Date();const end=d.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});d.setDate(d.getDate()-(days-1));const start=days===0?end.slice(0,8)+"01":d.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});router.push(pathname+"?from="+start+"&to="+end);}
 const form=<form method="get"><label>De<input aria-label="Data inicial" name="from" type="date" defaultValue={from} required/></label><label>Até<input aria-label="Data final" name="to" type="date" defaultValue={to} required/></label>{showContext&&<label>Uso<select name="context" defaultValue={context}><option value="">Todos</option><option value="RESTAURANT">Restaurante</option><option value="EVENT">Evento</option><option value="OTHER">Outros</option></select></label>}<Button variant="outline" size="sm" type="submit">Filtrar</Button></form>;
 return <div className="period-filter"><div className="quick-period"><Button variant="ghost" size="sm" onClick={()=>preset(1)}>Hoje</Button><Button variant="ghost" size="sm" onClick={()=>preset(7)}>7 dias</Button><Button variant="ghost" size="sm" onClick={()=>preset(0)}>Este mês</Button><Button variant="ghost" size="sm" onClick={()=>preset(30)}>30 dias</Button></div><div className="desktop-period-form">{form}</div><Button className="mobile-filter-button" variant="outline" onClick={()=>dialog.current?.showModal()}><SlidersHorizontal size={18}/>Filtros</Button><dialog ref={dialog} className="confirm-dialog filter-dialog" aria-label="Filtros do período"><div className="dialog-filter-heading"><h2>Filtros do período</h2><Button type="button" variant="ghost" size="icon" aria-label="Fechar filtros" onClick={()=>dialog.current?.close()}><X/></Button></div>{form}</dialog></div>;
}
export {PeriodFilter as DateRangeFilter};
