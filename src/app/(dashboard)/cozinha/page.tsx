import { getActor } from "@/shared/lib/auth";
import { getKitchen } from "@/modules/orders/order.service";
import { KitchenView,type KitchenOrder } from "@/modules/orders/components/kitchen-view";
export default async function Page(){const orders=await getKitchen(await getActor());return <KitchenView initial={JSON.parse(JSON.stringify(orders)) as KitchenOrder[]}/>;}
