import 'server-only';
import { normalizeTheme } from './survey-theme';
import type { PublishedSurvey } from './survey-types';
import type { EngagementMetrics,VisitMetrics } from './opinions';
import type { Employee } from './data';
import { createClient } from './supabase/server';
import { withInitialRating,type SurveyDraft } from './validation';
export async function restaurantData(db:Awaited<ReturnType<typeof createClient>>,id:string,includeEmployees=true) {
  const [e,s,publishedResult]=await Promise.all([includeEmployees?db.from('employees').select('id,restaurant_id,first_name,last_name,role,photo_path').eq('restaurant_id',id).is('deleted_at',null).order('created_at'):{data:[],error:null},db.from('survey_drafts').select('title,questions,theme,editor_state,builder_step').eq('restaurant_id',id).maybeSingle(),db.from('survey_versions').select('id,version,title,questions,published_at,theme').eq('restaurant_id',id).order('version',{ascending:false}).limit(1).maybeSingle()]);
  if(e.error||s.error)throw new Error('No pudimos cargar los datos del restaurante.');
  const employees:Employee[]=await Promise.all((e.data||[]).map(async employee=>{
    if(!employee.photo_path)return employee;
    const {data}=await db.storage.from('employee-photos').createSignedUrl(employee.photo_path,3600);
    return {...employee,photo_url:data?.signedUrl||null};
  }));
  const draft=s.data;
  const {data:published,error:publishedError}=publishedResult;
  if(publishedError)throw new Error('No pudimos cargar la encuesta publicada.');
  return {employees,published:published as PublishedSurvey|null,draft:draft?{title:draft.editor_state?.title??draft.title,questions:withInitialRating(draft.editor_state?.questions??draft.questions),theme:normalizeTheme(draft.theme),builderStep:draft.builder_step} as SurveyDraft:null};
}

export async function teamData(db:Awaited<ReturnType<typeof createClient>>,restaurants:{id:string;name:string;active_survey_id?:string|null}[]) {
  const restaurantId=restaurants.length===1?restaurants[0].id:null;
  const [staff,visits,engagement]=await Promise.all([db.from('employees').select('id,restaurant_id,first_name,last_name,role,photo_path').in('restaurant_id',restaurants.map(r=>r.id)).is('deleted_at',null).order('created_at'),db.rpc('survey_visit_metrics',{p_restaurant_id:restaurantId}),db.rpc('survey_engagement_metrics',{p_restaurant_id:restaurantId})]);
  const {data,error}=staff;
  for(const result of [visits,engagement])if(result.error&&!['PGRST202','42883'].includes(result.error.code))throw new Error('No pudimos cargar las métricas del equipo.');
  const visitMap=new Map((visits.data as VisitMetrics|null)?.employees.map(employee=>[employee.id,employee.visits])||[]);
  const engagementMap=new Map((engagement.data as EngagementMetrics|null)?.employees.map(employee=>[employee.employee_id,employee])||[]);
  if(error)throw new Error('No pudimos cargar tu equipo.');
  const paths=[...new Set((data||[]).flatMap(employee=>employee.photo_path?[employee.photo_path]:[]))];
  const photos=paths.length?await db.storage.from('employee-photos').createSignedUrls(paths,3600):null;
  const photoUrls=new Map((photos?.data||[]).map(photo=>[photo.path,photo.signedUrl]));
  const names=new Map(restaurants.map(restaurant=>[restaurant.id,restaurant.name]));
  return (data||[]).map(employee=>({...employee,visits:visitMap.get(employee.id),engagement:engagementMap.get(employee.id),survey_published:!!restaurants.find(restaurant=>restaurant.id===employee.restaurant_id)?.active_survey_id,restaurant_name:names.get(employee.restaurant_id),photo_url:employee.photo_path?photoUrls.get(employee.photo_path)||null:null} as Employee));
}
