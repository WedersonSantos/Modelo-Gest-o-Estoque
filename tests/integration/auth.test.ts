import "./setup";
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { login } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { registerOrganization } from "@/modules/settings";

describe("database-backed authentication", () => {
  it("creates an empty restaurant, owner and default categories atomically", async () => {
    const email = `owner-${randomUUID()}@example.test`;
    const user = await registerOrganization({ organizationName: "Onboarding test", name: "Test owner", email, password: "TestPassword123" });
    expect(user.role).toBe("OWNER");
    const [products, entries, categories, userRow] = await Promise.all([
      prisma.product.count({ where: { organizationId: user.organizationId } }),
      prisma.financialEntry.count({ where: { organizationId: user.organizationId } }),
      prisma.productCategory.count({ where: { organizationId: user.organizationId } }),
      prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    ]);
    expect(products).toBe(0);
    expect(entries).toBe(0);
    expect(categories).toBe(5);
    expect(userRow.passwordHash).not.toBe("TestPassword123");
    const duplicateName = `Duplicate ${randomUUID()}`;
    await expect(registerOrganization({ organizationName: duplicateName, name: "Test owner", email, password: "TestPassword123" })).rejects.toThrow();
    expect(await prisma.organization.count({ where: { name: duplicateName } })).toBe(0);
  });

  it("stores failed attempts and blocks the eleventh login even for an unknown account", async () => {
    const email = `missing-${randomUUID()}@example.test`;
    const input = { email, password: "InvalidPassword123" };
    for (let attempt = 0; attempt < 10; attempt++) await expect(login(input)).rejects.toMatchObject({ status: 401 });
    await expect(login(input)).rejects.toMatchObject({ status: 429 });
    const key = createHash("sha256").update(`login:${email}`).digest("hex");
    const row = await prisma.authRateLimit.findUniqueOrThrow({ where: { key } });
    expect(row.attempts).toBe(10);
    expect(row.blockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });
});
