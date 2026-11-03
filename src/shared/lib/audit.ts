import { Prisma } from "@prisma/client";
import type { Actor } from "@/shared/types/actor";

export async function audit(tx: Prisma.TransactionClient, actor: Actor, action: string, entity: string, entityId: string, details?: unknown) {
  const employee=await tx.employee.findFirst({where:{organizationId:actor.organizationId,userId:actor.userId},select:{name:true}});
  const normalized = details === undefined ? undefined : details === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue;
  return tx.auditLog.create({
    data: { actorRole:actor.role, actorEmployeeName:employee?.name??null, organizationId: actor.organizationId, userId: actor.userId, action, entity, entityId, details: normalized },
  });
}
