'use client';
import { useEffect,useRef,useState } from 'react';
import { Check,Copy,ExternalLink } from 'lucide-react';
import { initials } from '@/lib/validation';
import type { PortalEmployee } from '@/lib/portal-admin';
import { Button } from './ui/button';
import { Input } from './ui/input';
export function PortalEmployeeRow({employee,surveyUrl}:{employee:PortalEmployee;surveyUrl:string|null}){
 const [status,setStatus]=useState<'idle'|'copying'|'copied'|'fallback'>('idle');
 const input=useRef<HTMLInputElement>(null),copying=useRef(false);
 const name=`${employee.first_name} ${employee.last_name}`;
 useEffect(()=>{if(status==='fallback')input.current?.select();if(status!=='copied')return;const timer=setTimeout(()=>setStatus('idle'),3000);return()=>clearTimeout(timer);},[status]);
 async function copy(){if(!surveyUrl||copying.current)return;copying.current=true;setStatus('copying');try{await navigator.clipboard.writeText(surveyUrl);setStatus('copied');}catch{setStatus('fallback');}finally{copying.current=false;}}
 return <article className={`portal-employee-row ${employee.deleted_at?'is-archived':''}`} aria-label={name}>
  <span className="avatar" aria-hidden="true">{initials(employee.first_name,employee.last_name)}</span>
  <div className="portal-employee-person"><h3>{name}</h3><p>{employee.role}</p><span className="portal-employee-restaurant">{employee.restaurant_name}</span></div>
  <span className={`portal-survey-status ${employee.deleted_at?'archived':employee.survey_published?'published':'unpublished'}`}>{employee.deleted_at?'Archivado':employee.survey_published?'Encuesta activa':'Encuesta sin publicar'}</span>
  <div className="portal-employee-actions">{surveyUrl?<><Button type="button" size="sm" variant={status==='copied'?'outline':'default'} disabled={status==='copying'} onClick={copy} aria-label={`Copiar enlace de ${name}`}>{status==='copied'?<Check size={15} aria-hidden="true"/>:<Copy size={15} aria-hidden="true"/>}{status==='copied'?'Copiado':status==='copying'?'Copiando…':'Copiar enlace'}</Button>{employee.survey_published&&<a className="icon-action" href={surveyUrl} target="_blank" rel="noopener noreferrer" title="Abrir encuesta" aria-label={`Abrir encuesta de ${name}`}><ExternalLink size={16} aria-hidden="true"/></a>}</>:<span className="portal-disabled-link">Enlace desactivado</span>}</div>
  <span className="sr-only" role="status">{status==='copied'?`Enlace de ${name} copiado.`:''}</span>
  {status==='fallback'&&surveyUrl&&<div className="portal-copy-fallback"><label className="field">Enlace de la encuesta<Input ref={input} readOnly value={surveyUrl} onFocus={event=>event.currentTarget.select()} aria-label={`Enlace de encuesta de ${name}`}/></label><p role="status">No pudimos copiarlo automáticamente. Selecciona y copia este enlace.</p></div>}
 </article>;
}
