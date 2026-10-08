"use client";
import { useEffect,useRef,useId,type ReactNode } from "react";
import { Button } from "./ui/button";
export function ConfirmDialog({open,title,description,onCancel,onConfirm,children,busy=false}:{open:boolean;title:string;description:string;onCancel:()=>void;onConfirm:()=>void;children?:ReactNode;busy?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId(),descriptionId=useId();
 useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();if(!open&&ref.current?.open)ref.current?.close();},[open]);
 return <dialog ref={ref} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p>{children}<div className="dialog-actions"><Button variant="outline" disabled={busy} onClick={onCancel}>Voltar</Button><Button disabled={busy} onClick={onConfirm}>{busy?"Aguarde…":"Confirmar"}</Button></div></dialog>;
}
