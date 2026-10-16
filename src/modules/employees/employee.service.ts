import { z } from "zod";
import { prisma,transaction } from "@/shared/lib/prisma";
import { assertRole,ADMIN_ROLES } from "@/shared/lib/permissions";
import { assert } from "@/shared/lib/errors";
import { audit } from "@/shared/lib/audit";
import type { Actor } from "@/shared/types/actor";
import { employeeSchema,updateEmployeeSchema,jobRoleSchema,employeeFilterSchema } from "./employee.schema";
const includes={jobRole:{select:{id:true,name:true,description:true}},user:{select:{id:true,name:true,email:true,role:true,active:true}}} as const;
const serialize=<T>(value:T)=>JSON.parse(JSON.stringify(value)) as T;
export async function employeeOptions(actor:Actor){
 assertRole(actor,ADMIN_ROLES);
 const [jobRoles,users,departments]=await Promise.all([
  prisma.jobRole.findMany({where:{organizationId:actor.organizationId},orderBy:{name:"asc"}}),
  prisma.user.findMany({where:{organizationId:actor.organizationId},select:{id:true,name:true,email:true,role:true,active:true},orderBy:{name:"asc"}}),
  prisma.employee.findMany({where:{organizationId:actor.organizationId,department:{not:null}},select:{department:true},distinct:["department"],orderBy:{department:"asc"}})
 ]);
 return {jobRoles,users,departments:departments.map(d=>d.department!).filter(Boolean)};
}
export async function listEmployees(actor:Actor,input:unknown={}){
 assertRole(actor,ADMIN_ROLES);const d=employeeFilterSchema.parse(input);
 const employees=await prisma.employee.findMany({where:{organizationId:actor.organizationId,...(d.active===undefined?{}:{active:d.active}),...(d.jobRoleId?{jobRoleId:d.jobRoleId}:{}),...(d.department?{department:d.department}:{}),...(d.search?{OR:[{name:{contains:d.search,mode:"insensitive" as const}},{email:{contains:d.search,mode:"insensitive" as const}},{phone:{contains:d.search}}]}:{})},include:includes,orderBy:[{name:"asc"},{id:"asc"}],skip:(d.page-1)*50,take:51});
 return {employees:serialize(employees.slice(0,50)),hasMore:employees.length>50,page:d.page};
}
export async function getEmployee(actor:Actor,id:string){
 assertRole(actor,ADMIN_ROLES);
 const employee=await prisma.employee.findFirst({where:{id,organizationId:actor.organizationId},include:includes});
 assert(employee,"Funcionário não encontrado.",404);return serialize(employee);
}
export async function saveJobRole(actor:Actor,input:unknown){
 assertRole(actor,ADMIN_ROLES);const d=jobRoleSchema.parse(input);
 return transaction(async tx=>{
  if(d.id)assert(await tx.jobRole.findFirst({where:{id:d.id,organizationId:actor.organizationId}}),"Função não encontrada.",404);
  const role=d.id?await tx.jobRole.update({where:{id_organizationId:{id:d.id,organizationId:actor.organizationId}},data:{name:d.name,description:d.description}}):await tx.jobRole.create({data:{organizationId:actor.organizationId,name:d.name,description:d.description}});
  await audit(tx,actor,"JOB_ROLE_SAVED","JobRole",role.id);return role;
 });
}
export async function createEmployee(actor:Actor,input:unknown){return saveEmployee(actor,input,false);}
export async function updateEmployee(actor:Actor,input:unknown){return saveEmployee(actor,input,true);}
async function saveEmployee(actor:Actor,input:unknown,updating:boolean){
 assertRole(actor,ADMIN_ROLES);
 const d=updating?updateEmployeeSchema.parse(input):employeeSchema.parse(input);
 const id=updating?updateEmployeeSchema.parse(input).id:undefined;
 return transaction(async tx=>{
  if(id)assert(await tx.employee.findFirst({where:{id,organizationId:actor.organizationId}}),"Funcionário não encontrado.",404);
  if(d.jobRoleId)assert(await tx.jobRole.findFirst({where:{id:d.jobRoleId,organizationId:actor.organizationId}}),"Função não encontrada.",404);
  if(d.userId){
   assert(await tx.user.findFirst({where:{id:d.userId,organizationId:actor.organizationId}}),"Usuário não encontrado.",404);
   assert(!await tx.employee.findFirst({where:{organizationId:actor.organizationId,userId:d.userId,...(id?{id:{not:id}}:{})}}),"Este usuário já está vinculado a outro funcionário.",409);
  }
  const {name,phone,email,jobRoleId,userId,department,responsibilities,active,notes}=d;
  const data={name,phone,email,jobRoleId,userId,department,responsibilities,active,notes,hiredAt:d.hiredAt?new Date(d.hiredAt+"T00:00:00.000Z"):null};
  const employee=id?await tx.employee.update({where:{id_organizationId:{id,organizationId:actor.organizationId}},data,include:includes}):await tx.employee.create({data:{...data,organizationId:actor.organizationId},include:includes});
  // Linking an account or changing a job title NEVER modifies User.role, User.active or sessions.
  await audit(tx,actor,id?"EMPLOYEE_UPDATED":"EMPLOYEE_CREATED","Employee",employee.id,{jobRoleId,userId,active});
  return employee;
 });
}
export async function setEmployeeActive(actor:Actor,input:unknown){
 assertRole(actor,ADMIN_ROLES);const d=z.object({id:z.string().min(1),active:z.boolean()}).parse(input);
 return transaction(async tx=>{
  const changed=await tx.employee.updateMany({where:{id:d.id,organizationId:actor.organizationId},data:{active:d.active}});
  assert(changed.count===1,"Funcionário não encontrado.",404);
  await audit(tx,actor,d.active?"EMPLOYEE_ACTIVATED":"EMPLOYEE_DEACTIVATED","Employee",d.id);
  return {id:d.id};
 });
}
export type Employee=Awaited<ReturnType<typeof getEmployee>>;
export type EmployeeOptions=Awaited<ReturnType<typeof employeeOptions>>;
