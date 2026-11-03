import {describe,it,expect} from "vitest";
import {auditFiltersSchema,auditDateRange,AUDIT_PAGE_SIZE} from "@/modules/settings/audit-filters";
describe("filtros e paginação de auditoria",()=>{
 it("usa dez registros por página e aceita filtros vazios",()=>{
  expect(AUDIT_PAGE_SIZE).toBe(10);expect(auditFiltersSchema.parse({from:"",to:""})).toEqual({from:undefined,to:undefined,page:1});
 });
 it("rejeita datas inexistentes e intervalo invertido",()=>{
  for(const d of [{from:"2026-02-30"},{from:"ontem"},{from:"2026-05-11",to:"2026-05-10"}])expect(auditFiltersSchema.safeParse(d).success).toBe(false);
 });
 it("valida páginas e permite intervalos abertos",()=>{
  for(const page of [0,-1,1.1,"x",1000001])expect(auditFiltersSchema.safeParse({page}).success).toBe(false);
  expect(auditFiltersSchema.parse({page:"2",from:"2026-05-10"}).page).toBe(2);
  expect(auditFiltersSchema.safeParse({to:"2026-05-10"}).success).toBe(true);
 });
 it("inclui o dia final completo no horário de São Paulo",()=>{
  const range=auditDateRange("2026-05-10","2026-05-10");
  expect(range.gte?.toISOString()).toBe("2026-05-10T03:00:00.000Z");expect(range.lt?.toISOString()).toBe("2026-05-11T03:00:00.000Z");
 });
});
