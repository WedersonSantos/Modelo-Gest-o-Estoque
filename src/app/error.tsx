"use client";
import { Button } from "@/shared/components/ui/button";
export default function ErrorPage({reset}:{error:Error;reset:()=>void}) { return <div className="error-page"><h1>Não foi possível carregar os dados.</h1><p>Verifique a conexão e tente novamente. Se estiver executando localmente, confirme que o banco está ligado.</p><Button onClick={reset}>Tentar novamente</Button></div>; }
