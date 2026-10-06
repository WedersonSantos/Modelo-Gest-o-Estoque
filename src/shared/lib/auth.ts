import { createHash, randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { prisma, transaction } from "./prisma";
import { assert, DomainError } from "./errors";
import { loginSchema, registerSchema } from "@/modules/settings/settings.schema";
import { registerOrganization } from "@/modules/settings/settings.service";
import type { Actor } from "@/shared/types/actor";

export type { Actor } from "@/shared/types/actor";
export { assertRole } from "./permissions";
export const SESSION_COOKIE = "restaurante_session";
const SESSION_AGE = 60 * 60 * 24 * 7;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
// A fixed valid hash ensures absent accounts also perform the expensive password comparison.
const DUMMY_HASH = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

export async function getActor(): Promise<Actor> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  assert(token && /^[a-f0-9]{64}$/.test(token), "Entre na sua conta para continuar.", 401);
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  assert(session && session.expiresAt > new Date() && session.user.active, "Sua sessão expirou. Entre novamente.", 401);
  return { userId: session.user.id, organizationId: session.user.organizationId, role: session.user.role };
}

export const requireActor = getActor;

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.APP_URL;
  const expected = configured ? new URL(configured).origin : new URL(request.url).origin;
  assert(origin && origin === expected, "Origem da solicitação não permitida.", 403);
  const fetchSite = request.headers.get("sec-fetch-site");
  assert(!fetchSite || fetchSite === "same-origin" || fetchSite === "none", "Solicitação entre sites não permitida.", 403);
}

/** Database-backed per-account throttling also works across multiple server instances. */
async function throttle(scope: string, email: string, limit = 10) {
  const key = hashToken(`${scope}:${email}`);
  const now = new Date();
  const allowed = await transaction(async (tx) => {
    const row = await tx.authRateLimit.upsert({ where: { key }, update: { key }, create: { key, attempts: 0, windowStart: now } });
    if (row.blockedUntil && row.blockedUntil > now) return false;
    const freshWindow = now.getTime() - row.windowStart.getTime() >= 15 * 60_000;
    const attempts = freshWindow ? 1 : row.attempts + 1;
    await tx.authRateLimit.update({ where: { key }, data: { attempts, windowStart: freshWindow ? now : row.windowStart, blockedUntil: attempts >= limit ? new Date(now.getTime() + 15 * 60_000) : null } });
    return attempts <= limit;
  });
  if (!allowed) throw new DomainError("Muitas tentativas. Aguarde 15 minutos e tente novamente.", 429);
  return key;
}

async function createSession(user: { id: string; organizationId: string }) {
  const cookieStore = await cookies();
  const previousToken = cookieStore.get(SESSION_COOKIE)?.value;
  const token = randomBytes(32).toString("hex");
  await transaction(async (tx) => {
    if (previousToken) await tx.session.deleteMany({ where: { tokenHash: hashToken(previousToken) } });
    await tx.session.deleteMany({ where: { userId: user.id, organizationId: user.organizationId, expiresAt: { lte: new Date() } } });
    await tx.session.create({ data: { userId: user.id, organizationId: user.organizationId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_AGE * 1000) } });
  });
  cookieStore.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_AGE });
}

export async function login(input: unknown) {
  const data = loginSchema.parse(input);
  const key = await throttle("login", data.email);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const valid = await compare(data.password, user?.passwordHash ?? DUMMY_HASH);
  assert(user && user.active && valid, "E-mail ou senha inválidos.", 401);
  await createSession(user);
  await prisma.authRateLimit.deleteMany({ where: { key } });
}

export async function register(input: unknown) {
  const data = registerSchema.parse(input);
  await throttle("register", data.email, 5);
  const user = await registerOrganization(data);
  await createSession(user);
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}
