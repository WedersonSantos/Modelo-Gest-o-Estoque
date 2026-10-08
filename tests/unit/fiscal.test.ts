import { describe,it,expect } from "vitest";
import { parseFiscalXml,parseFiscalReference,validateAccessKey,fiscalMappingKey,fiscalDraftSchema } from "@/modules/fiscal/fiscal.rules";
import { accessKey,invoiceXml } from "../fixtures/fiscal";
describe("leitura fiscal segura",()=>{
 it("valida os 44 dígitos e o módulo 11",()=>{expect(validateAccessKey(accessKey())).toBe(accessKey());expect(()=>validateAccessKey(accessKey().slice(0,-1)+(accessKey().endsWith("0")?"1":"0"))).toThrow();expect(()=>validateAccessKey("123")).toThrow();});
 it("identifica chave no QR oficial sem requisições externas",()=>{const url="https://www.nfce.fazenda.sp.gov.br/qrcode?p="+accessKey()+"|2|1|HASH";expect(parseFiscalReference(url).accessKey).toBe(accessKey());expect(parseFiscalReference(accessKey()).url).toBeNull();});
 it("rejeita HTTP, credenciais, domínio falso e endereços locais",()=>{for(const url of ["http://www.nfce.fazenda.sp.gov.br/?chNFe="+accessKey(),"https://localhost/?chNFe="+accessKey(),"https://www.nfce.fazenda.sp.gov.br.evil.test/?chNFe="+accessKey(),"https://user:pass@www.nfce.fazenda.sp.gov.br/?chNFe="+accessKey()])expect(()=>parseFiscalReference(url)).toThrow();});
 it("extrai documento e todos os campos dos itens",()=>{const draft=parseFiscalXml(invoiceXml());expect(draft.accessKey).toBe(accessKey());expect(draft.total).toBe("320.00");expect(draft.items[0]).toMatchObject({code:"CARNE-01",gtin:"SEM GTIN",ncm:"02013000",cfop:"5102",quantity:"10.0000",discount:"9.00"});});
 it("rejeita XML inválido, DTD e entidades",()=>{for(const xml of ["<NFe>","<other/>",'<!DOCTYPE x [<!ENTITY ext SYSTEM "file:///secret">]>'+invoiceXml()])expect(()=>parseFiscalXml(xml)).toThrow();});
 it("limita tamanho antes do parser",()=>expect(()=>parseFiscalXml(" ".repeat(2_000_001))).toThrow());
 it("valida total e CNPJ antes de confirmar",()=>{const d=parseFiscalXml(invoiceXml());expect(()=>fiscalDraftSchema.parse({...d,total:"100"})).toThrow();expect(()=>fiscalDraftSchema.parse({...d,supplierDocument:"99999999999999"})).toThrow();});
 it("exige a chave original nas importações XML",()=>{const d=parseFiscalXml(invoiceXml());expect(()=>fiscalDraftSchema.parse({...d,accessKey:undefined})).toThrow();expect(fiscalDraftSchema.parse({...d,source:"MANUAL",accessKey:undefined}).source).toBe("MANUAL");});
 it("mantém a identidade do fornecedor por código, GTIN ou descrição",()=>{expect(fiscalMappingKey({code:"01",gtin:"123",description:"Carne"})).toBe("CODE:01");expect(fiscalMappingKey({code:"",gtin:"123",description:"Carne"})).toBe("GTIN:123");expect(fiscalMappingKey({code:"",gtin:"SEM GTIN",description:"  Carne "})).toBe("DESC:CARNE");});
});
