"use client";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import type { CustomerDTO } from "../customer.service";
export function CustomerPicker({initial,selected,onSelect}:{initial:CustomerDTO[];selected:CustomerDTO|null;onSelect:(customer:CustomerDTO|null)=>void}) {
  const [search,setSearch]=useState(""),[results,setResults]=useState(initial),[loading,setLoading]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setLoading(true);setError("");
      try{
        const response=await fetch("/api/customers?"+new URLSearchParams({search,active:"true"}),{signal:controller.signal,cache:"no-store"});
        if(!response.ok)throw new Error();
        setResults((await response.json()).customers);
      }catch{if(!controller.signal.aborted)setError("Não foi possível buscar clientes. Tente novamente.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    },300);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[search]);
  return <div className="wide-field"><label className="field">Buscar cliente cadastrado<input type="search" placeholder="Nome, telefone ou e-mail" value={search} onChange={e=>setSearch(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}{selected?<p role="status">Cliente: <strong>{selected.name}</strong> · {selected.phone??selected.email??"Sem contato"} <Button type="button" variant="ghost" onClick={()=>onSelect(null)}>Remover vínculo</Button></p>:<label className="field">Cliente cadastrado (opcional)<select value="" onChange={e=>onSelect(results.find(c=>c.id===e.target.value)??null)}><option value="">Sem cliente cadastrado</option>{results.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?" · "+c.phone:""}</option>)}</select></label>}{loading&&<small role="status">Buscando clientes…</small>}{!loading&&search&&!results.length&&<small>Nenhum cliente ativo encontrado.</small>}</div>;
}
