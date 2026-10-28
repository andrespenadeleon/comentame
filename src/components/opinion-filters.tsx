'use client';
import { useEffect,useId,useRef,useState } from 'react';
import { SlidersHorizontal,X } from 'lucide-react';
export function OpinionFilters({children}:{children:React.ReactNode}){
 const [open,setOpen]=useState(false),id=useId();
 const container=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;function outside(event:PointerEvent){if(!container.current?.contains(event.target as Node))setOpen(false);}function keyboard(event:KeyboardEvent){if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}}document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keyboard);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);};},[open]);
 return <div className="opinion-filters-toolbar"><div className="opinion-filters-disclosure" ref={container}><button ref={trigger} type="button" className={`opinion-filter-trigger icon-action ${open?'is-open':''}`} aria-label={open?'Cerrar filtros':'Abrir filtros'} title="Filtros" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}><SlidersHorizontal size={19} aria-hidden="true"/></button><section hidden={!open} id={id} className="opinion-filters-dropdown" aria-label="Filtros de opiniones" onSubmitCapture={()=>setOpen(false)}><header><h2>Filtros</h2><button className="icon-action" type="button" aria-label="Cerrar filtros" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={17}/></button></header>{children}</section></div></div>;
}
