import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { currency,quantity } from "./display";
export function PageHeader({title,description,actions}:{title:string;description?:string;actions?:ReactNode}){return <div className="page-heading"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions}</div>;}
export function StatCard({label,value,hint,icon:Icon,tone}:{label:string;value:string;hint?:string;icon?:LucideIcon;tone?:"positive"|"negative"}){return <article className="metric"><div className="stat-label"><span>{label}</span>{Icon&&<Icon size={20} aria-hidden="true"/>}</div><strong className={tone}>{value}</strong>{hint&&<small>{hint}</small>}</article>;}
export function FormSection({title,description,children}:{title:string;description?:string;children:ReactNode}){return <fieldset className="form-section"><legend>{title}</legend>{description&&<p>{description}</p>}<div className="form-grid">{children}</div></fieldset>;}
export function MoneyValue({value}:{value:string|number}){return <span className="numeric">{currency(value)}</span>;}
export function QuantityValue({value,unit}:{value:string|number;unit?:string}){return <span className="numeric">{quantity(value)}{unit?" "+unit:""}</span>;}
export function LoadingSkeleton(){return <div className="loading-skeleton" role="status" aria-label="Carregando"><div className="skeleton skeleton-title"/><div className="metrics">{[0,1,2,3].map(i=><div key={i} className="skeleton skeleton-stat"/>)}</div><div className="skeleton skeleton-panel"/><span className="sr-only">Carregando o restaurante…</span></div>;}
export function FilterBar({children}:{children:ReactNode}){return <div className="filter-bar">{children}</div>;}
