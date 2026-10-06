import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:{default:"Mesa · Gestão do restaurante",template:"%s · Mesa"},description:"Estoque, compras, fornecedores e finanças do seu restaurante."};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR"><body><a className="skip-link" href="#main-content">Pular para o conteúdo</a>{children}</body></html>; }
