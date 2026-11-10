import 'server-only';
import type { createClient } from './supabase/server';
import type { EngagementMetrics } from './opinions';
export type EmployeePerformance={id:string;name:string;role:string;reviews:number;rating_sum:number;average:number|null;five_stars:number};
export async function overviewData(db:Awaited<ReturnType<typeof createClient>>,restaurantId:string,requestedPeriod?:string){
 const period=['7','30','90','all'].includes(requestedPeriod||'')?requestedPeriod!:'30';
 const from=period==='all'?null:new Date(Date.now()-Number(period)*86400000).toISOString();
 let visitsQuery=db.from('survey_visits').select('id',{count:'exact',head:true}).eq('restaurant_id',restaurantId);
 if(from)visitsQuery=visitsQuery.gte('visited_at',from);
 const [summary,visits,engagement,performance]=await Promise.all([
  db.rpc('opinions_summary',{p_restaurant_id:restaurantId,p_employee_id:null,p_rating:null,p_from:from}),
  visitsQuery,
  db.rpc('survey_engagement_metrics',{p_restaurant_id:restaurantId,p_employee_id:null,p_from:from}),
  db.rpc('restaurant_employee_performance',{p_restaurant_id:restaurantId,p_from:from}),
 ]);
 if(summary.error)throw new Error('No pudimos cargar el resumen del restaurante.');
 for(const result of [visits,engagement,performance])if(result.error&&!['PGRST202','42883','42P01','PGRST205'].includes(result.error.code))throw new Error('No pudimos cargar las métricas del resumen.');
 return {period,summary:summary.data as {total:number;average:number|null},visits:visits.error?null:visits.count||0,engagement:engagement.error?null:engagement.data as EngagementMetrics,performance:performance.error?null:performance.data as EmployeePerformance[]};
}
