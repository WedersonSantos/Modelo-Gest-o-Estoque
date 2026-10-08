import type { CustomerOrderStatus, Role } from "@prisma/client";
import { DomainError } from "@/shared/lib/errors";
export const ORDER_ROLES: readonly Role[] = ["OWNER","ADMIN","OPERATOR"];
export const KITCHEN_ROLES: readonly Role[] = [...ORDER_ROLES,"KITCHEN"];
const transitions: Record<CustomerOrderStatus, CustomerOrderStatus[]> = {
 DRAFT:["SENT_TO_KITCHEN","CANCELED"], SENT_TO_KITCHEN:["PREPARING","CANCELED"],
 PREPARING:["READY","CANCELED"], READY:["COMPLETED","CANCELED"], COMPLETED:[], CANCELED:[]
};
export function validateOrderTransition(from:CustomerOrderStatus,to:CustomerOrderStatus,role:Role) {
 if (!transitions[from].includes(to)) throw new DomainError("O pedido mudou de etapa. Atualize a lista e tente novamente.",409);
 if(role==="KITCHEN" && !["PREPARING","READY","COMPLETED"].includes(to)) throw new DomainError("Seu perfil permite somente as etapas da cozinha.",403);
}
