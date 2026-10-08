import { currency,Table,Empty } from "./display";
type Row={paidAt:string|null;type:string;_sum:{amount:string|null}};
export function FinancialChart({rows}:{rows:Row[]}){
 const grouped=new Map<string,{income:number;expense:number}>();
 for(const row of rows){if(!row.paidAt)continue;const day=new Date(row.paidAt).toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});const v=grouped.get(day)??{income:0,expense:0};if(row.type==="INCOME")v.income+=Number(row._sum.amount??0);else v.expense+=Number(row._sum.amount??0);grouped.set(day,v);}
 const days=[...grouped].sort(([a],[b])=>a.localeCompare(b));const monthly=days.length>31;
 const buckets=new Map<string,{income:number;expense:number}>();
 for(const [day,v]of days){const key=monthly?day.slice(0,7):day;const b=buckets.get(key)??{income:0,expense:0};b.income+=v.income;b.expense+=v.expense;buckets.set(key,b);}
 const data=[...buckets];if(!data.length)return <Empty>Registre receitas e despesas pagas para acompanhar o movimento financeiro.</Empty>;
 const max=Math.max(...data.map(([,v])=>Math.max(v.income,v.expense)),1);
 const width=720,height=250,left=82,top=16,bottom=42,plot=height-top-bottom,step=(width-left-16)/data.length,bar=Math.min(24,step*.3);
 const text=(key:string)=>monthly?key.slice(5)+"/"+key.slice(0,4):key.slice(8)+"/"+key.slice(5,7);
 return <figure className="financial-chart"><div className="chart-legend"><span><i/>Receitas recebidas</span><span><i className="expense-dot"/>Despesas pagas</span></div><svg viewBox={"0 0 "+width+" "+height} role="img" aria-label="Receitas e despesas pagas, agrupadas pela data de pagamento"><title>Movimentação financeira do período</title>{[0,.5,1].map(t=><g key={t}><line className="chart-grid" x1={left} x2={width-16} y1={top+plot*(1-t)} y2={top+plot*(1-t)}/><text className="chart-label" x={left-12} y={top+plot*(1-t)+4} textAnchor="end">{currency(max*t)}</text></g>)}{data.map(([key,v],i)=><g key={key}>{[["income",v.income],["expense",v.expense]].map(([name,value],j)=><rect key={name} className={"chart-bar chart-"+name} x={left+step*i+step/2+(j===0?-bar-2:2)} y={top+plot*(1-Number(value)/max)} width={bar} height={plot*Number(value)/max} rx={3} tabIndex={0}><title>{text(key)+" · "+(name==="income"?"Receitas":"Despesas")+": "+currency(value)}</title></rect>)}{(data.length<12||i%Math.ceil(data.length/10)===0)&&<text className="chart-label" x={left+step*i+step/2} y={height-16} textAnchor="middle">{text(key)}</text>}</g>)}</svg><details><summary>Ver valores do gráfico</summary><Table headers={["Data","Receitas recebidas","Despesas pagas"]}>{data.map(([key,v])=><tr key={key}><td>{text(key)}</td><td>{currency(v.income)}</td><td>{currency(v.expense)}</td></tr>)}</Table></details></figure>;
}
