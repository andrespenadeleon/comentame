'use client';
import { useEffect,useRef } from 'react';
import { useRouter } from 'next/navigation';
export function OpinionDialog({closeHref,children}:{closeHref:string;children:React.ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),router=useRouter();
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={dialog} className="opinion-dialog" aria-labelledby="opinion-heading" onCancel={event=>{event.preventDefault();router.push(closeHref);}} onClick={event=>{if(event.target===event.currentTarget)router.push(closeHref);}}>{children}</dialog>;
}
