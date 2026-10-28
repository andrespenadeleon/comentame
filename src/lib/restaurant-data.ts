import 'server-only';
import { normalizeTheme } from './survey-theme';
import type { PublishedSurvey } from './survey-types';
import type { Employee } from './data';
import { createClient } from './supabase/server';
import { withInitialRating,type SurveyDraft } from './validation';
export async function restaurantData(db:Awaited<ReturnType<typeof createClient>>,id:string) {
  const [e,s]=await Promise.all([db.from('employees').select('id,restaurant_id,first_name,last_name,role,photo_path').eq('restaurant_id',id).is('deleted_at',null).order('created_at'),db.from('survey_drafts').select('title,questions,theme,editor_state,builder_step').eq('restaurant_id',id).maybeSingle()]);
  if(e.error||s.error)throw new Error('No pudimos cargar los datos del restaurante.');
  const employees:Employee[]=await Promise.all((e.data||[]).map(async employee=>{
    if(!employee.photo_path)return employee;
    const {data}=await db.storage.from('employee-photos').createSignedUrl(employee.photo_path,3600);
    return {...employee,photo_url:data?.signedUrl||null};
  }));
  const draft=s.data;
  const {data:published,error:publishedError}=await db.from('survey_versions').select('id,version,title,questions,published_at,theme').eq('restaurant_id',id).order('version',{ascending:false}).limit(1).maybeSingle();
  if(publishedError)throw new Error('No pudimos cargar la encuesta publicada.');
  return {employees,published:published as PublishedSurvey|null,draft:draft?{title:draft.editor_state?.title??draft.title,questions:withInitialRating(draft.editor_state?.questions??draft.questions),theme:normalizeTheme(draft.theme),builderStep:draft.builder_step} as SurveyDraft:null};
}

export async function teamData(db:Awaited<ReturnType<typeof createClient>>,restaurants:{id:string;name:string}[]) {
  const {data,error}=await db.from('employees').select('id,restaurant_id,first_name,last_name,role,photo_path').in('restaurant_id',restaurants.map(r=>r.id)).is('deleted_at',null).order('created_at');
  if(error)throw new Error('No pudimos cargar tu equipo.');
  return Promise.all((data||[]).map(async employee=>{
    const photo=employee.photo_path?await db.storage.from('employee-photos').createSignedUrl(employee.photo_path,3600):null;
    return {...employee,restaurant_name:restaurants.find(r=>r.id===employee.restaurant_id)?.name,photo_url:photo?.data?.signedUrl||null} as Employee;
  }));
}
