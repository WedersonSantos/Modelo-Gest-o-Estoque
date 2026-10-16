import { getActor } from "@/shared/lib/auth";
import { employeeOptions } from "@/modules/employees/employee.service";
import { EmployeeForm } from "@/modules/employees/components/employee-form";
import { PageHeader } from "@/shared/components/design-system";
import { Panel } from "@/shared/components/display";
export default async function Page(){
 const options=await employeeOptions(await getActor());
 return <><PageHeader title="Novo funcionário" description="Cadastre a pessoa e suas responsabilidades; o acesso ao sistema é opcional."/><Panel title="Cadastrar funcionário"><EmployeeForm options={options}/></Panel></>;
}
