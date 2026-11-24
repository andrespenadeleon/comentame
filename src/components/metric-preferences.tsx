'use client';
import { createContext,useContext,useEffect,useId,useRef,useState,useCallback } from 'react';
import { SlidersHorizontal,X } from 'lucide-react';
import { metricOptions,type MetricId } from '@/lib/metric-options';
import { OpinionDialog } from './opinion-dialog';
const Context=createContext<{hidden:string[];open:()=>void;admin:boolean}|null>(null);
export function useMetricVisible(id:MetricId){const state=useContext(Context);return !state?.hidden.includes(id);}
export function MetricSlot({id,children}:{id:MetricId;children:React.ReactNode}){return useMetricVisible(id)?children:null;}
export function MetricGroup({ids,children}:{ids:MetricId[];children:React.ReactNode}){const context=useContext(Context);return ids.every(id=>context?.hidden.includes(id))?null:children;}
export function MetricCustomize(){const state=useContext(Context);return <button type="button" className="button button-outline button-sm metric-customize" aria-haspopup="dialog" onClick={state?.open}><SlidersHorizontal size={16} aria-hidden="true"/>Personalizar</button>;}
export function MetricsEmpty(){const state=useContext(Context);if(!state||metricOptions.some(option=>(!('admin' in option)||state.admin)&&!state.hidden.includes(option.id)))return null;return <section className="card empty"><h3>Elige las métricas que quieres ver</h3><p>Tus opiniones siguen disponibles debajo.</p><button type="button" className="button button-outline" onClick={state.open}>Seleccionar métricas</button></section>;}
export function MetricPreferences({scope,admin,initial,children}:{scope:string;admin:boolean;initial:string[];children:React.ReactNode}){
 const [hidden,setHidden]=useState(initial),[open,setOpen]=useState(false),[mounted,setMounted]=useState(false),[status,setStatus]=useState(''),[retry,setRetry]=useState(0);
 const heading=useId(),revision=useRef(0),lastChange=useRef(JSON.stringify([scope,initial,0])),queue=useRef(Promise.resolve());
 const exited=useCallback(()=>setMounted(false),[]);
 const show=()=>{setMounted(true);setOpen(true);};
 useEffect(()=>{
  const signature=JSON.stringify([scope,hidden,retry]);if(signature===lastChange.current)return;lastChange.current=signature;
  const current=++revision.current;setStatus('Guardando…');
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   if(current!==revision.current)return;
   try{const response=await fetch('/api/metrics/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope,hidden})});const body=await response.json();if(!response.ok)throw new Error(body.error);if(current===revision.current)setStatus('Guardado');}
   catch(error){if(current===revision.current)setStatus(error instanceof Error?error.message:'No pudimos guardar.');}
  });
 },[hidden,scope,retry]);
 return <Context.Provider value={{hidden,open:show,admin}}>{children}{mounted&&<OpinionDialog closeHref="#" isOpen={open} onClose={()=>setOpen(false)} onExited={exited} labelledBy={heading}><section className="metric-preferences-panel"><header><div><h2 id={heading}>Personalizar métricas</h2><p className="muted">Elige qué ver en este restaurante. Los cambios se guardan automáticamente.</p></div><button type="button" className="icon-action" aria-label="Cerrar personalización" onClick={()=>setOpen(false)}><X size={22}/></button></header>{['Indicadores','Gráficas'].map(group=><fieldset key={group}><legend>{group}</legend>{metricOptions.filter(option=>option.group===group&&(!('admin' in option)||admin)).map(option=><label key={option.id}><span>{option.label}</span><input type="checkbox" role="switch" checked={!hidden.includes(option.id)} onChange={event=>setHidden(current=>event.target.checked?current.filter(id=>id!==option.id):[...current,option.id])}/></label>)}</fieldset>)}<footer><button type="button" className="text-link" onClick={()=>setHidden([])}>Mostrar todas</button><p role="status" aria-live="polite">{status}</p>{status&&!['Guardando…','Guardado'].includes(status)&&<button type="button" className="text-link" onClick={()=>setRetry(value=>value+1)}>Reintentar</button>}</footer></section></OpinionDialog>}</Context.Provider>;
}
