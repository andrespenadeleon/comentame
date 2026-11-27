import 'server-only';
import { APICallError,NoObjectGeneratedError } from 'ai';
import type { LanguageModelUsage } from 'ai';
import type { createClient } from '@/lib/supabase/server';
type DB=Awaited<ReturnType<typeof createClient>>;
export type AIDiagnostic={code:string;message:string;stage:string;retryable:boolean;provider_status?:number;provider_request_id?:string;provider_response_id?:string;input_tokens?:number;output_tokens?:number;cached_tokens?:number;reasoning_tokens?:number;estimated_usd?:number;metadata?:Record<string,unknown>};
export type AIObservation=(stage:string,update?:Record<string,unknown>)=>Promise<void>;
const safeId=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_.:/-]{1,150}$/.test(value)?value:undefined;
export function usageMetrics(usage:LanguageModelUsage|undefined){
 if(!usage)return {};
 const input=usage.inputTokens,output=usage.outputTokens,cached=usage.inputTokenDetails?.cacheReadTokens??0;
 return {input_tokens:input,output_tokens:output,cached_tokens:cached,reasoning_tokens:usage.outputTokenDetails?.reasoningTokens,
 estimated_usd:input!==undefined&&output!==undefined?(Math.max(0,input-cached)*.1+cached*.01+output*.5)/1000000:undefined};
}
export class ReportAIError extends Error{constructor(public diagnostic:AIDiagnostic){super(diagnostic.message);this.name='ReportAIError';}}
export function diagnoseAIError(error:unknown):AIDiagnostic{
 if(error instanceof ReportAIError)return error.diagnostic;
 if(NoObjectGeneratedError.isInstance(error)){
  return {code:error.finishReason==='length'?'output_token_limit':'structured_output_invalid',message:error.finishReason==='length'?'OpenAI alcanzó el límite de tokens antes de completar el reporte.':'La respuesta de OpenAI no cumplió con la estructura requerida.',stage:'output_validation',retryable:error.finishReason==='length',...usageMetrics(error.usage),provider_request_id:safeId(error.response?.headers?.['x-request-id']),provider_response_id:safeId(error.response?.id),metadata:{finish_reason:error.finishReason,cause_type:safeId(error.cause instanceof Error?error.cause.name:undefined)}};
 }
 if(APICallError.isInstance(error)){
  let detail:Record<string,unknown>={};try{const parsed=JSON.parse(error.responseBody||'{}');if(parsed?.error&&typeof parsed.error==='object')detail=parsed.error;}catch{/* Never persist a raw provider response. */}
  const providerCode=safeId(detail.code),status=error.statusCode;let code=providerCode||'provider_error',message='OpenAI rechazó o no pudo completar la solicitud.';
  if(status===401){code='provider_authentication';message='OpenAI no aceptó la API key. Revisa la clave y el proyecto configurados en el servidor.';}
  else if(status===404||providerCode==='model_not_found'){code='model_unavailable';message='El modelo gpt-6-luna no está disponible para este proyecto de OpenAI. Revisa el acceso al modelo.';}
  else if(status===429){const billing=['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(providerCode||'');code=billing?'provider_billing_limit':'provider_rate_limit';message=billing?'OpenAI bloqueó la solicitud por créditos o límites de facturación. Revisa el saldo y los límites del proyecto.':'Se alcanzó el límite de solicitudes de OpenAI. Espera antes de reintentar.';}
  else if(status===400){code=providerCode||'provider_invalid_request';message='OpenAI rechazó un parámetro o la estructura de la solicitud. Consulta el diagnóstico en Actividad IA.';}
  else if(status===403){code='provider_access_denied';message='OpenAI denegó el acceso. Revisa los permisos del proyecto y de la API key.';}
  else if(status&&status>=500){code='provider_unavailable';message='OpenAI no pudo atender la solicitud por un error temporal del servicio.';}
  return {code,message,stage:'provider',retryable:error.isRetryable&&code!=='provider_billing_limit',provider_status:status,provider_request_id:safeId(error.responseHeaders?.['x-request-id']),metadata:{provider_code:providerCode,provider_type:safeId(detail.type),provider_parameter:safeId(detail.param)}};
 }
 if(error instanceof Error&&error.cause&&error.cause!==error&&APICallError.isInstance(error.cause))return diagnoseAIError(error.cause);
 if(error instanceof Error&&error.message==='audit_unavailable_before_provider')return {code:'audit_unavailable',message:'No se pudo registrar el inicio de la llamada a OpenAI. La generación se detuvo antes de enviarla.',stage:'logging',retryable:false};
 const name=error instanceof Error?error.name:'';
 if(/Abort|Timeout/i.test(name))return {code:'provider_timeout',message:'La generación superó el tiempo de espera. Revisa el estado antes de iniciar otro intento.',stage:'provider',retryable:true};
 if(error instanceof Error&&error.message==='report_too_large')return {code:'report_too_large',message:'El periodo contiene demasiados datos. Selecciona uno más corto.',stage:'input_validation',retryable:false};
 if(error instanceof Error&&error.message==='report_prompt_missing')return {code:'report_prompt_missing',message:'No hay un prompt activo. Aplica la migración de publicación y prompts.',stage:'configuration',retryable:false};
 if(error instanceof Error&&error.message==='ai_not_configured')return {code:'ai_not_configured',message:'Falta configurar OPENAI_API_KEY en el servidor.',stage:'configuration',retryable:false};
 return {code:'unexpected_ai_error',message:'Ocurrió un error inesperado en el procesamiento de IA. Consulta Actividad IA con el identificador del intento.',stage:'unknown',retryable:false,metadata:{error_type:safeId(name)}};
}
export function createAIAudit(db:DB,id:string){
 const started=Date.now();let degraded=false;
 // The console fallback is deliberately metadata-only; no secrets, prompts, or raw errors.
 async function write(stage:string,update:Record<string,unknown>={},severity='info',code?:string,message?:string,start?:Record<string,unknown>){
  try{const {error}=await db.rpc('log_ai_operation',{p_id:id,p_start:start||null,p_event:{stage,severity,code,message,metadata:update.metadata||{}},p_update:{...update,metadata:{...(typeof update.metadata==='object'&&update.metadata?update.metadata:{}),...(degraded?{audit_degraded:true}:{})},...(update.status?{duration_ms:Math.min(2147483647,Date.now()-started)}:{})}});if(error)throw new Error('audit_write_failed');}
  catch{degraded=true;console.error(JSON.stringify({event:'ai_monitor_storage_unavailable',operation_id:id,stage,code,status:update.status||'running',input_tokens:update.input_tokens,output_tokens:update.output_tokens,estimated_usd:update.estimated_usd,provider_status:update.provider_status,provider_request_id:update.provider_request_id,provider_response_id:update.provider_response_id}));}
 }
 return {id,get degraded(){return degraded;},start:(data:Record<string,unknown>)=>write('received',{},'info',undefined,'Intento de reporte recibido.',data),event:write,observe:((stage,update)=>write(stage,update))as AIObservation,
 failure:async(d:AIDiagnostic,status='failed')=>write(d.stage,{...d,error_code:d.code,status,metadata:{...d.metadata,error_stage:d.stage,retryable:d.retryable}},'error',d.code,d.message),
 finish:async(status:string,message:string,update:Record<string,unknown>={})=>write('finished',{...update,status,message},status==='blocked'?'warning':'info',undefined,message)};
}
