import { Prisma } from "@prisma/client";

type DecimalInput = Prisma.Decimal | string | number;
const Decimal = Prisma.Decimal.clone({ precision: 40, rounding: Prisma.Decimal.ROUND_HALF_UP });
export const dec = (value: DecimalInput) => new Decimal(value);
export const money = (value: DecimalInput) => dec(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const quantity = (value: DecimalInput) => dec(value).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
export const formatMoney = (value: DecimalInput) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
export const formatQuantity = (value: DecimalInput) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(Number(value));
