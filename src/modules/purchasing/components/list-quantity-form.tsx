"use client";
import type { WorkspaceData } from "@/modules/dashboard";
import { CommandForm } from "@/shared/components/command-form";
import { label } from "@/shared/components/display";
export function ListQuantityForm({request}:{request:WorkspaceData["requests"][number]}) {
 return <CommandForm command="updatePurchaseRequest" fields={[]} transform={v=>({id:request.id,items:request.items.filter(i=>v[`include_${i.productId}`]==="on").map(i=>({productId:i.productId,requestedQuantity:v[`requested_${i.productId}`]}))})} submit="Salvar itens e quantidades"><div className="wide-field"><p className="list-help">Mantenha os itens que serão comprados juntos. Depois de cotar esta lista, gere outra para os ingredientes restantes.</p><div className="form-grid">{request.items.map(i=><div className="field" key={i.id}><label className="checkbox-label"><input name={`include_${i.productId}`} type="checkbox" defaultChecked/>Incluir {i.product.name}</label><label>Quantidade ({label(i.product.unit)})<input name={`requested_${i.productId}`} type="number" min="0.0001" step="0.0001" defaultValue={i.requestedQuantity} required/></label></div>)}</div></div></CommandForm>;
}
