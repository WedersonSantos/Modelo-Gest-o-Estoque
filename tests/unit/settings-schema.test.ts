import { describe, expect, it } from "vitest";
import { registerSchema, createUserSchema } from "@/modules/settings/settings.schema";

describe("onboarding validation", () => {
  it("normalizes account email and names", () => {
    const parsed = registerSchema.parse({ organizationName: "  Casa Teste  ", name: "  Operador  ", email: "  OWNER@EXEMPLO.COM  ", password: "SenhaForte123" });
    expect(parsed.email).toBe("owner@exemplo.com");
    expect(parsed.organizationName).toBe("Casa Teste");
    expect(parsed.name).toBe("Operador");
  });
  it("rejects short passwords and roles outside the allowed enum", () => {
    expect(registerSchema.safeParse({ organizationName: "Casa", name: "Owner", email: "owner@exemplo.com", password: "curta1" }).success).toBe(false);
    expect(createUserSchema.safeParse({ name: "User", email: "user@exemplo.com", password: "SenhaForte123", role: "SUPERUSER" }).success).toBe(false);
  });
  it("rejects multi-byte passwords that bcrypt would silently truncate", () => {
    expect(registerSchema.safeParse({ organizationName: "Casa", name: "Owner", email: "owner@exemplo.com", password: "é".repeat(40) + "A1" }).success).toBe(false);
  });
});
