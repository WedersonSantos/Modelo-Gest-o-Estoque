import { describe, expect, it } from "vitest";
import { assertRole, ADMIN_ROLES, BUYING_ROLES, STOCK_ROLES } from "@/shared/lib/permissions";
import { DomainError } from "@/shared/lib/errors";
import type { Actor } from "@/shared/types/actor";

const actor = (role: Actor["role"]): Actor => ({ userId: "test-user", organizationId: "test-org", role });

describe("authorization matrix", () => {
  it("lets owners and administrators manage settings", () => {
    expect(() => assertRole(actor("OWNER"), ADMIN_ROLES)).not.toThrow();
    expect(() => assertRole(actor("ADMIN"), ADMIN_ROLES)).not.toThrow();
    for (const role of ["BUYER", "OPERATOR", "VIEWER"] as const) expect(() => assertRole(actor(role), ADMIN_ROLES)).toThrow(DomainError);
  });
  it("separates purchasing from stock operations", () => {
    expect(() => assertRole(actor("BUYER"), BUYING_ROLES)).not.toThrow();
    expect(() => assertRole(actor("BUYER"), STOCK_ROLES)).toThrow(DomainError);
    expect(() => assertRole(actor("OPERATOR"), STOCK_ROLES)).not.toThrow();
    expect(() => assertRole(actor("OPERATOR"), BUYING_ROLES)).toThrow(DomainError);
  });
  it("keeps viewers read-only", () => {
    for (const roles of [ADMIN_ROLES, BUYING_ROLES, STOCK_ROLES]) expect(() => assertRole(actor("VIEWER"), roles)).toThrow(DomainError);
  });
});
