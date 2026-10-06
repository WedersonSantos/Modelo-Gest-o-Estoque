import { getActor } from "@/shared/lib/auth";
import { getWorkspaceData } from "@/modules/dashboard";
import { errorResponse } from "@/shared/lib/errors";
const cell=(v:unknown)=>`"${String(v??"").replace(/^[=+\-@]/,"'$&").replaceAll('"','""')}"`;
export async function GET(request:Request){try{const actor=await getActor();const q=new URL(request.url).searchParams;const d=await getWorkspaceData(actor,{from:q.get("from")??undefined,to:q.get("to")??undefined,context:q.get("context")||undefined});const rows=[["Ingrediente","Quantidade","Unidade","Custo (R$)"],...d.consumption.map(c=>[c.product.name,c.quantity,c.product.unit,c.cost])];return new Response("\ufeff"+rows.map(r=>r.map(cell).join(";")).join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="consumo-${d.period.from}-${d.period.to}.csv"`,"Cache-Control":"private, no-store"}});}catch(e){return errorResponse(e);}}
