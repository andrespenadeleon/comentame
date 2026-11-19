import 'server-only';
import { z } from 'zod';
import { requireUser } from './data';
import { requirePortalAdmin } from './portal-admin';
import type { Opinion,OpinionParams } from './opinions';
import type { Question } from './validation';
export type LeadRow={id:string;guest_name:string;guest_contact:string;submitted_at:string;employee_name:string;contact_key:string|null;google_clicked:boolean;google_legacy:boolean;response?:Opinion;version?:LeadData['version']};
export type LeadData={total:number;rows:LeadRow[];detail:Opinion|null;version:{title:string;version:number;questions:Question[]}|null};
export function leadHref(restaurant:string,page:number,portal=false,detail?:string){const query=new URLSearchParams({section:'leads',restaurant,page:String(page)});if(detail)query.set('detail',detail);return `${portal?'/admin':'/dashboard'}?${query}`;}
export async function leadsData(restaurantId:string,params:OpinionParams,portal:boolean){
 const {db}=await (portal?requirePortalAdmin():requireUser());
 const page=Math.min(100000,Math.max(1,Number.parseInt(params.page||'1',10)||1));
 const detail=z.uuid().safeParse(params.detail);
 let {data,error}=await db.rpc('restaurant_leads_page',{p_restaurant_id:restaurantId,p_page:page,p_detail:detail.success?detail.data:null});
 if(error&&['PGRST202','42883'].includes(error.code)){const fallback=await db.rpc('restaurant_leads',{p_restaurant_id:restaurantId,p_page:page,p_detail:detail.success?detail.data:null});data=fallback.data;error=fallback.error;}
 if(error){if(['PGRST202','42883'].includes(error.code))return {setup:true as const,page,data:null};throw new Error('No pudimos cargar los leads de este restaurante.');}
 return {setup:false as const,page,data:data as LeadData};
}
