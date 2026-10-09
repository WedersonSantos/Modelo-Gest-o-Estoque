"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { FormSection } from "@/shared/components/design-system";
import { executeCommand } from "@/shared/components/command-form";
import type { CustomerDTO } from "../customer.service";

export type CustomerDraft={name:string;phone:string;email:string;birthDate:string;notes:string;active:boolean;marketingConsent:boolean};
export const emptyCustomer:CustomerDraft={name:"",phone:"",email:"",birthDate:"",notes:"",active:true,marketingConsent:false};
export function CustomerFields({value,onChange,excludeId,quick=false}:{value:CustomerDraft;onChange:(value:CustomerDraft)=>void;excludeId?:string;quick?:boolean}) {
  const [duplicates,setDuplicates]=useState<{id:string;name:string;active:boolean}[]>([]);
  const [checkError,setCheckError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setDuplicates([]);setCheckError("");
      if(!value.phone.trim())return;
      try{
        const params=new URLSearchParams({phone:value.phone,...(excludeId ? {excludeId} : {})});
        const response=await fetch("/api/customers?"+params,{signal:controller.signal,cache:"no-store"});
        if(!response.ok)throw new Error();
        setDuplicates(await response.json());
      }catch{if(!controller.signal.aborted)setCheckError("Não foi possível conferir possíveis duplicidades. Você pode salvar e revisar depois.");}
    },350);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[value.phone,excludeId]);
  const field=(key:keyof CustomerDraft,label:string,type="text",required=false,maxLength=120)=><label className="field" key={key}>{label}<input type={type} required={required} maxLength={maxLength} value={String(value[key])} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>;
  return <FormSection title={quick?"Cadastro rápido de cliente":"Dados do cliente"} description="O telefone é opcional. Não registre informações de saúde nas observações.">
    {field("name","Nome do cliente","text",true)}{field("phone","Telefone","tel",false,40)}{field("email","E-mail","email",false,254)}
    {!quick&&<>{field("birthDate","Data de nascimento","date")}<label className="field">Observações<textarea maxLength={1000} value={value.notes} onChange={e=>onChange({...value,notes:e.target.value})}/></label></>}
    {duplicates.length>0&&<p role="status" className="form-error wide-field">Possível duplicidade de telefone: {duplicates.map(d=>d.name+(d.active?"":" (inativo)")).join(", ")}. Famílias podem compartilhar o número; o cadastro continua permitido.</p>}
    {checkError&&<p role="status" className="wide-field">{checkError}</p>}
    <label className="field wide-field"><span><input type="checkbox" checked={value.marketingConsent} onChange={e=>onChange({...value,marketingConsent:e.target.checked})}/> Cliente autorizou receber comunicações de marketing</span><small>Registre somente uma autorização informada pelo cliente. Nenhuma mensagem será enviada automaticamente.</small></label>
  </FormSection>;
}
export function CustomerForm({customer}:{customer?:CustomerDTO}) {
  const router=useRouter();
  const [draft,setDraft]=useState<CustomerDraft>(customer ? {...customer,phone:customer.phone??"",email:customer.email??"",birthDate:customer.birthDate?.slice(0,10)??"",notes:customer.notes??""} : {...emptyCustomer});
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError("");
    try{
      const {result}=await executeCommand(customer?"updateCustomer":"createCustomer",{...draft,...(customer?{id:customer.id}:{})});
      if(customer){setSaved("Cliente atualizado."+(result.possibleDuplicates.length ? " Há possíveis duplicidades de telefone." : ""));router.refresh();}
      else router.push("/clientes/"+result.customer.id);
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar o cliente.");}finally{setBusy(false);}
  }
  return <form className="command-form" onSubmit={submit}><CustomerFields value={draft} onChange={setDraft} excludeId={customer?.id}/>{error&&<p role="alert" className="form-error">{error}</p>}{saved&&<p role="status" className="form-success">{saved}</p>}<Button type="submit" disabled={busy}>{busy?"Salvando…":customer?"Salvar alterações":"Cadastrar cliente"}</Button></form>;
}
