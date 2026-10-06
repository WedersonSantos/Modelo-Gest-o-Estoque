"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, Truck, Wallet, ChartNoAxesCombined, Settings, UtensilsCrossed, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { label } from "./display";
const navigation=[{href:"/dashboard",name:"Visão geral",icon:LayoutDashboard},{href:"/estoque",name:"Estoque",icon:Package},{href:"/compras",name:"Compras",icon:ShoppingCart},{href:"/fornecedores",name:"Fornecedores",icon:Truck},{href:"/financeiro",name:"Financeiro",icon:Wallet},{href:"/relatorios",name:"Relatórios",icon:ChartNoAxesCombined},{href:"/configuracoes",name:"Configurações",icon:Settings}];
export function AppShell({children,organization,user,role}:{children:ReactNode;organization:string;user:string;role:string}) {
 const path=usePathname(),router=useRouter();
 const admin=["OWNER","ADMIN"].includes(role),finance=["OWNER","ADMIN","VIEWER"].includes(role);
 return <div className="app-shell"><aside className="sidebar"><Link href="/dashboard" className="brand"><span className="brand-icon"><UtensilsCrossed size={22}/></span><span>Mesa<span className="brand-sub">Gestão do restaurante</span></span></Link><div className="organization-name">{organization}</div><nav aria-label="Navegação principal">{navigation.filter(n=>(n.href!=="/financeiro"||finance)&&(n.href!=="/configuracoes"||admin)).map(({href,name,icon:Icon})=><Link key={href} href={href} className={path.startsWith(href)?"nav-link active":"nav-link"} aria-current={path.startsWith(href)?"page":undefined}><Icon size={19}/>{name}</Link>)}</nav><div className="sidebar-foot"><span className="avatar">{user.slice(0,1)}</span><div><strong>{user}</strong><small>{label(role)}</small></div><Button variant="ghost" size="icon" aria-label="Sair" onClick={async()=>{const r=await fetch("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if(r.ok){router.push("/login");router.refresh();}}}><LogOut size={18}/></Button></div></aside><div className="app-content"><header className="topbar"><span>Seu restaurante, em ordem.</span><span className="today">{new Date().toLocaleDateString("pt-BR",{day:"numeric",month:"long",timeZone:"America/Sao_Paulo"})}</span></header><main id="main-content">{children}</main><footer className="app-footer">Mesa · Estoque, compras e finanças no mesmo lugar</footer></div></div>;
}
