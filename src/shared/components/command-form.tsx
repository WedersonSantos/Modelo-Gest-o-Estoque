"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FormSection } from "./design-system";
import { ConfirmDialog } from "./confirm-dialog";
export type Field = { name:string; label:string; type?:string; required?:boolean; value?:string; step?:string; min?:string; options?:{value:string;label:string}[]; placeholder?:string };
export async function executeCommand(command:string,payload:unknown) {
 const r=await fetch("/api/commands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command,payload})});
 const data=await r.json(); if(!r.ok) throw new Error(data.error??"Não foi possível salvar. Tente novamente."); return data;
}
export function FormFields({fields}:{fields:Field[]}) { return <>{fields.map(f=><label className="field" key={f.name}><span>{f.label}{f.required!==false&&<span aria-hidden="true"> *</span>}</span>{f.options?<select name={f.name} required={f.required!==false} defaultValue={f.value??""}><option value="" disabled={f.required!==false}>Selecione</option>{f.options.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select>:<Input name={f.name} type={f.type??"text"} step={f.step} min={f.min} required={f.required!==false} defaultValue={f.value} placeholder={f.placeholder}/>}</label>)}</>; }
export function CommandForm({command,fields,hidden={},submit="Salvar",children,transform,onSuccess}:{command:string;fields:Field[];hidden?:Record<string,unknown>;submit?:string;children?:ReactNode;transform?:(values:Record<string,unknown>)=>unknown;onSuccess?:(result:{id?:string;ok:boolean})=>void}) {
 const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [success,setSuccess]=useState("");
 const [pending,setPending]=useState<unknown>(null);
 async function save(payload:unknown) {setBusy(true);setError("");setSuccess("");try{const result=await executeCommand(command,payload);setPending(null);setSuccess("Salvo com sucesso.");router.refresh();onSuccess?.(result);}catch(err){setError(err instanceof Error?err.message:"Não foi possível salvar.");}finally{setBusy(false);}}
 function send(e:FormEvent<HTMLFormElement>) { e.preventDefault();const values={...Object.fromEntries(new FormData(e.currentTarget)),...hidden};const payload=transform?transform(values):values;if(["finishInventoryCount","cancelFinancialEntry"].includes(command))setPending(payload);else void save(payload); }
 return <><form onSubmit={send} className="command-form">{["createProduct","updateProduct"].includes(command)?<><FormSection title="Informações"><FormFields fields={fields.filter(f=>["name","unit","categoryId","description"].includes(f.name))}/></FormSection><FormSection title="Estoque" description="O saldo e o custo médio são atualizados por inventários e movimentações."><FormFields fields={fields.filter(f=>["minimumStock","idealStock"].includes(f.name))}/></FormSection>{children}</>:<div className="form-grid"><FormFields fields={fields}/>{children}</div>}{error&&!pending&&<p className="form-error" role="alert">{error}</p>}{success&&<p className="form-success" role="status">{success}</p>}<Button disabled={busy} type="submit">{busy?"Salvando…":submit}</Button></form><ConfirmDialog open={pending!==null} title={command==="finishInventoryCount"?"Finalizar inventário?":"Cancelar lançamento?"} description={command==="finishInventoryCount"?"O estoque será ajustado às quantidades informadas. Confira a contagem antes de confirmar.":"O cancelamento ficará registrado no histórico financeiro."} busy={busy} onCancel={()=>setPending(null)} onConfirm={()=>void save(pending)}>{error&&<p className="form-error" role="alert">{error}</p>}</ConfirmDialog></>;
}
export function CommandButton({command,payload,children,variant="outline"}:{command:string;payload:unknown;children:ReactNode;variant?:"default"|"outline"|"destructive"}) {
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [confirm,setConfirm]=useState(false);const requiresConfirmation=command==="cancelInventoryCount"||(command==="transitionPurchaseOrder"&&(payload as {status?:string}).status==="CANCELED");
 async function save(){setBusy(true);setError("");try{await executeCommand(command,payload);setConfirm(false);router.refresh();}catch(err){setError(err instanceof Error?err.message:"Erro ao salvar.");}finally{setBusy(false);}}
 return <span className="command-button"><Button variant={variant} size="sm" disabled={busy} onClick={()=>requiresConfirmation?setConfirm(true):void save()}>{busy?"Aguarde…":children}</Button>{error&&!confirm&&<span role="alert" className="form-error">{error}</span>}<ConfirmDialog open={confirm} title="Confirmar cancelamento?" description="O registro será encerrado e o histórico será preservado." busy={busy} onCancel={()=>setConfirm(false)} onConfirm={()=>void save()}>{error&&<p className="form-error" role="alert">{error}</p>}</ConfirmDialog></span>;
}
