import { getActor } from "@/shared/lib/auth";
import { assertRole } from "@/shared/lib/permissions";
import { CUSTOMER_ROLES } from "@/modules/customers/customer.service";
import { CustomerForm } from "@/modules/customers/components/customer-form";
import { PageHeader } from "@/shared/components/design-system";
import { Panel } from "@/shared/components/display";
export default async function Page() {
  assertRole(await getActor(),CUSTOMER_ROLES);
  return <><PageHeader title="Novo cliente" description="Um cadastro simples para manter o relacionamento."/><Panel title="Cadastrar cliente"><CustomerForm/></Panel></>;
}
