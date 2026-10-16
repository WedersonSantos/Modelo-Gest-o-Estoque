import Link from "next/link";
import { getActor } from "@/shared/lib/auth";
import { employeeOptions,listEmployees } from "@/modules/employees/employee.service";
import { PageHeader } from "@/shared/components/design-system";
import { Panel,Table,Empty,Badge } from "@/shared/components/display";
import { Button } from "@/shared/components/ui/button";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams,value=(name:string)=>typeof query[name]==="string"?query[name] as string:"";
 const actor=await getActor(),search=value("q"),jobRoleId=value("jobRoleId"),department=value("department"),active=value("active");
 const [d,options]=await Promise.all([listEmployees(actor,{search,jobRoleId:jobRoleId||undefined,department:department||undefined,active:active==="true"?true:active==="false"?false:undefined,page:value("page")||1}),employeeOptions(actor)]);
 const url=(page:number)=>"/funcionarios?"+new URLSearchParams({q:search,jobRoleId,department,active,page:String(page)});
 return <><PageHeader title="Funcionários" description="Organize a equipe, suas funções e responsabilidades." actions={<><Button asChild variant="outline"><Link href="/funcionarios/funcoes">Gerenciar funções</Link></Button><Button asChild><Link href="/funcionarios/novo">Novo funcionário</Link></Button></>}/>
  <Panel title="Sua equipe"><form key={[search,jobRoleId,department,active].join("|")} action="/funcionarios" className="filter-bar actions-row">
   <label className="field">Pesquisar funcionários<input type="search" name="q" maxLength={120} defaultValue={search} placeholder="Nome, telefone ou e-mail"/></label>
   <label className="field">Filtrar por função<select name="jobRoleId" defaultValue={jobRoleId}><option value="">Todas as funções</option>{options.jobRoles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <label className="field">Filtrar por setor<select name="department" defaultValue={department}><option value="">Todos os setores</option>{options.departments.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
   <label className="field">Situação<select name="active" defaultValue={active}><option value="">Todas</option><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
   <Button type="submit" variant="outline">Aplicar filtros</Button><Link href="/funcionarios" className="text-link">Limpar filtros</Link>
  </form>
  {d.employees.length?<Table headers={["Funcionário","Função / setor","Contato","Situação","Perfil"]}>{d.employees.map(e=><tr key={e.id}><td><strong>{e.name}</strong><small>{e.user?"Usuário vinculado":"Sem acesso ao MESA"}</small></td><td>{e.jobRole?.name??"Sem função"}<small>{e.department??"Sem setor"}</small></td><td>{e.phone??"—"}<small>{e.email}</small></td><td><Badge value={e.active?"ACTIVE":"INACTIVE"}/></td><td><Link className="text-link" href={"/funcionarios/"+e.id}>Ver perfil</Link></td></tr>)}</Table>:<Empty>{search||jobRoleId||department||active?"Nenhum funcionário encontrado para os filtros.":"Cadastre o primeiro funcionário. Ele pode existir sem uma conta de acesso."}</Empty>}
  <div className="panel-bottom">{d.page>1&&<Link className="text-link" href={url(d.page-1)}>Página anterior</Link>}<span>Página {d.page}</span>{d.hasMore&&<Link className="text-link" href={url(d.page+1)}>Próxima página</Link>}</div></Panel>
 </>;
}
