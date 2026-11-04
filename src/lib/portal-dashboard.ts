import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { requirePortalAdmin } from './portal-admin';
import type { Restaurant } from './data';
import type { OpinionParams,opinionsData,VisitMetrics,EngagementMetrics } from './opinions';
import type { Question } from './validation';
import type { SurveyTheme } from './survey-theme';
export const portalWorkspace=cache(async()=>{
 const {db,user}=await requirePortalAdmin();
 const {data,error}=await db.rpc('portal_restaurants');
 if(error){if(['PGRST202','42883'].includes(error.code))return {db,user,restaurants:[] as Restaurant[],setup:true};throw new Error('No pudimos cargar los restaurantes del portal.');}
 return {db,user,restaurants:data as Restaurant[],setup:false};
});
export async function portalOpinions(params:OpinionParams){
 const {db}=await requirePortalAdmin();
 const restaurant=z.uuid().safeParse(params.restaurant).success?params.restaurant!:null;
 const period=['7','30','90','all'].includes(params.period||'')?params.period!:'30';
 const employee=z.uuid().safeParse(params.employee).success?params.employee!:null;
 const rating=/^[1-5]$/.test(params.rating||'')?Number(params.rating):null;
 const page=Math.min(100000,Math.max(1,Number.parseInt(params.page||'1',10)||1));
 const detail=z.uuid().safeParse(params.detail).success?params.detail!:null;
 const from=period==='all'?null:new Date(Date.now()-Number(period)*86400000).toISOString();
 const [opinions,metrics,engagement]=await Promise.all([
 db.rpc('portal_opinions',{p_restaurant_id:restaurant,p_period:period,p_rating:rating,p_employee_id:employee,p_page:page,p_detail:detail}),
 db.rpc('portal_visit_metrics',{p_restaurant_id:restaurant,p_employee_id:employee,p_rating:rating,p_from:from}),
 db.rpc('portal_survey_engagement',{p_restaurant_id:restaurant,p_employee_id:employee,p_from:from})]);
 if(opinions.error||metrics.error||engagement.error)throw new Error('No pudimos cargar las opiniones y métricas del portal.');
 return {...opinions.data,metrics:metrics.data as VisitMetrics,engagement:engagement.data as EngagementMetrics} as Awaited<ReturnType<typeof opinionsData>>;
}
export type PortalSurvey={id?:string;restaurant_id:string;restaurant_name:string;title:string;questions:Question[];theme:SurveyTheme;logo_path?:string|null;social_links?:Restaurant['social_links'];google_maps_url?:string|null;version?:number;active?:boolean;published_at?:string;updated_at?:string};
export async function portalSurveys(restaurant:string,page:number){
 const {db}=await requirePortalAdmin();
 const {data,error}=await db.rpc('portal_survey_catalog',{p_restaurant_id:restaurant==='all'?null:restaurant,p_page:page});
 if(error)throw new Error('No pudimos cargar las encuestas del portal.');
 return data as {drafts:PortalSurvey[];published:PortalSurvey[];total:number};
}
export function descriptiveSurveyUrl(origin:string,restaurantId:string,employeeId:string,restaurantName:string,employeeName:string){
 const slug=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const base=new URL(origin);
 if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw new Error('Configura un dominio válido para los enlaces.');
 const url=new URL(`/encuesta/${restaurantId}/${employeeId}`,base.origin);
 url.searchParams.set('restaurante',slug(restaurantName));url.searchParams.set('empleado',slug(employeeName));
 return url.toString();
}
