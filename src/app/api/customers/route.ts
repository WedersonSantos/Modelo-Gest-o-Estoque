import { getActor } from "@/shared/lib/auth";
import { errorResponse } from "@/shared/lib/errors";
import { listCustomers, findPhoneDuplicates } from "@/modules/customers/customer.service";
export async function GET(request:Request) {
  try {
    const actor=await getActor(),url=new URL(request.url);
    const result=url.searchParams.has("phone") ? await findPhoneDuplicates(actor,{phone:url.searchParams.get("phone"),excludeId:url.searchParams.get("excludeId") ?? undefined}) : await listCustomers(actor,{search:url.searchParams.get("search") ?? "",page:url.searchParams.get("page") ?? "1",active:url.searchParams.get("active")==="true" ? true : undefined});
    return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});
  } catch(e) {return errorResponse(e);}
}
