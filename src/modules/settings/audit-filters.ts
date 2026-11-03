import {z} from "zod";
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"Informe uma data válida.").refine(value=>{const d=new Date(value+"T12:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;},"Informe uma data válida.");
export const auditFiltersSchema=z.object({
 from:z.preprocess(v=>v===""?undefined:v,day.optional()),
 to:z.preprocess(v=>v===""?undefined:v,day.optional()),
 page:z.coerce.number().int().min(1).max(1000000).default(1)
}).refine(v=>!v.from||!v.to||v.from<=v.to,"A data inicial deve ser anterior ou igual à data final.");
export const AUDIT_PAGE_SIZE=10;
export function auditDateRange(from?:string,to?:string){
 return {...(from?{gte:new Date(from+"T00:00:00-03:00")}:{}),...(to?{lt:new Date(new Date(to+"T00:00:00-03:00").getTime()+86400000)}:{})};
}
