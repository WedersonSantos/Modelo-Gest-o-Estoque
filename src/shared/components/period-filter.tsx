"use client";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function PeriodFilter({from,to,context="",showContext=false}:{from:string;to:string;context?:string;showContext?:boolean}) {
 const pathname=usePathname(),router=useRouter();
 function preset(days:number){const d=new Date();const end=d.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});d.setDate(d.getDate()-(days-1));const start=days===0?end.slice(0,8)+"01":d.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});router.push(`${pathname}?from=${start}&to=${end}`);}
 return <div className="period-filter"><div className="quick-period"><Button variant="ghost" size="sm" onClick={()=>preset(1)}>Hoje</Button><Button variant="ghost" size="sm" onClick={()=>preset(7)}>7 dias</Button><Button variant="ghost" size="sm" onClick={()=>preset(0)}>Este mês</Button></div><form method="get"><label>De<input aria-label="Data inicial" name="from" type="date" defaultValue={from} required/></label><label>Até<input aria-label="Data final" name="to" type="date" defaultValue={to} required/></label>{showContext&&<label>Uso<select name="context" defaultValue={context}><option value="">Todos</option><option value="RESTAURANT">Restaurante</option><option value="EVENT">Evento</option><option value="OTHER">Outros</option></select></label>}<Button variant="outline" size="sm" type="submit">Filtrar</Button></form></div>;
}
