import type { Role } from "@prisma/client";
import type { Actor } from "@/shared/types/actor";
import { DomainError } from "./errors";

export function assertRole(actor: Actor, roles: readonly Role[]) {
  if (!roles.includes(actor.role)) throw new DomainError("Seu perfil não permite esta operação.", 403);
}

export const ADMIN_ROLES: readonly Role[] = ["OWNER", "ADMIN"];
export const STOCK_ROLES: readonly Role[] = ["OWNER", "ADMIN", "OPERATOR"];
export const BUYING_ROLES: readonly Role[] = ["OWNER", "ADMIN", "BUYER"];
