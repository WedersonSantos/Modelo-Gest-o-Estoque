import { getActor } from "@/shared/lib/auth";
import { errorResponse } from "@/shared/lib/errors";
import { listEmployees,employeeOptions } from "@/modules/employees/employee.service";
export async function GET(request:Request){
 try{
  const actor=await getActor(),q=new URL(request.url).searchParams;
  const result=q.get("options")==="true"?await employeeOptions(actor):await listEmployees(actor,{search:q.get("search")??"",jobRoleId:q.get("jobRoleId")||undefined,department:q.get("department")||undefined,active:q.get("active")==="true"?true:q.get("active")==="false"?false:undefined,page:q.get("page")??1});
  return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return errorResponse(error);}
}
