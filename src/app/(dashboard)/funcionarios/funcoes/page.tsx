import Link from "next/link";
import { getActor } from "@/shared/lib/auth";
import { employeeOptions } from "@/modules/employees/employee.service";
import { PageHeader } from "@/shared/components/design-system";
import { Panel,Table,Empty } from "@/shared/components/display";
import { Button } from "@/shared/components/ui/button";
import { CommandForm } from "@/shared/components/command-form";
export default async function Page(){
 const {jobRoles}=await employeeOptions(await getActor());
 return <><PageHeader title="Funções da equipe" description="Funções descrevem o trabalho. As permissões de acesso continuam na conta do usuário." actions={<Button asChild variant="outline"><Link href="/funcionarios">Voltar para funcionários</Link></Button>}/>
  <Panel title="Cadastrar função" description="Exemplos: Cozinheiro, Auxiliar de cozinha, Cafeteria, Atendente, Caixa, Comprador, Gerente e Limpeza."><CommandForm command="saveJobRole" fields={[{name:"name",label:"Nome da função"},{name:"description",label:"Descrição da função",type:"textarea",required:false}]} submit="Cadastrar função"/></Panel>
  <Panel title="Funções cadastradas">{jobRoles.length?<Table headers={["Função","Descrição","Editar"]}>{jobRoles.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.description??"—"}</td><td><details><summary>Editar função</summary><CommandForm command="saveJobRole" hidden={{id:r.id}} fields={[{name:"name",label:"Nome da função",value:r.name},{name:"description",label:"Descrição da função",type:"textarea",required:false,value:r.description??""}]} submit="Salvar função"/></details></td></tr>)}</Table>:<Empty>Cadastre uma função para organizar a equipe. O cadastro do funcionário também pode ficar sem função.</Empty>}</Panel>
 </>;
}
