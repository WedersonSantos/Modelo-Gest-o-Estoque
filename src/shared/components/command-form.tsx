"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export type Field = { name:string; label:string; type?:string; required?:boolean; value?:string; step?:string; min?:string; options?:{value:string;label:string}[]; placeholder?:string };
export async function executeCommand(command:string,payload:unknown) {
 const r=await fetch("/api/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command,payload})});
 const data=await r.json(); if(!r.ok) throw new Error(data.error??"Não foi possível salvar. Tente novamente."); return data;
}
export function FormFields({fields}:{fields:Field[]}) { return <>{fields.map(f=><label className="field" key={f.name}><span>{f.label}{f.required!==false&&<span aria-hidden="true"> *</span>}</span>{f.options?<select name={f.name} required={f.required!==false} defaultValue={f.value??""}><option value="" disabled={f.required!==false}>Selecione</option>{f.options.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select>:<Input name={f.name} type={f.type??"text"} step={f.step} min={f.min} required={f.required!==false} defaultValue={f.value} placeholder={f.placeholder}/>}</label>)}</>; }
export function CommandForm({command,fields,hidden={},submit="Salvar",children,transform,onSuccess}:{command:string;fields:Field[];hidden?:Record<string,unknown>;submit?:string;children?:ReactNode;transform?:(values:Record<string,unknown>)=>unknown;onSuccess?:(result:{id?:string;ok:boolean})=>void}) {
 const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [success,setSuccess]=useState("");
 async function send(e:FormEvent<HTMLFormElement>) { e.preventDefault();const form=e.currentTarget;setBusy(true);setError("");setSuccess("");try{const values={...Object.fromEntries(new FormData(form)),...hidden};const result=await executeCommand(command,transform?transform(values):values);setSuccess("Salvo com sucesso.");router.refresh();onSuccess?.(result);}catch(err){setError(err instanceof Error?err.message:"Não foi possível salvar.");}finally{setBusy(false);} }
 return <form onSubmit={send} className="command-form"><div className="form-grid"><FormFields fields={fields}/>{children}</div>{error&&<p className="form-error" role="alert">{error}</p>}{success&&<p className="form-success" role="status">{success}</p>}<Button disabled={busy} type="submit">{busy?"Salvando…":submit}</Button></form>;
}
export function CommandButton({command,payload,children,variant="outline"}:{command:string;payload:unknown;children:ReactNode;variant?:"default"|"outline"|"destructive"}) {
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 return <span className="command-button"><Button variant={variant} size="sm" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await executeCommand(command,payload);router.refresh();}catch(err){setError(err instanceof Error?err.message:"Erro ao salvar.");}finally{setBusy(false);}}}>{busy?"Aguarde…":children}</Button>{error&&<span role="alert" className="form-error">{error}</span>}</span>;
}
