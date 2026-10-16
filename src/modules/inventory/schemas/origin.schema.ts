import { z } from "zod";
const optionalText=(max:number)=>z.string().trim().max(max).nullable().optional().transform(v=>v || null);
export const originTypeSchema=z.enum(["NATIONAL","IMPORTED"]);
export const originFields={
 originType:originTypeSchema.optional(),
 countryOfOrigin:optionalText(100).optional(),
 supplierCountry:optionalText(100).optional(),
 purchaseCurrency:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/,"Use o código de três letras da moeda, como BRL ou USD.").optional(),
 averageLeadTimeDays:z.preprocess(v=>v===""?null:v,z.coerce.number().int().min(0).max(3650).nullable().optional()),
 originNotes:optionalText(2000).optional()
};
export function supplierCountries(product:{supplierCountry?:string|null;suppliers?:{supplier:{country:string|null}}[]}) {
 return product.supplierCountry ? [product.supplierCountry] : [...new Set((product.suppliers??[]).map(link=>link.supplier.country).filter((country):country is string=>!!country))];
}
