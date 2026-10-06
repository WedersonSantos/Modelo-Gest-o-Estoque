/** Business day bounds in São Paulo (UTC-03), independent of the deployment host timezone. */
export function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00-03:00`);
  if (Number.isNaN(start.getTime())) throw new Error("Data inválida.");
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export const formatDate = (date: Date | string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(date));
export const businessDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
