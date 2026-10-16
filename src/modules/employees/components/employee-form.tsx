"use client";
import { useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormSection } from "@/shared/components/design-system";
import { FormFields,executeCommand,type Field } from "@/shared/components/command-form";
import { Button } from "@/shared/components/ui/button";
import { label } from "@/shared/components/display";
import type { Employee,EmployeeOptions } from "../employee.service";
export function EmployeeForm({employee,options}:{employee?:Employee;options:EmployeeOptions}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const personal:Field[]=[
  {name:"name",label:"Nome do funcionário",value:employee?.name},
  {name:"phone",label:"Telefone",type:"tel",required:false,value:employee?.phone??""},
  {name:"email",label:"E-mail",type:"email",required:false,value:employee?.email??""},
  {name:"hiredAt",label:"Data de admissão",type:"date",required:false,value:employee?.hiredAt?new Date(employee.hiredAt).toISOString().slice(0,10):""}
 ];
 const professional:Field[]=[
  {name:"jobRoleId",label:"Função",required:false,value:employee?.jobRoleId??"",options:options.jobRoles.map(r=>({value:r.id,label:r.name}))},
  {name:"department",label:"Setor",required:false,value:employee?.department??"",placeholder:"Cozinha, cafeteria, salão…"},
  {name:"responsibilities",label:"Responsabilidades",type:"textarea",required:false,value:employee?.responsibilities??"",placeholder:"Uma responsabilidade por linha"}
 ];
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError("");
  const fields=Object.fromEntries(new FormData(event.currentTarget));
  try{
   const {result}=await executeCommand(employee?"updateEmployee":"createEmployee",{...fields,...(employee?{id:employee.id}:{}),active:employee?.active??true});
   router.push("/funcionarios/"+result.id);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar. Confira os dados e tente novamente.");}finally{setBusy(false);}
 }
 return <form className="command-form" onSubmit={submit}>
  <FormSection title="Dados pessoais"><FormFields fields={personal}/></FormSection>
  <FormSection title="Trabalho"><FormFields fields={professional}/><Link href="/funcionarios/funcoes" className="text-link">Gerenciar funções</Link></FormSection>
  <FormSection title="Acesso ao MESA" description="O cadastro de funcionário não cria uma conta. O cargo não altera permissões.">
   <FormFields fields={[{name:"userId",label:"Usuário vinculado (opcional)",required:false,value:employee?.userId??"",options:options.users.map(u=>({value:u.id,label:u.name+" · "+u.email+" · "+label(u.role)+(u.active?"":" · Inativo")}))}]}/>
   <p className="wide-field">Sem vínculo, o funcionário permanece sem acesso. As contas e permissões são administradas em <Link href="/configuracoes" className="text-link">Configurações</Link>.</p>
  </FormSection>
  <FormSection title="Observações"><FormFields fields={[{name:"notes",label:"Observações do cadastro",type:"textarea",required:false,value:employee?.notes??""}]}/></FormSection>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <Button type="submit" disabled={busy}>{busy?"Salvando…":employee?"Salvar alterações":"Cadastrar funcionário"}</Button>
 </form>;
}
