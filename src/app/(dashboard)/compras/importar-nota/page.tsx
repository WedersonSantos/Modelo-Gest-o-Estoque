import { getActor } from "@/shared/lib/auth";
import { assertRole } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { FiscalImportView } from "@/modules/fiscal/components/fiscal-import-view";
export default async function Page(){const actor=await getActor();assertRole(actor,["OWNER","ADMIN","OPERATOR"]);const [products,suppliers]=await Promise.all([prisma.product.findMany({where:{organizationId:actor.organizationId,active:true},select:{id:true,name:true,unit:true},orderBy:{name:"asc"}}),prisma.supplier.findMany({where:{organizationId:actor.organizationId,active:true},select:{id:true,name:true,document:true},orderBy:{name:"asc"}})]);return <FiscalImportView products={products} suppliers={suppliers}/>;}
