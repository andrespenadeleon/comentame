'use client';
import { useCallback,useEffect,useRef } from 'react';
import type { SurveyTracking } from '@/lib/survey-tracking';
type Context={restaurant_id:string;employee_id:string;survey_version_id:string};
export function useSurveyTracking(context:Context|undefined,preview:boolean){
 const session=useRef({id:'',active:0,anchor:null as number|null,sequence:0,touched:new Set<string>(),answered:new Set<string>(),finished:false});
 const enabled=!!context&&!preview;
 const snapshot=useCallback(():SurveyTracking|null=>{
  if(!enabled)return null;
  const state=session.current;state.id||=crypto.randomUUID();
  const now=performance.now();
  if(state.anchor!==null){state.active=Math.min(86400000,state.active+Math.min(Math.max(0,now-state.anchor),30000));state.anchor=now;}
  return {visit_id:state.id,active_ms:Math.floor(state.active),sequence:++state.sequence,touched:[...state.touched],answered:[...state.answered]};
 },[enabled]);
 const flush=useCallback((beacon=false)=>{
  if(!context||!enabled||session.current.finished)return;
  const tracking=snapshot();if(!tracking)return;
  const body=JSON.stringify({...tracking,restaurant_id:context.restaurant_id,employee_id:context.employee_id,survey_version_id:context.survey_version_id});
  if(beacon&&navigator.sendBeacon?.('/api/encuesta/visita',new Blob([body],{type:'application/json'})))return;
  void fetch('/api/encuesta/visita',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
 },[context?.restaurant_id,context?.employee_id,context?.survey_version_id,enabled,snapshot]);
 const deferred=useRef<ReturnType<typeof setTimeout>|null>(null);
 const touch=useCallback((id:string,answered:boolean)=>{
  if(!enabled||session.current.finished)return;
  const first=session.current.touched.size===0;
  session.current.touched.add(id);
  if(answered)session.current.answered.add(id);else session.current.answered.delete(id);
  if(first)flush();
  if(deferred.current)clearTimeout(deferred.current);
  deferred.current=setTimeout(()=>flush(),1000);
 },[enabled,flush]);
 useEffect(()=>{
  if(!enabled)return;
  session.current.anchor=document.visibilityState==='visible'?performance.now():null;
  flush();
  function visibility(){
   if(document.visibilityState==='hidden'){flush(true);session.current.anchor=null;}
   else if(!session.current.finished){session.current.anchor=performance.now();flush();}
  }
  function hide(){flush(true);session.current.anchor=null;}
  function show(){if(!session.current.finished&&document.visibilityState==='visible')session.current.anchor=performance.now();}
  const interval=setInterval(()=>{if(document.visibilityState==='visible')flush();},15000);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
  return()=>{flush(true);session.current.anchor=null;clearInterval(interval);if(deferred.current)clearTimeout(deferred.current);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);};
 },[enabled,flush]);
 const googleClick=useCallback(()=>{
  if(!enabled||!context||!session.current.finished||!session.current.id)return;
  const body=JSON.stringify({click_id:crypto.randomUUID(),visit_id:session.current.id});
  if(navigator.sendBeacon?.('/api/encuesta/google',new Blob([body],{type:'application/json'})))return;
  void fetch('/api/encuesta/google',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
 },[enabled,context?.restaurant_id,context?.employee_id,context?.survey_version_id]);
 return {touch,snapshot,googleClick,finish:()=>{session.current.finished=true;session.current.anchor=null;if(deferred.current)clearTimeout(deferred.current);}};
}
