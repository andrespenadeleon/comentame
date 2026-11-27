'use client';
import { useEffect,useId,useRef,useState } from 'react';
import { Sparkles,LoaderCircle,RefreshCw } from 'lucide-react';
import type { ReportState } from '@/lib/restaurant-report-types';
import { reportToday } from '@/lib/restaurant-report-types';
import {ReportContent} from './report-view';
import {ReportActions} from './report-actions';
import type {ParticipationVersion} from '@/lib/participation-versions';
const count=(n:number)=>n.toLocaleString('es-MX');
export function RestaurantAIReport({query,versions=[]}:{query:string;versions?:ParticipationVersion[]}){
 const params=new URLSearchParams(query),restaurant=params.get('restaurant')!,initialVersion=params.get('version')||'all',employee=params.get('employee'),rating=params.get('rating');
 const today=reportToday(),id=useId();
 const [period,setPeriod]=useState('month');
 const [version,setVersion]=useState(()=>initialVersion!=='all'?initialVersion:[...versions].sort((a,b)=>b.version-a.version)[0]?.id||'all');
 const [range,setRange]=useState(()=>({start:`${today.slice(0,7)}-01`,end:today})),[draft,setDraft]=useState(range),[state,setState]=useState<ReportState|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
 const pending=useRef(false),requestId=useRef<string|null>(null);
 const scope=new URLSearchParams({restaurant,version,start:range.start,end:range.end,...(employee?{employee}:{}),...(rating?{rating}:{})}).toString();
 useEffect(()=>{const controller=new AbortController();let canceled=false;setLoading(true);setError('');setNotice('');setState(null);requestId.current=null;fetch(`/api/admin/reports?${scope}`,{cache:'no-store',signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error);return body as ReportState;}).then(body=>{if(!canceled)setState(body);}).catch(error=>{if(!canceled)setError(error instanceof Error?error.message:'No pudimos cargar el reporte.');}).finally(()=>{if(!canceled)setLoading(false);});return()=>{canceled=true;controller.abort();};},[scope,reload]);
 useEffect(()=>{if(!state?.running||busy)return;const timer=window.setTimeout(()=>setReload(n=>n+1),5000);return()=>window.clearTimeout(timer);},[state?.running,busy,reload]);
 function preset(which:'month'|'previous'|'30'){
  setPeriod(which);
  const end=new Date(`${today}T12:00:00Z`);let start:string;
  if(which==='month')start=`${today.slice(0,7)}-01`;
  else if(which==='30'){const d=new Date(end);d.setUTCDate(d.getUTCDate()-29);start=d.toISOString().slice(0,10);}
  else{end.setUTCDate(1);end.setUTCDate(0);start=`${end.toISOString().slice(0,7)}-01`;}
  const next={start,end:end.toISOString().slice(0,10)};setDraft(next);setRange(next);
 }
 async function generate(){
  if(pending.current||!state?.admin_run||!state.matching_count||!state.configured||state.running)return;
  pending.current=true;setBusy(true);setError('');setNotice('');requestId.current??=crypto.randomUUID();const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),175000);
  try{const r=await fetch('/api/admin/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new URLSearchParams(scope)),requestId:requestId.current}),signal:controller.signal});const body=await r.json();if(!r.ok)throw new Error(`${body.error}${body.operationId?` · Intento: ${body.operationId}`:''}`);setState(body);requestId.current=null;setNotice(body.monitoringDegraded?'Reporte guardado. El registro de monitoreo presentó un problema; revisa los logs del servidor.':body.outcome==='saved'?'Reporte generado y guardado.':'El reporte guardado sigue disponible; no se consumió otra generación.');}
  catch(error){setError(error instanceof Error&&error.name!=='AbortError'?error.message:'No pudimos confirmar el resultado. Vuelve a cargar antes de generar otro reporte.');}
  finally{window.clearTimeout(timer);pending.current=false;setBusy(false);}
 }
 return <section className="ai-report" aria-busy={loading||busy}>
  <div className="report-toolbar">
   <form onSubmit={event=>{event.preventDefault();if(draft.end<draft.start){setError('La fecha final debe ser posterior a la inicial.');return;}if((new Date(draft.end).getTime()-new Date(draft.start).getTime())/86400000>365){setError('Selecciona un periodo de hasta 366 días.');return;}setRange({...draft});}}>
    <fieldset disabled={busy}><legend>Configurar reporte</legend><div className="report-toolbar-fields">
     <label htmlFor={`${id}-version`}>Encuesta<select id={`${id}-version`} className="input" value={version} onChange={e=>setVersion(e.target.value)}>{version!=='all'&&!versions.some(v=>v.id===version)&&<option value={version}>Versión seleccionada</option>}{[...versions].sort((a,b)=>b.version-a.version).map(v=><option key={v.id} value={v.id}>Versión {v.version}</option>)}<option value="all">Todas las versiones</option></select></label>
     <label htmlFor={`${id}-period`}>Periodo<select id={`${id}-period`} className="input" value={period} onChange={e=>{if(e.target.value==='custom')setPeriod('custom');else preset(e.target.value as 'month'|'previous'|'30');}}><option value="month">Este mes</option><option value="previous">Mes anterior</option><option value="30">Últimos 30 días</option><option value="custom">Personalizado</option></select></label>
     <label htmlFor={`${id}-start`}>Desde<input id={`${id}-start`} type="date" className="input" max={today} required value={draft.start} onChange={e=>{setPeriod('custom');setDraft(d=>({...d,start:e.target.value}));}}/></label>
     <label htmlFor={`${id}-end`}>Hasta<input id={`${id}-end`} type="date" className="input" min={draft.start} max={today} required value={draft.end} onChange={e=>{setPeriod('custom');setDraft(d=>({...d,end:e.target.value}));}}/></label>
     <button className="button button-outline button-sm" type="submit">Aplicar</button>
    </div></fieldset>
   </form>
   <div className="report-toolbar-actions"><div className="actions"><button type="button" className="button button-outline button-sm" disabled={busy} onClick={()=>setReload(n=>n+1)}><RefreshCw size={15} aria-hidden="true"/>Actualizar datos</button><button type="button" className="button button-sm" disabled={loading||busy||!state||state.running||!state.admin_run||!state.matching_count||!state.configured} onClick={generate}>{busy?<LoaderCircle size={15} className="ai-report-spinner" aria-hidden="true"/>:<Sparkles size={15} aria-hidden="true"/>}{busy?'Analizando…':state?.report?'Regenerar reporte':'Generar reporte'}</button></div>{state?.report&&!loading&&<ReportActions key={state.report.id} report={state.report}/>}</div>
   <p className="report-toolbar-note">Admin · No consume cuota del restaurante · Fechas de Monterrey{state?` · ${count(state.matching_count)} opiniones, ${count(state.new_count)} nuevas`:''}{employee?' · Empleado seleccionado':''}{rating?` · Solo ${rating} estrellas; muestra filtrada`:''}</p>
  </div>
  {loading&&<p className="muted" role="status">Cargando reporte guardado…</p>}
  {!loading&&state&&!state.configured&&<p className="alert">Falta configurar OPENAI_API_KEY. Los reportes guardados siguen disponibles.</p>}
  {!loading&&state&&!state.admin_run&&<p className="alert">Aplica la migración de publicación y prompts para habilitar las ejecuciones administrativas.</p>}
  {state?.running&&!busy&&<p className="muted" role="status">Hay un reporte en proceso. Consultaremos su estado automáticamente.</p>}
  {!loading&&state&&!state.matching_count&&<p className="report-sample-note">No hay opiniones enviadas en este periodo y selección.</p>}
  {busy&&<div className="ai-report-progress" role="status"><span/><p>Analizando comentarios y preparando decisiones operativas. El resultado se guardará.</p></div>}
  {!loading&&state?.report&&<ReportContent key={state.report.id} report={state.report} restaurant={restaurant} admin/>}
  {notice&&<p className="alert" role="status">{notice}</p>}{error&&<p className="alert alert-error" role="alert">{error}</p>}
 </section>;
}
