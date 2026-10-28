'use client';
import { useCallback,useEffect,useRef,useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSurvey } from '@/app/actions/workspace';
import type { SurveyDraft } from '@/lib/validation';
export function useSurveyAutosave(restaurantId:string,draft:SurveyDraft,initial:SurveyDraft|null,blocked=false){
 const latest=useRef(draft);latest.current=draft;
 const navigationBlocked=useRef(blocked);navigationBlocked.current=blocked;
 const confirmed=useRef(initial?JSON.stringify(initial):'');
 const flight=useRef<Promise<boolean>|null>(null);
 const [status,setStatus]=useState<'idle'|'saving'|'saved'|'error'>(initial?'saved':'idle');
 const [error,setError]=useState('');
 const [,startTransition]=useTransition();
 const signature=JSON.stringify(draft),router=useRouter();
 const flush=useCallback(async():Promise<boolean>=>{
  if(flight.current){const ok=await flight.current;if(!ok)return false;}
  while(JSON.stringify(latest.current)!==confirmed.current){
   if(flight.current){const ok=await flight.current;if(!ok)return false;continue;}
   const snapshot=latest.current,key=JSON.stringify(snapshot);setStatus('saving');setError('');
   const operation=(async()=>{try{const result=await saveSurvey(restaurantId,snapshot);if(result.error)throw new Error(result.error);confirmed.current=key;setStatus(JSON.stringify(latest.current)===key?'saved':'idle');return true;}catch(err){setError(err instanceof Error?err.message:'No se pudieron guardar los cambios.');setStatus('error');return false;}})();
   flight.current=operation;
   const ok=await operation;if(flight.current===operation)flight.current=null;
   if(!ok)return false;
  }
  return true;
 },[restaurantId]);
 useEffect(()=>{if(signature===confirmed.current)return;const timer=setTimeout(()=>startTransition(async()=>{await flush();}),900);return()=>clearTimeout(timer);},[signature,flush]);
 useEffect(()=>{
  function unload(event:BeforeUnloadEvent){if(navigationBlocked.current||JSON.stringify(latest.current)!==confirmed.current){event.preventDefault();event.returnValue='';}}
  function navigate(event:MouseEvent){
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||(!navigationBlocked.current&&JSON.stringify(latest.current)===confirmed.current))return;
   const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href]');if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
   const url=new URL(anchor.href,window.location.origin);if(url.origin!==window.location.origin||url.href===window.location.href||url.hash)return;
   event.preventDefault();event.stopPropagation();if(navigationBlocked.current){setError('Espera a que termine la operación antes de salir.');return;}startTransition(async()=>{if(await flush())router.push(url.pathname+url.search);});
  }
  window.addEventListener('beforeunload',unload);document.addEventListener('click',navigate,true);
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',navigate,true);};
 },[flush,router]);
 const dirty=signature!==confirmed.current;
 return {flush,dirty,error,status:status==='saved'&&dirty?'idle':status};
}
