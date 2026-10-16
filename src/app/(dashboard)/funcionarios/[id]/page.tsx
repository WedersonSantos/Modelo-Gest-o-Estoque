import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor } from "@/shared/lib/auth";
import { DomainError } from "@/shared/lib/errors";
import { getEmployee,employeeOptions } from "@/modules/employees/employee.service";
import { EmployeeForm } from "@/modules/employees/components/employee-form";
import { PageHeader } from "@/shared/components/design-system";
import { Panel,Badge,date,label } from "@/shared/components/display";
import { Button } from "@/shared/components/ui/button";
import { CommandButton } from "@/shared/components/command-form";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const actor=await getActor(),{id}=await params;
 const [e,options]=await Promise.all([getEmployee(actor,id).catch(error=>{if(error instanceof DomainError&&error.status===404)notFound();throw error;}),employeeOptions(actor)]);
 return <><PageHeader title={e.name} description={[e.jobRole?.name??"Sem função",e.department??"Sem setor"].join(" · ")} actions={<Button asChild variant="outline"><Link href="/funcionarios">Voltar para funcionários</Link></Button>}/>
  <Panel title="Perfil do funcionário"><p><Badge value={e.active?"ACTIVE":"INACTIVE"}/></p><p>Telefone: {e.phone??"Não informado"}</p><p>E-mail: {e.email??"Não informado"}</p><p>Admissão: {e.hiredAt?new Date(e.hiredAt).toISOString().slice(0,10).split("-").reverse().join("/"):"Não informada"}</p><p>Responsabilidades:</p>{e.responsibilities?<ul className="task-list">{e.responsibilities.split("\n").filter(Boolean).map((line,index)=><li key={index}>{line}</li>)}</ul>:<p>Nenhuma responsabilidade registrada.</p>}<p>{e.user?"Acesso vinculado: "+e.user.email+" · "+label(e.user.role)+(e.user.active?"":" · Conta inativa"):"Sem conta de acesso ao MESA."}</p><p>O cargo não define permissões. Ativar ou inativar este cadastro não altera o acesso da conta vinculada.</p><div className="actions-row"><CommandButton command="setEmployeeActive" payload={{id:e.id,active:!e.active}}>{e.active?"Inativar funcionário":"Ativar funcionário"}</CommandButton></div></Panel>
  <Panel title="Editar funcionário"><EmployeeForm key={String(e.updatedAt)} employee={e} options={options}/></Panel><p>Cadastro criado em {date(e.createdAt)} · atualizado em {date(e.updatedAt)}</p>
 </>;
}
