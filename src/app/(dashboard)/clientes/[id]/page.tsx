import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor } from "@/shared/lib/auth";
import { DomainError } from "@/shared/lib/errors";
import { getCustomerProfile } from "@/modules/customers/customer.service";
import { whatsappUrl } from "@/modules/customers/customer.rules";
import { CustomerForm } from "@/modules/customers/components/customer-form";
import { PageHeader, StatCard } from "@/shared/components/design-system";
import { Panel, Table, Empty, Badge, currency, date } from "@/shared/components/display";
import { CommandButton } from "@/shared/components/command-form";
import { Button } from "@/shared/components/ui/button";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params,s=await searchParams,page=Number(typeof s.page==="string"?s.page:1);
  const d=await getCustomerProfile(await getActor(),id,page).catch(e=>{if(e instanceof DomainError&&e.status===404)notFound();throw e;});
  const c=d.customer,m=d.metrics,whatsapp=whatsappUrl(c.phone);
  return <><PageHeader title={c.name} description={c.active?"Cliente ativo":"Cliente inativo"} actions={<><Button asChild variant="outline"><Link href="/clientes">Voltar para clientes</Link></Button>{whatsapp&&<Button asChild><a href={whatsapp} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></Button>}</>}/>
    {d.possibleDuplicates.length>0&&<p role="status" className="form-error">Possível duplicidade de telefone: {d.possibleDuplicates.map(c=>c.name).join(", ")}. Famílias podem compartilhar o número; os cadastros foram preservados.</p>}<Panel title="Contato"><p>{c.phone??"Telefone não informado"}</p><p>{c.email??"E-mail não informado"}</p><p>Marketing: {c.marketingConsent?"Autorizado em "+date(c.marketingConsentAt):"Não autorizado"}</p><div className="actions-row"><CommandButton command="setCustomerActive" payload={{id:c.id,active:!c.active}}>{c.active?"Inativar cliente":"Ativar cliente"}</CommandButton></div></Panel>
    <div className="metrics"><StatCard label="Total de pedidos" value={String(m.totalOrders)} hint={m.completedOrders+" finalizados"}/><StatCard label="Total gasto" value={currency(m.totalSpent)} hint="Apenas pedidos finalizados"/><StatCard label="Ticket médio" value={currency(m.averageTicket)} hint="Média dos pedidos finalizados"/><StatCard label="Última compra" value={date(m.lastPurchase)} hint={"Primeira compra: "+date(m.firstPurchase)}/></div>
    <Panel title="Histórico de pedidos" description="Pedidos em andamento e cancelados permanecem no histórico; não entram no total gasto.">{d.orders.length?<Table headers={["Pedido","Data","Itens","Situação","Total"]}>{d.orders.map(o=><tr key={o.id}><td>#{o.number}</td><td>{date(o.createdAt)}</td><td>{o.items.map(i=><small key={i.id}>{i.quantity} × {i.name}</small>)}</td><td><Badge value={o.status}/></td><td>{currency(o.total)}</td></tr>)}</Table>:<Empty>Este cliente ainda não tem pedidos vinculados.</Empty>}<div className="panel-bottom">{d.page>1&&<Link className="text-link" href={"/clientes/"+id+"?page="+(d.page-1)}>Página anterior</Link>}<span>Página {d.page}</span>{d.hasMore&&<Link className="text-link" href={"/clientes/"+id+"?page="+(d.page+1)}>Próxima página</Link>}</div></Panel>
    <Panel title="Editar cadastro"><CustomerForm key={c.updatedAt} customer={c}/></Panel>
  </>;
}
