import {getAuditPage,type AuditPageData} from "../audit-query";
import {AuditPanel} from "./audit-panel";
import type { WorkspaceData } from "@/modules/dashboard";
import { CommandForm } from "@/shared/components/command-form";
import { Badge, label, Panel, Table } from "@/shared/components/display";
export async function SettingsView({data:d}:{data:WorkspaceData}) {
 const page=await getAuditPage({organizationId:d.organization.id,userId:d.user.id,role:d.user.role});
 const initial=JSON.parse(JSON.stringify(page)) as AuditPageData;
 return <><div className="page-heading"><div><h1>Configurações</h1><p>{d.organization.name} · Usuários, categorias e rastreabilidade.</p></div></div><Panel title="Equipe e permissões" description="Proprietário e administrador controlam finanças. Comprador organiza compras; operador registra estoque e recebimentos; consulta permite leitura. Cozinha acessa somente a produção de pedidos."><CommandForm command="createUser" fields={[{name:"name",label:"Nome"},{name:"email",label:"E-mail",type:"email"},{name:"password",label:"Senha inicial",type:"password",placeholder:"Pelo menos 10 caracteres"},{name:"role",label:"Perfil",options:["ADMIN","BUYER","OPERATOR","VIEWER","KITCHEN"].map(v=>({value:v,label:label(v)}))}]} submit="Cadastrar usuário"/><Table headers={["Nome","E-mail","Perfil","Situação"]}>{d.users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><Badge value={u.role}/></td><td>{u.active?"Ativo":"Inativo"}</td></tr>)}</Table></Panel><Panel title="Categorias de ingredientes"><CommandForm command="createCategory" fields={[{name:"name",label:"Nome da categoria"}]} submit="Criar categoria"/><div className="category-list">{d.categories.map(c=><span className="badge" key={c.id}>{c.name}</span>)}</div></Panel><AuditPanel key={(initial.rows[0]?.id??"empty")+":"+initial.total} initial={initial}/></>;
}
