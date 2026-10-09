import Link from "next/link";
import { getActor } from "@/shared/lib/auth";
import { listCustomers } from "@/modules/customers/customer.service";
import { PageHeader } from "@/shared/components/design-system";
import { Panel, Table, Empty } from "@/shared/components/display";
import { Button } from "@/shared/components/ui/button";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams, search=typeof params.q==="string"?params.q:"",page=typeof params.page==="string"?params.page:"1";
  const d=await listCustomers(await getActor(),{search,page});
  const url=(page:number)=>"/clientes?"+new URLSearchParams({q:search,page:String(page)});
  return <><PageHeader title="Clientes" description="Conheça seus clientes e acompanhe o histórico de pedidos." actions={<Button asChild><Link href="/clientes/novo">Novo cliente</Link></Button>}/><Panel title="Seus clientes">
    <form className="filter-bar actions-row" action="/clientes"><label className="field">Buscar cliente<input name="q" type="search" maxLength={120} defaultValue={search} placeholder="Nome, telefone ou e-mail"/></label><Button type="submit" variant="outline">Buscar</Button>{search&&<Link className="text-link" href="/clientes">Limpar busca</Link>}</form>
    {d.customers.length?<Table headers={["Cliente","Contato","Situação","Perfil"]}>{d.customers.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone??"—"}<small>{c.email}</small></td><td>{c.active?"Ativo":"Inativo"}</td><td><Link className="text-link" href={"/clientes/"+c.id}>Ver perfil</Link></td></tr>)}</Table>:<Empty>{search?"Nenhum cliente encontrado para esta busca.":"Cadastre seu primeiro cliente. O vínculo com pedidos é opcional."}</Empty>}
    <div className="panel-bottom">{d.page>1&&<Link className="text-link" href={url(d.page-1)}>Página anterior</Link>}<span>Página {d.page}</span>{d.hasMore&&<Link className="text-link" href={url(d.page+1)}>Próxima página</Link>}</div>
  </Panel></>;
}
