import { z } from "zod";
const text=(max:number)=>z.string().trim().max(max).nullish().transform(v=>v||null);
const id=z.string().trim().min(1).max(100);
export const employeeSchema=z.object({
 name:z.string().trim().min(2,"Informe o nome do funcionário.").max(120),
 phone:text(40),
 email:z.union([z.email().max(254),z.literal("")]).nullish().transform(v=>v?.toLowerCase()||null),
 jobRoleId:text(100),userId:text(100),department:text(100),responsibilities:text(4000),
 hiredAt:text(10).refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),"Informe uma data de admissão válida."),
 active:z.boolean().default(true),notes:text(2000)
});
export const updateEmployeeSchema=employeeSchema.extend({id});
export const jobRoleSchema=z.object({id:id.optional(),name:z.string().trim().min(2,"Informe o nome da função.").max(100),description:text(2000)});
export const employeeFilterSchema=z.object({search:z.string().trim().max(120).default(""),jobRoleId:id.optional(),department:z.string().trim().max(100).optional(),active:z.boolean().optional(),page:z.coerce.number().int().min(1).max(100000).default(1)});
