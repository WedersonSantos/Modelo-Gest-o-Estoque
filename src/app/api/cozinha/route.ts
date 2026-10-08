import { getActor } from "@/shared/lib/auth";
import { getKitchen } from "@/modules/orders/order.service";
import { errorResponse } from "@/shared/lib/errors";
export async function GET(){try{return Response.json({orders:await getKitchen(await getActor())},{headers:{"Cache-Control":"private, no-store"}});}catch(e){return errorResponse(e);}}
