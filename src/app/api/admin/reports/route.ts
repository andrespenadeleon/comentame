import {reportBranding} from '@/lib/report-branding';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { generateRestaurantReport } from '@/lib/ai/restaurant-report';
import { createAIAudit,diagnoseAIError } from '@/lib/ai/observability';
import type { ReportSnapshot,ReportNarrative } from '@/lib/restaurant-report-types';
export const runtime='nodejs';export const maxDuration=180;
const scope=z.object({restaurant:z.uuid(),start:z.iso.date(),end:z.iso.date(),version:z.union([z.uuid(),z.literal('all')]).default('all'),employee:z.uuid().optional(),rating:z.coerce.number().int().min(1).max(5).optional()}).strict();
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
function databaseIssue(error:{message?:string;code?:string}){
 const m=error.message||'',missing=['42883','PGRST202','42P01','PGRST205'].includes(error.code||'');
 const code=missing?'migration_missing':m.includes('weekly_limit')?'weekly_limit_reached':m.includes('in_progress')?'report_in_progress':m.includes('too_large')?'report_too_large':m.includes('scope_conflict')?'request_scope_conflict':error.code==='42501'?'access_denied':'database_error';
 const message=missing?'Aplica las migraciones de reportes y monitoreo IA en Supabase.':code==='weekly_limit_reached'?'Este restaurante ya utilizó sus 2 análisis semanales.':code==='report_in_progress'?'Ya se está generando un reporte para este restaurante. Espera y vuelve a cargar.':code==='report_too_large'?'Hay demasiados datos. Selecciona un periodo más corto.':code==='request_scope_conflict'?'El intento pertenece a otra selección. Vuelve a abrir el análisis.':code==='access_denied'?'No tienes acceso a este reporte.':'No pudimos procesar el reporte. Revisa las fechas y los filtros.';
 return {code,message,status:code==='access_denied'?403:code==='weekly_limit_reached'?429:code==='report_in_progress'||code==='request_scope_conflict'?409:code==='report_too_large'?413:missing?503:400};
}
async function execute(input:unknown,generate:boolean){
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user?.email_confirmed_at)return Response.json({error:'Vuelve a iniciar sesión.'},{status:401,headers});
 const {data:admin}=await db.rpc('is_portal_admin');if(admin!==true)return Response.json({error:'Solo administradores del portal pueden acceder a los reportes IA.'},{status:403,headers});
 const parsed=(generate?scope.extend({requestId:z.uuid()}):scope).safeParse(input);
 const operationId=crypto.randomUUID(),audit=createAIAudit(db,operationId);
 const environment=process.env.VERCEL_ENV==='production'?'production':process.env.VERCEL_ENV==='preview'?'preview':'development';
 // Start before reservation so quota/configuration failures are visible as operations too.
 await audit.start({restaurant_id:parsed.success?parsed.data.restaurant:null,request_id:parsed.success&&generate?(parsed.data as {requestId:string}).requestId:null,environment,model:'gpt-6-luna',metadata:{is_admin_run:true,method:generate?'POST':'GET',kind:generate?'report_generation':'report_read',...(parsed.success?{range_start:parsed.data.start,range_end:parsed.data.end,version:parsed.data.version,employee_filter:!!parsed.data.employee,rating_filter:parsed.data.rating||null}:{})}});
 const respond=(body:Record<string,unknown>,status=200)=>Response.json({...body,operationId,monitoringDegraded:audit.degraded},{status,headers:{...headers,'X-AI-Operation-ID':operationId}});
 if(!parsed.success){await audit.failure({code:'invalid_filters',message:'Fechas o filtros no válidos.',stage:'validation',retryable:false},'blocked');return respond({error:'Selecciona un restaurante y fechas válidas.'},400);}
 const p=parsed.data,args={p_restaurant:p.restaurant,p_start:p.start,p_end:p.end,p_version:p.version==='all'?null:p.version,p_employee:p.employee||null,p_rating:p.rating||null};
 async function dbFailure(error:{message?:string;code?:string},stage:string){const issue=databaseIssue(error);await audit.failure({...issue,stage,retryable:false,metadata:{database_code:error.code}},issue.status===429||issue.status===409||issue.status===413?'blocked':'failed');return respond({error:issue.message,code:issue.code},issue.status);}
 try{
  if(!generate){const {data,error}=await db.rpc('restaurant_ai_report_state',args);if(error)return dbFailure(error,'state_read');await audit.event('quota_checked',{metadata:{used:data.used,limit:data.limit,remaining:data.remaining}},'info',undefined,'Cuota semanal consultada.');await audit.finish('reused',data.report?'Reporte guardado consultado; sin llamada a OpenAI.':'Estado y cuota consultados; sin llamada a OpenAI.');return respond({...data,report:await reportBranding(db,data.report,p.restaurant),configured:!!process.env.OPENAI_API_KEY});}
  if(!process.env.OPENAI_API_KEY){await audit.failure({code:'ai_not_configured',message:'Falta OPENAI_API_KEY en el servidor.',stage:'configuration',retryable:false},'blocked');return respond({error:'Configura OPENAI_API_KEY en el servidor para generar reportes.',code:'ai_not_configured'},503);}
  // Fail closed if we cannot persist the initial audit. Do not make an unlogged paid call.
  if(audit.degraded)return respond({error:'No podemos guardar el registro de actividad IA. Actualiza Supabase antes de generar reportes.',code:'audit_unavailable'},503);
  const requestId=(p as z.infer<typeof scope>&{requestId:string}).requestId;
  const reserved=await db.rpc('reserve_restaurant_ai_report',{...args,p_request:requestId});if(reserved.error)return dbFailure(reserved.error,'reservation');
  if(reserved.data.outcome!=='reserved'){await audit.finish('reused',reserved.data.outcome==='already_saved'?'Solicitud repetida; se reutilizó el reporte.':'No hay respuestas nuevas; sin llamada a OpenAI.');return respond({...reserved.data,report:await reportBranding(db,reserved.data.report,p.restaurant),configured:true});}
  await audit.event('reserved',{metadata:{report_id:requestId,range_start:p.start,range_end:p.end,version:p.version,employee_filter:!!p.employee,rating_filter:p.rating||null}},'info',undefined,'Reserva administrativa creada; sin consumo de cuota.');
  if(audit.degraded){await db.rpc('finish_restaurant_ai_report',{p_request:requestId,p_failed:true});return respond({error:'El registro de actividad no está disponible. No se inició la llamada a OpenAI.',code:'audit_unavailable'},503);}
  let generated:Awaited<ReturnType<typeof generateRestaurantReport>>;
  try{generated=await generateRestaurantReport(reserved.data.snapshot as ReportSnapshot,reserved.data.previous_output as ReportNarrative|null,reserved.data.prompt,async(stage,update)=>{
   await audit.observe(stage,update);
   if(stage==='provider_started'&&audit.degraded)throw new Error('audit_unavailable_before_provider');
  });}
  catch(error){
   const diagnostic=diagnoseAIError(error);await audit.failure(diagnostic);
   const released=await db.rpc('finish_restaurant_ai_report',{p_request:requestId,p_failed:true});
   await audit.event('quota_release',{metadata:{released:!released.error}},released.error?'error':'info',released.error?'quota_release_failed':undefined,released.error?'No se pudo confirmar la liberación de cuota.':'Intento liberado de la cuota semanal.');
   if(released.error)return respond({error:`${diagnostic.message} No pudimos confirmar la liberación del intento. Vuelve a cargar antes de reintentar.`,code:diagnostic.code},503);
   return respond({error:`${diagnostic.message} Esta ejecución administrativa no consume cuota del restaurante. Revisa Actividad IA para ver el detalle.`,code:diagnostic.code},diagnostic.code==='report_too_large'?413:502);
  }
  await audit.event('persistence_started',{},'info',undefined,'Guardando el reporte validado.');
  let saved=await db.rpc('finish_restaurant_ai_report',{p_request:requestId,p_output:generated.output,p_usage:generated.usage});
  if(saved.error){await audit.event('persistence_retry',{},'warning','save_retry','Reintentando el guardado idempotente; sin otra llamada a OpenAI.');saved=await db.rpc('finish_restaurant_ai_report',{p_request:requestId,p_output:generated.output,p_usage:generated.usage});}
  if(saved.error){await audit.failure({code:'report_save_failed',message:'La IA terminó, pero no pudimos confirmar el guardado.',stage:'persistence',retryable:false,metadata:{database_code:saved.error.code}});return respond({error:'La IA terminó, pero no pudimos confirmar el guardado. Vuelve a cargar antes de generar otro reporte.',code:'report_save_failed'},503);}
  await audit.finish('succeeded','Reporte generado y guardado.',{input_tokens:generated.usage.input_tokens,output_tokens:generated.usage.output_tokens,estimated_usd:generated.usage.estimated_usd});
  const state=await db.rpc('restaurant_ai_report_state',args);if(state.error){await audit.event('state_refresh_failed',{},'warning','state_refresh_failed','El reporte está guardado, pero falló la actualización de estado.');return respond({error:'El reporte se guardó. Vuelve a cargar para consultarlo.',code:'state_refresh_failed'},503);}
  return respond({...state.data,report:await reportBranding(db,state.data.report,p.restaurant),configured:true,outcome:'saved'});
 }catch(error){const diagnostic=diagnoseAIError(error);await audit.failure({...diagnostic,stage:'route'});return respond({error:'Ocurrió un error inesperado. Consulta Actividad IA antes de reintentar.',code:diagnostic.code},500);}
}
export async function GET(request:Request){return execute(Object.fromEntries(new URL(request.url).searchParams),false);}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Solicitud no válida.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Formato no válido.'},{status:415,headers});
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'Solicitud vacía.'},{status:400,headers});
 const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return Response.json({error:'Solicitud demasiado grande.'},{status:413,headers});}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return await execute(JSON.parse(new TextDecoder().decode(bytes)),true);}catch{return Response.json({error:'No pudimos procesar la solicitud. Vuelve a cargar antes de reintentar.'},{status:500,headers});}
}
