import type { Role } from "@prisma/client";

export type Actor = { userId: string; organizationId: string; role: Role };
