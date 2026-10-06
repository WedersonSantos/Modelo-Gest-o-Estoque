import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

function isSerializationConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  // SELECT ... FOR UPDATE is a raw query; Prisma reports its SQLSTATE through P2010.
  return error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code));
}

/** Retry serialization conflicts only. The callback must contain database work, never external effects. */
export async function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1) + Math.random() * 50));
    }
  }
  throw new Error("Falha inesperada ao abrir transação.");
}
