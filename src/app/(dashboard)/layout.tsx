import { redirect } from "next/navigation";
import { getActor } from "@/shared/lib/auth";
import { DomainError } from "@/shared/lib/errors";
import { getAccount } from "@/modules/settings";
import { AppShell } from "@/shared/components/app-shell";
export const dynamic="force-dynamic";
export default async function DashboardLayout({children}:{children:React.ReactNode}) {
 const actor=await getActor().catch(e=>{if(e instanceof DomainError&&e.status===401)redirect("/login");throw e;});
 const account=await getAccount(actor);
 return <AppShell organization={account.organization.name} user={account.name} role={account.role}>{children}</AppShell>;
}
