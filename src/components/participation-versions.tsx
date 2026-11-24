'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { opinionHref } from '@/lib/opinion-navigation';
import { useEffect,useId,useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ParticipationVersion } from '@/lib/participation-versions';
import type { EngagementMetrics,OpinionParams } from '@/lib/opinions';
import { questionAnalyticsScope,type QuestionAnalytics } from '@/lib/question-analytics-types';
import { QuestionResponses } from './question-responses';
import { SurveyAnalysisButton } from './survey-analysis-drawer';
import { participationOptions } from '@/lib/participation-selection';
export function ParticipationVersions({fields,versions,params,full,initial}:{fields:EngagementMetrics['fields'];versions:ParticipationVersion[]|null;params:OpinionParams;full:boolean;initial:QuestionAnalytics|null}){
 const id=useId(),query=useSearchParams();
 // The catalog is already sorted by publication date, including versions with no activity.
 // Until the metadata migration is applied, expose only versions actually in the response.
 const options=participationOptions(fields,versions);
 const selected=options.find(version=>version.id===query.get('questionVersion'));
 const selectedVersion=full?(selected?.id||'all'):'all';
 const period=['7','30','90','all'].includes(params.period||'')?params.period!:'30';
 const scope=questionAnalyticsScope(params.restaurant||'all',selectedVersion,period,params.employee,params.rating);
 const [result,setResult]=useState<{scope:string;data?:QuestionAnalytics;error?:string}>(()=>({scope:initial?.scope||'',data:initial||undefined}));
 const [retry,setRetry]=useState(0);
 useEffect(()=>{if(initial?.scope===scope){setResult({scope,data:initial});return;}const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),25000);let canceled=false;fetch(`/api/opiniones/preguntas?${scope}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||'No pudimos cargar las preguntas.');return body as QuestionAnalytics;}).then(data=>{if(!canceled)setResult({scope,data});}).catch(error=>{if(!canceled)setResult({scope,error:error instanceof Error&&error.name!=='AbortError'?error.message:'No pudimos cargar las preguntas. Reintenta.'});}).finally(()=>window.clearTimeout(timer));return()=>{canceled=true;window.clearTimeout(timer);controller.abort();};},[scope,initial,retry]);
 const data=result.scope===scope?result.data:undefined,error=result.scope===scope?result.error:undefined;
 function change(value:string){const url=new URL(window.location.href);url.searchParams.set('questionVersion',value);url.searchParams.delete('question');url.searchParams.delete('questionPage');url.searchParams.delete('questionRestaurant');window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
 const latestIds=new Set(options.filter((version,index)=>options.findIndex(item=>item.restaurant_id===version.restaurant_id)===index).map(version=>version.id));
 const visible=data?(full?data.groups:data.groups.filter(question=>latestIds.has(question.version_id)).slice(0,4)):[];
 return <><div className="participation-version-toolbar">{full&&<label className="field" htmlFor={id}>Versión de la encuesta<select id={id} className="input" value={selectedVersion} onChange={event=>change(event.target.value)}><option value="all">Todas las versiones</option>{options.map((version,index)=><option value={version.id} key={version.id}>{version.restaurant_name} · Versión {version.version}{versions&&index===0?' (más reciente)':''}{version.title?` · ${version.title}`:''}</option>)}</select></label>}{!full&&<SurveyAnalysisButton fields={fields} versions={versions} params={params}/>}</div>{error?<div className="alert alert-error" role="alert"><p>{error}</p><button type="button" className="button button-outline button-sm" onClick={()=>setRetry(value=>value+1)}>Reintentar</button></div>:data?data.groups.length?<QuestionResponses key={scope} fields={visible} params={params} compact={!full}/>:<p className="opinion-analytics-empty">No hay preguntas publicadas para esta selección.</p>:<div className="question-response-skeleton" role="status" aria-label="Cargando preguntas"><div><span/><span/><span/></div></div>}{!full&&data&&<footer className="participation-card-footer"><Link className="participation-view-all" href={opinionHref(params,{view:'questions',questionVersion:undefined,question:undefined,questionRestaurant:undefined,questionPage:undefined})}>Ver todas las preguntas<ArrowRight size={18} aria-hidden="true"/></Link></footer>}</>;

}

export function QuestionVersionInput(){const query=useSearchParams();const value=query.get('questionVersion');return value?<input type="hidden" name="questionVersion" value={value}/>:null;}
