import 'server-only';
import type { EngagementSummary,EngagementEmployee } from './opinions';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from './data';
export const isPortalAdmin=cache(async()=>{
 const {db}=await requireUser();
 const {data,error}=await db.rpc('is_portal_admin');
 // Older deployments remain usable until the new migration is applied.
 if(error){if(['PGRST202','42883'].includes(error.code))return false;throw new Error('No pudimos verificar los permisos de tu cuenta.');}
 return data===true;
});
export const requirePortalAdmin=cache(async()=>{
 const session=await requireUser();
 if(!await isPortalAdmin())notFound();
 return session;
});
export type PortalEmployee={id:string;restaurant_id:string;first_name:string;last_name:string;role:string;restaurant_name:string;deleted_at:string|null;survey_published:boolean;visits?:number;engagement?:EngagementEmployee};
export type DirectoryParams={q?:string|string[];restaurant?:string|string[];status?:string|string[];page?:string|string[]};
export type DirectoryFilters={query:string;restaurant:string;status:'active'|'archived'|'all';page:number};
export async function portalDirectory(params:DirectoryParams){
 const {db,user}=await requirePortalAdmin();
 const query=typeof params.q==='string'?params.q:'',restaurant=typeof params.restaurant==='string'?params.restaurant:'',page=typeof params.page==='string'?params.page:'1';
 const filters:DirectoryFilters={query:query.trim().slice(0,150),restaurant:z.uuid().safeParse(restaurant).success?restaurant:'',status:params.status==='all'||params.status==='archived'?params.status:'active',page:Math.min(100000,Math.max(1,Number.parseInt(page,10)||1))};
 const [directoryResult,engagementResult]=await Promise.all([db.rpc('portal_employee_directory',{p_query:filters.query,p_restaurant_id:filters.restaurant||null,p_status:filters.status,p_page:filters.page}),db.rpc('portal_engagement_metrics',{p_query:filters.query,p_restaurant_id:filters.restaurant||null,p_status:filters.status})]);
 const {data,error}=directoryResult;
 if(engagementResult.error&&!['PGRST202','42883'].includes(engagementResult.error.code))throw new Error('No pudimos cargar la participación.');
 const engagement=engagementResult.error?null:engagementResult.data as EngagementSummary&{employees:EngagementEmployee[]};
 if(error)throw new Error('No pudimos cargar el directorio del portal. Verifica que la migración de administración esté aplicada.');
 return {user,filters,engagement,directory:data as {employees:PortalEmployee[];total:number;visits?:number;restaurants:{id:string;name:string}[];page:number;page_size:number}};
}
export function portalHref(filters:DirectoryFilters,page:number){const params=new URLSearchParams();if(filters.query)params.set('q',filters.query);if(filters.restaurant)params.set('restaurant',filters.restaurant);if(filters.status!=='active')params.set('status',filters.status);if(page>1)params.set('page',String(page));return params.size?`/admin?${params}`:'/admin';}
