import { z } from "zod";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { assert } from "@/shared/lib/errors";
import { dec, money } from "@/shared/lib/money";
export function validateAccessKey(input:string) {
 const key=input.replace(/\s/g,"");
 assert(/^\d{44}$/.test(key),"A chave fiscal deve conter 44 dígitos.");
 assert(["55","65"].includes(key.slice(20,22)),"A chave deve ser de NF-e ou NFC-e.");
 let sum=0,weight=2;for(let i=42;i>=0;i--){sum+=Number(key[i])*weight;weight=weight===9?2:weight+1;}
 const remainder=sum%11,digit=remainder<2?0:11-remainder;
 assert(Number(key[43])===digit,"O dígito verificador da chave fiscal é inválido.");
 return key;
}
const fiscalHosts=new Set(["www.nfce.fazenda.sp.gov.br","nfce.fazenda.sp.gov.br","www.fazenda.sp.gov.br","www.sefaz.rs.gov.br","www.sefaz.mt.gov.br","www.sefaz.ms.gov.br","nfce.sefaz.pe.gov.br","nfce.sefaz.ba.gov.br","nfce.sefaz.ce.gov.br","nfce.sefaz.go.gov.br","nfce.sefaz.am.gov.br","nfce.sefaz.ma.gov.br","nfce.sefaz.pb.gov.br","nfce.sefaz.pi.gov.br","nfce.sefaz.al.gov.br","nfce.sefaz.se.gov.br","nfce.sefaz.to.gov.br","nfce.sefaz.rr.gov.br","nfce.sefaz.ro.gov.br","nfce.sefaz.ac.gov.br","nfce.sefaz.ap.gov.br","nfce.fazenda.mg.gov.br","nfce.fazenda.pr.gov.br","www.nfce.fazenda.rj.gov.br","nfce.sefaz.es.gov.br","sat.sef.sc.gov.br","www.fazenda.df.gov.br","nfce.set.rn.gov.br","www.nfe.fazenda.gov.br"]);
export function parseFiscalReference(input:string){
 assert(input.length<=4096,"Referência fiscal muito longa.");
 if(/^\d[\d\s]*$/.test(input))return {accessKey:validateAccessKey(input),url:null};
 let url:URL;try{url=new URL(input);}catch{assert(false,"Informe uma chave ou URL fiscal válida.");}
 assert(url.protocol==="https:"&&!url.username&&!url.password&&!url.port,"Use uma URL fiscal HTTPS.");
 assert(fiscalHosts.has(url.hostname),"Portal fiscal não permitido. Use o XML ou informe a chave.");
 const candidates=[url.searchParams.get("p")?.split("|")[0],url.searchParams.get("chNFe"),url.searchParams.get("chave"),...url.pathname.matchAll(/\d{44}/g)].map(v=>typeof v==="string"?v:Array.isArray(v)?v[0]:null);
 const key=candidates.find(v=>v&&/^\d{44}$/.test(v));
 assert(key,"Não foi possível identificar a chave no QR Code. Informe-a manualmente.");
 return {accessKey:validateAccessKey(key),url:url.href};
}
const decimal=(maxDecimals:number)=>z.string().regex(new RegExp("^\\d{1,10}(\\.\\d{1,"+maxDecimals+"})?$")).refine(v=>dec(v).gte(0),"Valor inválido.");
const fiscalLine=z.object({code:z.string().max(120).default(""),gtin:z.string().max(32).default(""),description:z.string().trim().min(1).max(300),ncm:z.string().max(16).default(""),cfop:z.string().max(8).default(""),unit:z.string().trim().min(1).max(20),quantity:decimal(4).refine(v=>dec(v).gt(0),"Quantidade deve ser positiva."),unitPrice:decimal(10),total:decimal(2),discount:decimal(2).default("0")});
export const fiscalDraftSchema=z.object({accessKey:z.string().optional(),source:z.enum(["XML","MANUAL"]),model:z.string().max(2).optional(),number:z.string().max(20).optional(),series:z.string().max(5).optional(),issuedAt:z.string().min(10).refine(v=>Number.isFinite(new Date(v).getTime()),"Data inválida."),supplierName:z.string().trim().min(2).max(120),supplierDocument:z.string().regex(/^\d{14}$/,"Informe o CNPJ com 14 dígitos."),total:decimal(2).refine(v=>dec(v).gt(0),"Total deve ser positivo."),freight:decimal(2).default("0"),additionalCosts:decimal(2).default("0"),items:z.array(fiscalLine).min(1).max(500)}).superRefine((d,ctx)=>{
 if(d.source==="XML"&&!d.accessKey)ctx.addIssue({code:"custom",message:"O XML deve manter a chave fiscal para bloquear importações duplicadas."});
 if(d.accessKey){try{validateAccessKey(d.accessKey);if(d.accessKey.slice(6,20)!==d.supplierDocument)throw new Error("CNPJ diferente do emitente da chave.");if(d.model&&d.model!==d.accessKey.slice(20,22))throw new Error("Modelo diferente da chave.");}catch(e){ctx.addIssue({code:"custom",message:e instanceof Error?e.message:"Chave inválida."});}}
 const calculated=d.items.reduce((s,i)=>s.plus(dec(i.total).minus(i.discount)),dec(d.freight).plus(d.additionalCosts));
 if(!money(calculated).eq(d.total))ctx.addIssue({code:"custom",message:"O total deve corresponder aos itens menos descontos, mais frete. Confira outros impostos e despesas na nota."});
 for(const i of d.items){if(dec(i.discount).gt(i.total))ctx.addIssue({code:"custom",message:"Desconto maior que o valor do item."});if(money(dec(i.quantity).mul(i.unitPrice)).minus(i.total).abs().gt("0.01"))ctx.addIssue({code:"custom",message:"Quantidade e preço não correspondem ao total do item."});}
});
export type FiscalDraft=z.infer<typeof fiscalDraftSchema>;
export function fiscalMappingKey(item:{code:string;gtin:string;description:string}) {return item.code?"CODE:"+item.code:item.gtin&&item.gtin!=="SEM GTIN"?"GTIN:"+item.gtin:"DESC:"+item.description.trim().toLocaleUpperCase("pt-BR");}
export function parseFiscalXml(xml:string):FiscalDraft {
 assert(Buffer.byteLength(xml,"utf8")<=2_000_000,"XML excede o limite de 2 MB.",413);
 assert(!/<!DOCTYPE|<!ENTITY/i.test(xml),"DTD e entidades externas não são permitidos.");
 assert(XMLValidator.validate(xml)===true,"XML inválido. Envie o XML completo da NF-e ou NFC-e.");
 const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,parseAttributeValue:false,processEntities:false,isArray:name=>name==="det"});
 const parsed=parser.parse(xml);const nfe=parsed.nfeProc?.NFe??parsed.NFe;const info=nfe?.infNFe;
 assert(info?.ide&&info.emit&&info.total?.ICMSTot,"Não foi encontrada uma NF-e/NFC-e no arquivo.");
 const key=validateAccessKey(String(info["@_Id"]??"").replace(/^NFe/,""));
 assert(["55","65"].includes(String(info.ide.mod)),"Modelo de nota não suportado.");
 const det=Array.isArray(info.det)?info.det:[info.det];
 assert(det.length>0&&det.length<=500,"A nota deve conter até 500 itens.");
 // Entity expansion is disabled; decode only the five predefined XML escapes for presentation.
 const clean=(v:unknown)=>String(v??"").replace(/&(amp|lt|gt|quot|apos);/g,(_,x)=>({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[x as "amp"]));
 const total=info.total.ICMSTot;
 const goods=det.reduce((s:ReturnType<typeof dec>,d:{prod:Record<string,string>})=>s.plus(d.prod?.vProd??0).minus(d.prod?.vDesc??0),dec(0));
 const additionalCosts=money(dec(total.vNF).minus(goods).minus(total.vFrete??0));
 assert(additionalCosts.gte(0),"O total fiscal é menor que os itens líquidos. Confira os descontos e preencha a entrada manual.");
 return fiscalDraftSchema.parse({source:"XML",accessKey:key,model:String(info.ide.mod),number:String(info.ide.nNF),series:String(info.ide.serie),issuedAt:info.ide.dhEmi??info.ide.dEmi,supplierName:clean(info.emit.xNome),supplierDocument:String(info.emit.CNPJ),total:String(total.vNF),freight:String(total.vFrete??"0"),additionalCosts:additionalCosts.toString(),items:det.map((d:{prod:Record<string,string>})=>{const p=d.prod;assert(p,"Item fiscal inválido.");return {code:clean(p.cProd),gtin:clean(p.cEAN),description:clean(p.xProd),ncm:p.NCM??"",cfop:p.CFOP??"",unit:clean(p.uCom),quantity:String(p.qCom),unitPrice:String(p.vUnCom),total:String(p.vProd),discount:String(p.vDesc??"0")};})});
}
