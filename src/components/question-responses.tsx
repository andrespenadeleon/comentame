'use client';
import { useCallback,useEffect,useId,useRef,useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import type { OpinionParams } from '@/lib/opinions';
import type { QuestionResponsePage } from '@/lib/question-responses-types';
import { OpinionDialog } from './opinion-dialog';
import { QuestionAnswerCards } from './question-answer-cards';
import type { QuestionGroup } from '@/lib/question-analytics-types';
type Field=QuestionGroup;
const date=(value:string)=>new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Monterrey'}).format(new Date(value));
const answerText=(answer:QuestionResponsePage['rows'][number]['answer'])=>Array.isArray(answer)?answer.join(' · '):String(answer);
function QuestionAnswerSummary({data}:{data:QuestionResponsePage}){
 const values=data.distribution;
 if(!values?.length)return null;
 const max=Math.max(1,...values.map(item=>item.total));
 const scoring=data.question?.presentation==='scale'||data.question?.type==='rating';
 return <figure className="question-answer-summary"><figcaption>{scoring?'Distribución de calificaciones':'Selecciones por opción'}</figcaption><ul aria-label="Totales de todas las respuestas que coinciden con los filtros">{values.map(item=><li key={item.label}><span>{item.label}{scoring&&<span aria-hidden="true"> ★</span>}</span><span className="question-summary-track" aria-hidden="true"><span style={{width:`${item.total/max*100}%`}}/></span><strong>{item.total.toLocaleString('es-MX')}</strong></li>)}</ul><p>Totales de las {data.total.toLocaleString('es-MX')} respuestas enviadas para estos filtros.</p></figure>;
}
function ScoreAnswer({answer,main=false}:{answer:QuestionResponsePage['rows'][number]['answer'];main?:boolean}){
 const score=Number(answer);
 if(!Number.isInteger(score)||score<1||score>5)return <p className="question-response-answer">{answerText(answer)}</p>;
 return <div className="question-response-score" aria-label={`${score} de 5 estrellas`}><strong aria-hidden="true">{score}{!main&&<small> / 5</small>}</strong><span aria-hidden="true">{'★'.repeat(score)}<span className="is-unfilled">{'☆'.repeat(5-score)}</span></span></div>;
}
export function QuestionResponses({fields,params,compact=false}:{fields:Field[];params:OpinionParams;compact?:boolean}){
 const query=useSearchParams(),headingId=useId();
 const field=fields.find(item=>item.key===query.get('question')&&(!query.get('questionRestaurant')||item.restaurant_id===query.get('questionRestaurant')));
 const page=Math.min(100000,Math.max(1,Number.parseInt(query.get('questionPage')||'1',10)||1));
 const [retained,setRetained]=useState<{field:Field;page:number}|null>(field?{field,page}:null);
 const selection=field?{field,page}:retained;
 const [result,setResult]=useState<{key:string;data?:QuestionResponsePage;error?:string}|null>(null);
 const [retry,setRetry]=useState(0);
 const opener=useRef<HTMLElement|null>(null),cache=useRef(new Map<string,Promise<QuestionResponsePage>>()),controllers=useRef(new Set<AbortController>());
 const period=['7','30','90','all'].includes(params.period||'')?params.period!:'30';
 function requestKey(item:Field,targetPage:number){const search=new URLSearchParams({version:item.scope_version_id||'all',field:item.key,restaurant:item.restaurant_id,period,page:String(targetPage)});if(params.employee)search.set('employee',params.employee);if(params.rating)search.set('rating',params.rating);return search.toString();}
 function load(key:string){const prior=cache.current.get(key);if(prior)return prior;const controller=new AbortController();controllers.current.add(controller);const timer=window.setTimeout(()=>controller.abort(),20000);const pending:Promise<QuestionResponsePage>=fetch(`/api/opiniones/pregunta?${key}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||'No pudimos cargar las respuestas.');return body as QuestionResponsePage;}).catch(error=>{if(cache.current.get(key)===pending)cache.current.delete(key);throw error;}).finally(()=>{window.clearTimeout(timer);controllers.current.delete(controller);});cache.current.set(key,pending);return pending;}
 useEffect(()=>{if(field)setRetained({field,page});},[field,page]);
 useEffect(()=>()=>{controllers.current.forEach(controller=>controller.abort());cache.current.clear();},[]);
 const selectedKey=selection?requestKey(selection.field,selection.page):null;
 useEffect(()=>{if(!selectedKey)return;let canceled=false;load(selectedKey).then(data=>{if(!canceled)setResult({key:selectedKey,data});}).catch(error=>{if(!canceled)setResult({key:selectedKey,error:error instanceof Error&&error.name!=='AbortError'?error.message:'No pudimos cargar las respuestas. Inténtalo de nuevo.'});});return()=>{canceled=true;};},[selectedKey,retry]);
 const exited=useCallback(()=>{setRetained(null);opener.current?.focus({preventScroll:true});},[]);
 function close(){const url=new URL(window.location.href);url.searchParams.delete('question');url.searchParams.delete('questionPage');url.searchParams.delete('questionRestaurant');window.history.pushState(null,'',url.pathname+url.search);}
 function open(item:Field,element:HTMLElement){opener.current=element;const url=new URL(window.location.href);url.searchParams.set('questionVersion',item.scope_version_id||'all');url.searchParams.set('questionRestaurant',item.restaurant_id);url.searchParams.set('question',item.key);url.searchParams.delete('questionPage');window.history.pushState(null,'',url.pathname+url.search);}
 function changePage(value:number){const url=new URL(window.location.href);url.searchParams.set('questionPage',String(value));window.history.replaceState(null,'',url.pathname+url.search);}
 const data=result?.key===selectedKey?result.data:undefined,error=result?.key===selectedKey?result.error:undefined;
 const pages=data?Math.max(1,Math.ceil(data.total/data.page_size)):1;
 useEffect(()=>{if(field&&data&&page>pages){const url=new URL(window.location.href);url.searchParams.set('questionPage',String(pages));window.history.replaceState(null,'',url.pathname+url.search);}},[field,data,page,pages]);
 return <><QuestionAnswerCards fields={fields} compact={compact} onOpen={open} onPrefetch={item=>{void load(requestKey(item,1)).catch(()=>{});}}/>{selection&&<OpinionDialog isOpen={!!field} onClose={close} onExited={exited} closeHref="#" labelledBy={headingId}><section className="opinion-detail question-response-panel"><header><div><span className="eyebrow">RESPUESTAS A LA PREGUNTA</span><h2 id={headingId}>{selection.field.label}</h2><p className="muted">{selection.field.restaurant_name} · {selection.field.scope_version_id?`Encuesta v${selection.field.version}`:'Todas las versiones'}</p></div><button type="button" className="icon-action" onClick={close} aria-label="Cerrar respuestas"><X size={23}/></button></header><div className="question-response-context"><span className="pill">Solo encuestas enviadas</span><span>{period==='all'?'Desde el inicio':`Últimos ${period} días`}{params.employee?' · Empleado seleccionado':''}{params.rating?` · ${params.rating} estrellas`:''}</span></div><p className="question-response-note">Se muestran únicamente encuestas enviadas con respuesta a esta pregunta. Las respuestas se agrupan por el identificador de la pregunta, conservando la versión original de cada encuesta.</p><div aria-busy={!data&&!error}>{error?<div className="alert alert-error" role="alert"><p>{error}</p><button type="button" className="button button-outline button-sm" onClick={()=>setRetry(value=>value+1)}>Reintentar</button></div>:data?<><p className="question-response-total">{data.total.toLocaleString('es-MX')} respuestas</p><QuestionAnswerSummary data={data}/>{data.rows.length?<ul className="question-response-list">{data.rows.map(item=><li key={item.id}><div className="question-response-person"><strong>{item.guest_name}</strong><time dateTime={item.submitted_at}>{date(item.submitted_at)}</time></div><p className="question-response-waiter">Atendió: {item.employee_name}{data.all_versions&&item.version?` · Encuesta v${item.version}`:''}</p>{selection.field.key==='guest_name'?null:selection.field.key==='rating'||data.question?.presentation==='scale'?<ScoreAnswer answer={item.answer} main={selection.field.key==='rating'}/>:<p className="question-response-answer">{answerText(item.answer)}</p>}</li>)}</ul>:<div className="empty"><h3>No hay respuestas enviadas para estos filtros.</h3></div>}{pages>1&&<nav className="pagination actions" aria-label="Páginas de respuestas a la pregunta"><button type="button" className="button button-outline button-sm" disabled={selection.page<=1} onClick={()=>changePage(selection.page-1)}>← Anterior</button><span>Página {selection.page} de {pages}</span><button type="button" className="button button-outline button-sm" disabled={selection.page>=pages} onClick={()=>changePage(selection.page+1)}>Siguiente →</button></nav>}</>:<div className="question-response-skeleton" role="status" aria-label="Cargando respuestas">{[0,1,2].map(index=><div key={index}><span/><span/><span/></div>)}</div>}</div></section></OpinionDialog>}</>;
}
