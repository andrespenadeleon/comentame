'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OpinionDialog } from './opinion-dialog';
type Entry={id:string;content:React.ReactNode};
export function ResponseDetails({entries,closeHref,children}:{entries:Entry[];closeHref:string;children:React.ReactNode}){
 const params=useSearchParams();
 const selected=params.get('detail');
 const opener=useRef<HTMLElement|null>(null);
 const content=entries.find(entry=>entry.id===selected);
 const [displayed,setDisplayed]=useState(content);
 const rendered=content||displayed;
 useEffect(()=>{if(content)setDisplayed(content);},[content]);
 const exited=useCallback(()=>{setDisplayed(undefined);opener.current?.focus({preventScroll:true});},[]);
 function preserveVersion(href:string){const next=new URL(href,window.location.origin),current=new URLSearchParams(window.location.search);const version=current.get('questionVersion');if(next.searchParams.get('section')==='opiniones'&&version)next.searchParams.set('questionVersion',version);return next.pathname+next.search+next.hash;}
 function close(){window.history.pushState(null,'',preserveVersion(closeHref));}
 return <div className="response-details-controller" onClickCapture={event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const anchor=(event.target as Element).closest<HTMLAnchorElement>('a');
  if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
  const id=anchor.dataset.responseDetail;
  if(!id||!entries.some(entry=>entry.id===id))return;
  event.preventDefault();event.stopPropagation();opener.current=anchor;
  window.history.pushState(null,'',preserveVersion(anchor.href));
 }}>{children}{rendered&&<OpinionDialog key={rendered.id} closeHref={closeHref} onClose={close} isOpen={!!content} onExited={exited}>{rendered.content}</OpinionDialog>}</div>;
}
