import { z } from "zod";
import { Prisma } from "@prisma/client";
// Future receiving adapters can compose costs explicitly. Existing stock/receipt logic does not call this function.
// All amounts here must use the SAME currency; conversions need an explicit rate before calling.
const cost=z.string().regex(/^\d{1,10}(\.\d{1,4})?$/);
const schema=z.object({currency:z.string().regex(/^[A-Z]{3}$/),merchandise:cost,freight:cost.default("0"),additionalFees:cost.default("0"),importCosts:cost.default("0")});
export function acquisitionCostBreakdown(input:unknown){
 const d=schema.parse(input);
 const total=new Prisma.Decimal(d.merchandise).plus(d.freight).plus(d.additionalFees).plus(d.importCosts);
 return {...d,total:total.toFixed(2)};
}
