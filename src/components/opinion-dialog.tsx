'use client';
import { useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
export function OpinionDialog({closeHref,children,onClose,isOpen=true,onExited,labelledBy='opinion-heading'}:{closeHref:string;children:React.ReactNode;onClose?:()=>void;isOpen?:boolean;onExited?:()=>void;labelledBy?:string}){
 const dialog=useRef<HTMLDialogElement>(null),router=useRouter();
 const [manualClosing,setManualClosing]=useState(false);
 const closing=!isOpen||manualClosing;
 const navigateAfterExit=useRef(false);
 function requestClose(){if(closing)return;if(onClose){onClose();return;}navigateAfterExit.current=true;setManualClosing(true);}
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 useEffect(()=>{
  if(!closing)return;
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:220;
  const timer=window.setTimeout(()=>{dialog.current?.close();if(navigateAfterExit.current)router.push(closeHref);else onExited?.();},delay);
  return()=>window.clearTimeout(timer);
 },[closing,closeHref,onExited,router]);
 return <dialog ref={dialog} className={`opinion-dialog ${closing?'is-closing':''}`} aria-labelledby={labelledBy} onCancel={event=>{event.preventDefault();requestClose();}} onClickCapture={event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const close=(event.target as Element).closest('a[data-response-close]');
  if(close){event.preventDefault();event.stopPropagation();requestClose();}
 }} onClick={event=>{if(event.target===event.currentTarget)requestClose();}}>{children}</dialog>;
}
