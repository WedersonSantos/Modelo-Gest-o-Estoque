/** Each screen requests only the datasets it renders; omitted routes preserve legacy callers. */
export function workspaceResources(parts?: readonly string[]) {
 const section=parts?.[0],tab=parts?.[1];
 if(!section)return null;
 const common=['organization','user'];
 const totals=['periodTotals','pendingTotals','purchaseTotals'];
 const resources:Record<string,string[]>={
  dashboard:['products','movements','counts','quotes','orders','paidTotals',...totals,'consumption','pendingOrderCount','financialSeries','previousTotals','overdueCount'],
  estoque:['products','categories',...(tab==='movimentacoes'?['movements']:[]),...(tab==='inventarios'?['counts']:[])],
  compras:[...(!tab||tab==='necessidades'?['products']:[]),...(tab==='cotacoes'||tab==='listas'?['requests','quotes','suppliers']:[]),...(tab==='pedidos'?['orders']:[])],
  fornecedores:['products','suppliers'],
  financeiro:['financialCategories','periodTotals','pendingTotals',...(tab==='categorias'?[]:['entries']),...(!tab||tab==='lancamentos'?['financialSeries']:[])],
  relatorios:['products','consumption',...totals],
  configuracoes:['categories','users'],
 };
 return new Set([...common,...(resources[section]??[])]);
}

