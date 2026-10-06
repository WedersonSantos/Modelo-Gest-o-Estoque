import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class DomainError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "DomainError";
  }
}

export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new DomainError(message, status);
}

export function errorResponse(error: unknown) {
  if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  if (error instanceof SyntaxError) return Response.json({ error: "O corpo da solicitação deve conter JSON válido." }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return Response.json({ error: "Este registro já existe. Confira os dados informados." }, { status: 409 });
  }
  console.error("Falha na operação", error);
  return Response.json({ error: "Não foi possível concluir. Tente novamente." }, { status: 500 });
}
