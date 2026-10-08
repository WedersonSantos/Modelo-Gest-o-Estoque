"use client";
import { useEffect,useRef,useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
export function SearchInput(){const [q,setQ]=useState(""),[results,setResults]=useState<{name:string;kind:string;href:string}[]>([]),[state,setState]=useState("");const [open,setOpen]=useState(false);const ref=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(q.trim().length<2)return;const c=new AbortController();const timer=setTimeout(async()=>{try{const r=await fetch("/api/search?q="+encodeURIComponent(q),{signal:c.signal});if(!r.ok)throw Error();const data=await r.json();setResults(data.results);setState(data.results.length?"":"Nenhum resultado encontrado.");}catch{if(!c.signal.aborted)setState("Não foi possível buscar. Tente novamente.");}},300);return()=>{clearTimeout(timer);c.abort();};},[q]);
 return <div className="global-search" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}><Search size={18}/><input ref={ref} aria-label="Busca global" placeholder="Buscar produto, fornecedor ou compra…" value={q} onFocus={()=>setOpen(true)} onKeyDown={e=>{if(e.key==="Escape")setOpen(false);}} onChange={e=>{setQ(e.target.value);setOpen(true);setResults([]);setState("Buscando…");}}/>{open&&q.trim().length>=2&&<div className="search-results" aria-label="Resultados da busca">{results.map(r=><Link key={r.href+r.name} href={r.href} onClick={()=>{setOpen(false);setQ("");}}><small>{r.kind}</small>{r.name}</Link>)}{state&&<p role="status">{state}</p>}</div>}</div>;
}
