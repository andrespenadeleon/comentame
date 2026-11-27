'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,LoaderCircle,Sparkles,X} from 'lucide-react';
import Link from 'next/link';
import s from './playground.module.css';
const tasks=[{active:'Recopilando opiniones',done:'Opiniones recopiladas'},{active:'Analizando comentarios',done:'Comentarios analizados'},{active:'Identificando patrones',done:'Patrones identificados'},{active:'Preparando recomendaciones',done:'Recomendaciones preparadas'}];
export function LoadingPlayground(){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[step,setStep]=useState(0);
 const complete=step===tasks.length;
 useEffect(()=>{if(!open)return;const node=dialog.current;if(!node)return;node.showModal();return()=>node.close();},[open]);
 useEffect(()=>{if(!open||complete)return;const timer=window.setTimeout(()=>setStep(current=>Math.min(current+1,tasks.length)),2600);return()=>window.clearTimeout(timer);},[open,step,complete]);
 function close(){setOpen(false);trigger.current?.focus();}
 return <main id="main" className={s.page}>
  <header className={s.nav}><Link href="/" className={s.wordmark}>comenta<span>.</span>me</Link><span className={s.devBadge}><i/>andres_dev</span></header>
  <section className={s.intro}><span className={s.eyebrow}>THE PLAYGROUND / 001</span><h1>Un espacio para<br/>probar lo que sigue<span>.</span></h1><p>Pequeños experimentos. Nuevas interacciones.<br/>El siguiente detalle empieza aquí.</p></section>
  <section className={s.experiment} aria-labelledby="experiment-title"><div className={s.experimentHeading}><span className={s.number}>01</span><span className={s.tag}>INTERACCIÓN</span></div><div className={s.experimentBody}><div className={s.icon}><Sparkles size={23} aria-hidden="true"/></div><h2 id="experiment-title">Un momento de claridad.</h2><p>Una nueva forma de esperar mientras las opiniones se convierten en ideas.</p><button ref={trigger} className={s.trigger} type="button" onClick={()=>{setStep(0);setOpen(true);}} aria-haspopup="dialog"><Sparkles size={17} aria-hidden="true"/>Análisis con IA<ArrowUpRight size={15} aria-hidden="true"/></button><small>Solo una demo visual. No genera reportes ni consume créditos.</small></div><footer className={s.experimentFooter}><span>AI LOADING EXPERIENCE</span><span>v.01</span></footer></section>
  <footer className={s.footer}>comenta.me <span>Ideas en movimiento.</span></footer>
  <dialog ref={dialog} className={s.dialog} aria-labelledby="loading-title" aria-describedby="loading-description" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
   <section className={s.loadingCard}><button type="button" className={s.close} onClick={close} aria-label="Cerrar demo"><X size={19}/></button>
    <div className={`${s.universe} ${complete?s.finished:''}`} aria-hidden="true"><div className={s.halo}/><div className={s.orbitOuter}/><div className={s.orbitMiddle}/><div className={s.orbitInner}/><div className={s.satelliteOne}><i/></div><div className={s.satelliteTwo}><i/></div><div className={s.core}><Sparkles size={32} strokeWidth={1.4}/></div><div className={s.ripple}/></div>
    <div className={s.copy}><h2 id="loading-title">{complete?'Demo completada':'Preparando tu análisis'}</h2><p id="loading-description">{complete?'Todo listo.':'No cierres esta pestaña.'}</p></div>
    <ol className={s.tasks} aria-label="Tareas del análisis">{tasks.map((task,index)=>{const done=index<step,active=index===step;return <li key={task.active} className={done?s.taskDone:active?s.taskActive:s.taskPending} aria-current={active?'step':undefined}><span className={s.taskIcon} aria-hidden="true">{done?<Check size={14}/>:active?<LoaderCircle size={15}/>:<span/>}</span><span>{done?task.done:task.active}</span><span className="sr-only">{done?'Completada':active?'En proceso':'Pendiente'}</span></li>;})}</ol>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{complete?'Simulación completada':tasks[step]?.active}</p>
    {complete?<button type="button" className={s.replay} onClick={()=>setStep(0)}>Volver a probar</button>:<p className={s.simulation}>Simulación de progreso</p>}
   </section>
  </dialog>
 </main>;
}
