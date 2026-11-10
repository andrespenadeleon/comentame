import 'server-only';
import type { createClient } from './supabase/server';
import type { Answers } from './survey-types';
import type { Question } from './validation';
export type Opinion={id:string;restaurant_id:string;employee_id:string;restaurant_name:string;employee_name:string;guest_name:string;guest_contact:string|null;rating:number;answers:Answers;submitted_at:string;survey_version_id:string};
export type OpinionParams={section?:string;restaurant?:string;period?:string;rating?:string;employee?:string;page?:string;detail?:string;tab?:string;scope?:string;portal?:string;view?:string};
type DB=Awaited<ReturnType<typeof createClient>>;
export async function opinionsData(db:DB,restaurantIds:string[],params:OpinionParams){
 const restaurant=restaurantIds.includes(params.restaurant||'')?params.restaurant:null;
 const period=['7','30','90','all'].includes(params.period||'')?params.period!:'30';
 const from=period==='all'?null:new Date(Date.now()-Number(period)*86400000).toISOString();
 const rating=/^[1-5]$/.test(params.rating||'')?Number(params.rating):null;
 const {data:staff,error:staffError}=await db.from('employees').select('id,restaurant_id,first_name,last_name,deleted_at').in('restaurant_id',restaurantIds).order('first_name');
 if(staffError)throw new Error('No pudimos cargar los filtros de opiniones.');
 const employee=(staff||[]).some(e=>e.id===params.employee&&(!restaurant||e.restaurant_id===restaurant))?params.employee:null;
 const page=Math.min(100000,Math.max(1,Number.parseInt(params.page||'1',10)||1));
 let query=db.from('survey_responses').select('*',{count:'exact'}).in('restaurant_id',restaurantIds);
 if(restaurant)query=query.eq('restaurant_id',restaurant);
 if(employee)query=query.eq('employee_id',employee);
 if(rating)query=query.eq('rating',rating);
 if(from)query=query.gte('submitted_at',from);
 const [list,summary,metrics,engagement]=await Promise.all([query.order('submitted_at',{ascending:false}).order('id').range((page-1)*20,page*20-1),db.rpc('opinions_summary',{p_restaurant_id:restaurant,p_employee_id:employee,p_rating:rating,p_from:from}),db.rpc('survey_visit_metrics',{p_restaurant_id:restaurant,p_employee_id:employee,p_from:from,p_rating:rating}),db.rpc('survey_engagement_metrics',{p_restaurant_id:restaurant,p_employee_id:employee,p_from:from})]);
 if(list.error||summary.error)throw new Error('No pudimos cargar las opiniones. Verifica que la migración de encuestas esté aplicada.');
 let detail:Opinion|null=null,version:{title:string;version:number;questions:Question[]}|null=null;
 if(params.detail&&/^[a-f0-9-]{36}$/i.test(params.detail)){
  let detailQuery=db.from('survey_responses').select('*').eq('id',params.detail).in('restaurant_id',restaurantIds);
  if(restaurant)detailQuery=detailQuery.eq('restaurant_id',restaurant);
  const result=await detailQuery.maybeSingle();
  if(result.error)throw new Error('No pudimos cargar el detalle de la opinión.');
  detail=result.data as Opinion|null;
  if(detail){const result=await db.from('survey_versions').select('title,version,questions').eq('id',detail.survey_version_id).maybeSingle();if(result.error)throw new Error('No pudimos cargar las preguntas originales.');version=result.data;}
 }
 if(metrics.error&&!['PGRST202','42883'].includes(metrics.error.code))throw new Error('No pudimos cargar las visitas.');
 if(engagement.error&&!['PGRST202','42883'].includes(engagement.error.code))throw new Error('No pudimos cargar la participación.');
 return {engagement:engagement.error?null:engagement.data as EngagementMetrics,metrics:metrics.error?null:metrics.data as VisitMetrics,opinions:(list.data||[]) as Opinion[],count:list.count||0,summary:summary.data as {total:number;average:number|null;distribution:Record<string,number>},staff:staff||[],restaurant,period,rating,employee,page,detail,version};
}

export type VisitMetrics={visits:number;employees:{id:string;restaurant_id:string;name:string;restaurant_name:string;archived:boolean;role?:string;visits:number;responses:number;average:number|null}[]};

export type EngagementSummary={google_clicks?:number;visits:number;starts:number;completions:number;unfinished:number;average_seconds:number|null;completed_seconds?:number|null;incomplete_seconds?:number|null};
export type EngagementEmployee=EngagementSummary&{employee_id:string};
export type EngagementMetrics=EngagementSummary&{employees:EngagementEmployee[];fields:{restaurant_id:string;restaurant_name:string;version_id:string;version:number;key:string;label:string;visits:number;touched:number;answered:number}[]};
