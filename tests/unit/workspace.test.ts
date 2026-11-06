import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceQuery } from "@/modules/dashboard/queries/workspace.repository";
import { getWorkspaceData } from "@/modules/dashboard/services/workspace.service";
import type { Actor } from "@/shared/types/actor";

const database = vi.hoisted(() => ({
  organization: { findUniqueOrThrow: vi.fn() },
  user: { findFirstOrThrow: vi.fn(), findMany: vi.fn() },
  product: { findMany: vi.fn() },
  productCategory: { findMany: vi.fn() },
  stockMovement: { findMany: vi.fn(), groupBy: vi.fn() },
  inventoryCount: { findMany: vi.fn() },
  supplier: { findMany: vi.fn() },
  purchaseRequest: { findMany: vi.fn() },
  supplierQuote: { findMany: vi.fn() },
  purchaseOrder: { findMany: vi.fn(), count: vi.fn() },
  financialCategory: { findMany: vi.fn() },
  financialEntry: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  goodsReceipt: { aggregate: vi.fn() },
  auditLog: { findMany: vi.fn() },
}));

vi.mock("@/shared/lib/prisma", () => ({ prisma: database }));
const owner: Actor = { userId: "user-a", organizationId: "org-a", role: "OWNER" };
const from = new Date("2026-10-01T03:00:00Z");
const to = new Date("2026-11-01T03:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  for (const model of Object.values(database)) {
    if ("findMany" in model) model.findMany.mockResolvedValue([]);
  }
  database.organization.findUniqueOrThrow.mockResolvedValue({ id: owner.organizationId, name: "Restaurante" });
  database.user.findFirstOrThrow.mockResolvedValue({ id: owner.userId, name: "Usuário", role: owner.role });
  database.stockMovement.groupBy.mockResolvedValue([]);
  database.financialEntry.groupBy.mockResolvedValue([]);
  database.financialEntry.count.mockResolvedValue(0);
  database.goodsReceipt.aggregate.mockResolvedValue({ _sum: { total: null } });
  database.purchaseOrder.count.mockResolvedValue(8);
});

describe("queries do dashboard", () => {
  it("busca inventário antigo diretamente pelo ID com escopo da organização", async () => {
    await getWorkspaceData(owner, { from: "2026-10-01", to: "2026-10-31" }, false, { kind: "count", id: "count-antigo" });
    expect(database.inventoryCount.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", id: "count-antigo" }, take: undefined,
    }));
  });

  it("inclui todas as cotações da lista focada e valida o ID antes de consultar", async () => {
    await getWorkspaceData(owner, {}, false, { kind: "request", id: "request-antigo" });
    expect(database.purchaseRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", id: "request-antigo" }, take: undefined,
    }));
    expect(database.supplierQuote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", purchaseRequestId: "request-antigo" }, take: undefined,
    }));
    database.organization.findUniqueOrThrow.mockClear();
    await expect(getWorkspaceData(owner, {}, false, { kind: "order", id: " " })).rejects.toThrow();
    await expect(getWorkspaceData(owner, {}, false, { kind: "order", id: "x".repeat(101) })).rejects.toThrow();
    expect(database.organization.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("mostra todas as contas pendentes, inclusive vencidas fora do mês e além de 200 itens", async () => {
    await workspaceQuery(owner, from, to, undefined, true);
    expect(database.financialEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", type: "EXPENSE", status: "PENDING" },
      orderBy: { dueDate: "asc" }, take: undefined,
    }));
  });

  it("mantém filtro do período na lista de lançamentos, separado de contas a pagar", async () => {
    await workspaceQuery(owner, from, to);
    expect(database.financialEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", OR: [
        { paidAt: { gte: from, lt: to } },
        { status: "PENDING", dueDate: { gte: from, lt: to } },
        { status: "CANCELED", createdAt: { gte: from, lt: to } },
      ] },
    }));
  });

  it("conta todos os pedidos pendentes mesmo quando a lista recente não contém nenhum", async () => {
    const data = await getWorkspaceData(owner, { from: "2026-10-01", to: "2026-10-31" });
    expect(data.orders).toHaveLength(0);
    expect(data.summary.pendingOrders).toBe(8);
    expect(database.purchaseOrder.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", status: { notIn: ["RECEIVED", "CANCELED"] } },
    });
  });

  it("não consulta dados financeiros nem administrativos para comprador ou operador", async () => {
    for (const role of ["BUYER", "OPERATOR"] as const) {
      const data = await workspaceQuery({ ...owner, role }, from, to, undefined, true);
      expect(data.financeVisible).toBe(false);
      expect(data.entries).toEqual([]);
      expect(data.users).toEqual([]);
      expect(data.audits).toEqual([]);
    }
    expect(database.financialEntry.findMany).not.toHaveBeenCalled();
    expect(database.financialEntry.groupBy).not.toHaveBeenCalled();
    expect(database.financialCategory.findMany).not.toHaveBeenCalled();
    expect(database.auditLog.findMany).not.toHaveBeenCalled();
    expect(database.user.findMany).not.toHaveBeenCalled();
  });

  it("interpreta o dia completo em São Paulo e recusa datas de calendário inválidas", async () => {
    await getWorkspaceData(owner, { from: "2026-02-28", to: "2026-02-28", context: "EVENT" });
    expect(database.stockMovement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-a", createdAt: {
        gte: new Date("2026-02-28T03:00:00Z"), lt: new Date("2026-03-01T03:00:00Z"),
      }, usageContext: "EVENT" },
    }));
    database.organization.findUniqueOrThrow.mockClear();
    await expect(getWorkspaceData(owner, { from: "2026-02-31", to: "2026-03-03" })).rejects.toThrow();
    expect(database.organization.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("carregamento por página", () => {
 const countCalls=()=>Object.values(database).flatMap(model=>Object.values(model)).reduce((sum,method)=>sum+method.mock.calls.length,0);
 it("reduz de 22 consultas Prisma para 4 no estoque sem carregar finanças, compras ou equipe", async () => {
  await workspaceQuery(owner,from,to);
  expect(countCalls()).toBe(22);
  vi.clearAllMocks();
  const data=await getWorkspaceData(owner,{},false,undefined,['estoque']);
  expect(countCalls()).toBe(4);
  expect(database.product.findMany).toHaveBeenCalled();
  expect(database.productCategory.findMany).toHaveBeenCalled();
  expect(database.supplier.findMany).not.toHaveBeenCalled();
  expect(database.financialEntry.groupBy).not.toHaveBeenCalled();
  expect(data.orders).toEqual([]);
 });
 it.each([
  [['estoque','movimentacoes'],5],
  [['estoque','inventarios'],5],
  [['compras','necessidades'],3],
  [['compras','listas'],5],
  [['compras','cotacoes'],5],
  [['compras','pedidos'],3],
  [['financeiro'],7],
  [['financeiro','contas-pagar'],6],
  [['financeiro','categorias'],5],
  [['relatorios'],7],
  [['configuracoes'],4],
 ] as const)("consulta apenas os conjuntos usados em %j", async (parts,expected) => {
  await getWorkspaceData(owner,{},parts[1]==='contas-pagar',undefined,parts);
  expect(countCalls()).toBe(expected);
  expect(database.organization.findUniqueOrThrow).toHaveBeenCalledWith({where:{id:owner.organizationId},select:{id:true,name:true}});
  if(parts[0]==='configuracoes') {
   expect(database.user.findMany).toHaveBeenCalled();
   expect(database.product.findMany).not.toHaveBeenCalled();
   expect(database.financialEntry.findMany).not.toHaveBeenCalled();
  }
 });
 it("mantém a busca direta de pedido antigo quando a página é limitada ao módulo de compras",async()=>{
  await getWorkspaceData(owner,{},false,{kind:'order',id:'pedido-antigo'},['compras','pedidos','pedido-antigo']);
  expect(database.purchaseOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:owner.organizationId,id:'pedido-antigo'},take:undefined}));
  expect(countCalls()).toBe(3);
 });
 it("a otimização não libera dados financeiros para o comprador",async()=>{
  const data=await getWorkspaceData({...owner,role:'BUYER'},{},false,undefined,['relatorios']);
  expect(data.financeVisible).toBe(false);
  expect(database.financialEntry.groupBy).not.toHaveBeenCalled();
  expect(database.goodsReceipt.aggregate).not.toHaveBeenCalled();
  expect(database.stockMovement.groupBy).toHaveBeenCalled();
 });
});
