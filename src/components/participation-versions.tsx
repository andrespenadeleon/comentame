'use client';
import { useId } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ParticipationVersion } from '@/lib/participation-versions';
import type { EngagementMetrics,OpinionParams } from '@/lib/opinions';
import { opinionHref } from '@/lib/opinion-navigation';
import { QuestionResponses } from './question-responses';
import { SurveyAnalysisButton } from './survey-analysis-drawer';
import { participationOptions } from '@/lib/participation-selection';
export function ParticipationVersions({fields,versions,params,full}:{fields:EngagementMetrics['fields'];versions:ParticipationVersion[]|null;params:OpinionParams;full:boolean}){
 const id=useId(),query=useSearchParams();
 // The catalog is already sorted by publication date, including versions with no activity.
 // Until the metadata migration is applied, expose only versions actually in the response.
 const options=participationOptions(fields,versions);
 const selected=options.find(version=>version.id===query.get('questionVersion'))||options[0];
 const selectedFields=selected?fields.filter(field=>field.version_id===selected.id):[];
 function change(value:string){const url=new URL(window.location.href);url.searchParams.set('questionVersion',value);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
 return <><div className="participation-version-toolbar"><label className="field" htmlFor={id}>Versión de la encuesta<select id={id} className="input" value={selected?.id||''} onChange={event=>change(event.target.value)} disabled={!options.length}>{options.length?options.map((version,index)=><option value={version.id} key={version.id}>{version.restaurant_name} · Versión {version.version}{versions&&index===0?' (más reciente)':''}{version.title?` · ${version.title}`:''}</option>):<option value="">Sin encuestas publicadas</option>}</select></label>{!full&&<SurveyAnalysisButton fields={fields} versions={versions} params={params}/>}</div>{versions===null&&<p className="participation-version-note">Solo se muestran versiones con actividad. La actualización de versiones en Supabase permite incluir también la última encuesta sin respuestas.</p>}{selectedFields.length?<QuestionResponses key={`${selected!.id}:${params.period||'30'}:${params.employee||''}:${params.rating||''}`} fields={selectedFields} params={params} full={full}/>:<p className="opinion-analytics-empty">{selected?'Esta versión todavía no tiene participación registrada para el periodo y empleado seleccionados.':'Publica una encuesta para consultar su participación.'}</p>}{!full&&selected&&<Link className="text-link question-participation-link" href={opinionHref(params,{questionVersion:selected.id,view:'questions',detail:undefined})}>Ver todas las preguntas →</Link>}</>;
}

export function QuestionVersionInput(){const query=useSearchParams();const value=query.get('questionVersion');return value?<input type="hidden" name="questionVersion" value={value}/>:null;}
