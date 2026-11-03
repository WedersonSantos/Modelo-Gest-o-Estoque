import {getActor} from "@/shared/lib/auth";
import {errorResponse} from "@/shared/lib/errors";
import {getAuditPage} from "@/modules/settings/audit-query";
export async function GET(request:Request){
 try{
  const q=new URL(request.url).searchParams;
  const result=await getAuditPage(await getActor(),{page:q.get("page")??1,from:q.get("from")??"",to:q.get("to")??""});
  return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return errorResponse(error);}
}
