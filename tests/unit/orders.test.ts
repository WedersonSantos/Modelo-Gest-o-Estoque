import { describe,it,expect } from "vitest";
import { validateOrderTransition,ORDER_ROLES,KITCHEN_ROLES } from "@/modules/orders/order.rules";
import { assertRole } from "@/shared/lib/permissions";
const actor={userId:"test",organizationId:"org",role:"KITCHEN" as const};
describe("pedidos e permissões da cozinha",()=>{
 it("permite somente a sequência de preparo",()=>{for(const [a,b]of [["SENT_TO_KITCHEN","PREPARING"],["PREPARING","READY"],["READY","COMPLETED"]] as const)expect(()=>validateOrderTransition(a,b,"KITCHEN")).not.toThrow();expect(()=>validateOrderTransition("DRAFT","READY","OWNER")).toThrow();expect(()=>validateOrderTransition("COMPLETED","PREPARING","OWNER")).toThrow();});
 it("restringe cozinha a produção",()=>{expect(()=>assertRole(actor,KITCHEN_ROLES)).not.toThrow();expect(()=>assertRole(actor,ORDER_ROLES)).toThrow();expect(()=>validateOrderTransition("DRAFT","SENT_TO_KITCHEN","KITCHEN")).toThrow();expect(()=>validateOrderTransition("PREPARING","CANCELED","KITCHEN")).toThrow();});
 it("permite cancelamento administrativo antes da conclusão",()=>{expect(()=>validateOrderTransition("PREPARING","CANCELED","OWNER")).not.toThrow();expect(()=>validateOrderTransition("CANCELED","READY","OWNER")).toThrow();});
});
