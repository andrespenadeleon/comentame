import 'server-only';
import { z } from 'zod';
import { requirePortalAdmin } from './portal-admin';
import { reportToday } from './restaurant-report-types';
import type { AIMonitorData,AIMonitorParams } from './ai-monitor-types';
export async function aiMonitorData(params:AIMonitorParams){
 const {db}=await requirePortalAdmin();const today=reportToday();
 const filters={aiRequest:z.uuid().safeParse(params.aiRequest).success?params.aiRequest!:undefined,aiRestaurant:z.uuid().safeParse(params.aiRestaurant).success?params.aiRestaurant!:'all',aiStatus:['running','succeeded','failed','blocked','reused','abandoned'].includes(params.aiStatus||'')?params.aiStatus!:'all',aiEnvironment:['development','preview','production','unknown'].includes(params.aiEnvironment||'')?params.aiEnvironment!:'all',aiFrom:z.iso.date().safeParse(params.aiFrom).success?params.aiFrom!:params.aiRequest?'2020-01-01':`${today.slice(0,7)}-01`,aiTo:z.iso.date().safeParse(params.aiTo).success?params.aiTo!:today};
 if(filters.aiTo<filters.aiFrom)filters.aiTo=filters.aiFrom;
 const through=new Date(`${filters.aiTo}T00:00:00-06:00`);through.setUTCDate(through.getUTCDate()+1);
 const page=Math.min(100000,Math.max(1,Number.parseInt(params.page||'1',10)||1));
 const {data,error}=await db.rpc('portal_ai_monitor',{p_restaurant:filters.aiRestaurant==='all'?null:filters.aiRestaurant,p_status:filters.aiStatus,p_environment:filters.aiEnvironment,p_from:`${filters.aiFrom}T00:00:00-06:00`,p_through:through.toISOString(),p_page:page,p_request:filters.aiRequest||null});
 return {filters,page,data:error?null:data as AIMonitorData,error:error?(['42883','PGRST202','42P01','PGRST205'].includes(error.code)?'Aplica la migración 202611270003_report_publication_and_prompts.sql para habilitar el monitoreo.':'No pudimos cargar el monitoreo IA. Vuelve a intentar.'):null,configured:!!process.env.OPENAI_API_KEY,environment:process.env.VERCEL_ENV||'development'};
}
export function aiMonitorHref(params:AIMonitorParams,patch:AIMonitorParams={}){const q=new URLSearchParams({section:'ia',restaurant:'all'});for(const[key,value]of Object.entries({...params,...patch})){if(value)q.set(key,String(value));}return `/admin?${q}`;}
