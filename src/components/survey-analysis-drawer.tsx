'use client';
import { useCallback,useId,useRef,useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Sparkles,X,Maximize2,Minimize2 } from 'lucide-react';
import type { EngagementMetrics,OpinionParams } from '@/lib/opinions';
import type { ParticipationVersion } from '@/lib/participation-versions';
import { participationOptions,insightScope } from '@/lib/participation-selection';
import { opinionHref } from '@/lib/opinion-navigation';
import { OpinionDialog } from './opinion-dialog';
import { RestaurantAIReport } from './restaurant-ai-report';
type Props={fields:EngagementMetrics['fields'];versions:ParticipationVersion[]|null;params:OpinionParams};
export function SurveyAnalysisButton({fields,versions,params}:Props){
 const query=useSearchParams(),heading=useId(),button=useRef<HTMLButtonElement>(null);
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false),[expanded,setExpanded]=useState(false);
 const exited=useCallback(()=>{setMounted(false);button.current?.focus({preventScroll:true});},[]);
 const options=participationOptions(fields,versions),selected=options.find(version=>version.id===query.get('questionVersion'));
 const restaurant=params.restaurant&&params.restaurant!=='all'?params.restaurant:options.length&&new Set(options.map(version=>version.restaurant_id)).size===1?options[0].restaurant_id:null;
 if(params.portal!=='1')return null;
 const scope=selected?insightScope(selected,params):restaurant?insightScope({id:'all',restaurant_id:restaurant,restaurant_name:'',version:0,title:'',published_at:''},params):null;
 return <><button ref={button} type="button" className="button button-outline button-sm survey-analysis-trigger" disabled={!scope} title={!scope?'Selecciona un restaurante para analizar sus encuestas.':undefined} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setMounted(true);setOpen(true);}}><Sparkles size={15} aria-hidden="true"/>Análisis con IA</button>{mounted&&scope&&<OpinionDialog closeHref="#" isOpen={open} onClose={()=>setOpen(false)} onExited={exited} labelledBy={heading} expanded={expanded}><section className="opinion-detail survey-analysis-drawer"><header><div><span className="eyebrow">ANÁLISIS DE LA ENCUESTA</span><h2 id={heading}>Análisis con IA</h2><p className="muted">{selected?selected.restaurant_name:'Reporte del restaurante seleccionado'}</p></div><div className="ai-report-window-actions"><button type="button" className="icon-action" aria-label={expanded?'Reducir reporte':'Expandir reporte a pantalla completa'} title={expanded?'Reducir':'Pantalla completa'} aria-pressed={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button><button type="button" className="icon-action" onClick={()=>setOpen(false)} aria-label="Cerrar análisis"><X size={23}/></button></div></header><RestaurantAIReport key={scope} query={scope} versions={options.filter(v=>v.restaurant_id===restaurant)}/></section></OpinionDialog>}</>;
}
export function ParticipationToolbar(props:Props){const query=useSearchParams();return <div className="participation-page-toolbar"><Link className="text-link question-back" href={opinionHref(props.params,{view:undefined,detail:undefined,questionVersion:query.get('questionVersion')||props.params.questionVersion})}>← Volver atrás</Link><SurveyAnalysisButton {...props}/></div>;}
