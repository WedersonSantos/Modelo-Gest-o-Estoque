"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {ChevronLeft,ChevronRight,LoaderCircle} from "lucide-react";
import type {AuditPageData} from "../audit-query";
import {auditFiltersSchema} from "../audit-filters";
import {auditDateTime} from "../audit-labels";
import {Badge,Empty,label,Panel,Table} from "@/shared/components/display";
import {Button} from "@/shared/components/ui/button";
export function AuditPanel({initial}:{initial:AuditPageData}){
 const [data,setData]=useState(initial),[from,setFrom]=useState(initial.filters.from),[to,setTo]=useState(initial.filters.to),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[]);
 async function load(page:number,start=from,end=to){
  const parsed=auditFiltersSchema.safeParse({page,from:start,to:end});
  if(!parsed.success){setError(parsed.error.issues[0]?.message??"Confira as datas informadas.");return;}
  pending.current?.abort();const controller=new AbortController();pending.current=controller;
  setBusy(true);setError("");
  try{
   const query=new URLSearchParams({page:String(page),from:start,to:end});
   const response=await fetch("/api/audit?"+query,{cache:"no-store",signal:controller.signal});
   const result=await response.json();if(!response.ok)throw Error(result.error??"Não foi possível carregar o histórico.");
   if(!controller.signal.aborted)setData(result);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Não foi possível carregar o histórico. Tente novamente.");}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 function filter(event:FormEvent<HTMLFormElement>){event.preventDefault();void load(1);}
 const first=data.total?(data.page-1)*data.pageSize+1:0,last=Math.min(data.page*data.pageSize,data.total);
 return <div id="auditoria"><Panel title="Auditoria" description="Consulte o histórico por período. São 10 registros por página, sem apagar as ações anteriores.">
  <form onSubmit={filter} className="audit-filters actions-row">
   <label className="field">Data inicial<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label className="field">Data final<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <div className="audit-filter-actions"><Button type="submit" disabled={busy}>Filtrar histórico</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{setFrom("");setTo("");void load(1,"","");}}>Limpar datas</Button></div>
  </form>
  <p className="audit-profile-hint">O perfil de acesso indica as permissões do usuário. O vínculo com funcionário aparece quando disponível. Quando o perfil não foi salvo na ação, mostramos o atual.</p>
  {error&&<div className="audit-error"><p className="form-error" role="alert">{error}</p><Button variant="outline" disabled={busy} onClick={()=>void load(data.page,data.filters.from,data.filters.to)}>Tentar novamente</Button></div>}
  <div id="audit-results" className="audit-results" aria-busy={busy} data-loading={busy}>
   {data.rows.length?<Table key={data.page+":"+data.filters.from+":"+data.filters.to} headers={["Data e hora","Responsável / perfil","Ação","Registro"]}>{data.rows.map(a=><tr key={a.id}><td>{auditDateTime(a.createdAt)}</td><td><strong>{a.user.name}</strong><small><Badge value={a.operator.role}/></small>{a.operator.employeeName&&<small>{a.operator.source==="event"?"Funcionário":"Funcionário atual"}: {a.operator.employeeName}</small>}<small>{a.operator.source==="event"?"Perfil na operação":"Perfil atual · não salvo na operação"}</small></td><td>{a.actionLabel}</td><td><strong>{a.recordName??a.entityLabel}</strong>{a.recordName&&<small>{a.entityLabel}</small>}<details><summary>Referência técnica</summary><small>Código da ação: <code>{a.action}</code></small><small>Tipo de registro: <code>{a.entity}</code></small><small>Identificador: <code className="audit-reference">{a.entityId}</code></small><small>Perfil: {label(a.operator.role)} ({a.operator.source==="event"?"registrado na operação":"atual; perfil histórico não registrado"})</small></details></td></tr>)}</Table>:<Empty>{data.filters.from||data.filters.to?"Nenhuma ação encontrada neste período. Ajuste as datas ou limpe o filtro.":"As ações importantes aparecerão aqui."}</Empty>}
  </div>
  <div className="panel-bottom audit-pagination">
   <span role="status" aria-live="polite">{busy?<><LoaderCircle size={16} className="audit-spinner" aria-hidden="true"/> Carregando registros…</>:data.total?first+"–"+last+" de "+data.total+" registros":"Nenhum registro"}</span>
   <nav aria-label="Paginação da auditoria"><Button variant="outline" size="sm" disabled={busy||data.page<=1} aria-controls="audit-results" onClick={()=>void load(data.page-1,data.filters.from,data.filters.to)}><ChevronLeft size={16} aria-hidden="true"/>Anterior</Button><span>Página {data.page} de {data.totalPages}</span><Button variant="outline" size="sm" disabled={busy||data.page>=data.totalPages} aria-controls="audit-results" onClick={()=>void load(data.page+1,data.filters.from,data.filters.to)}>Próxima<ChevronRight size={16} aria-hidden="true"/></Button></nav>
  </div>
 </Panel></div>;
}
