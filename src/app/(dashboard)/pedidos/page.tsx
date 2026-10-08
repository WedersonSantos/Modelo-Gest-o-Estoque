import { getActor } from "@/shared/lib/auth";
import { getOrders } from "@/modules/orders/order.service";
import { OrdersView } from "@/modules/orders/components/orders-view";
export default async function Page(){return <OrdersView data={await getOrders(await getActor())}/>;}
