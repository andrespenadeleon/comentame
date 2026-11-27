import 'server-only';
import {composeReportPrompt,REPORT_MAX_OUTPUT_TOKENS,REPORT_TIMEOUT_MS,REPORT_PROMPT_CONTRACT} from './report-prompt';
import { generateText,Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { usageMetrics,ReportAIError,type AIObservation } from './observability';
import type { ReportSnapshot,ReportNarrative } from '@/lib/restaurant-report-types';
// Only bounded current-snapshot indices are legal output values. Resolve UUIDs server-side.
function reportSchema(questionRefs:string[],responseRefs:string[]){
 const references=(values:string[],limit:number)=>z.array(z.number().int().min(1).max(Math.max(1,values.length))).max(values.length?limit:0);
 const evidence={question_keys:references(questionRefs,12),response_ids:references(responseRefs,100)};
 return z.object({summary:z.string().max(2500),findings:z.array(z.object({title:z.string().max(150),observation:z.string().max(1200),priority:z.enum(['high','medium','low']),...evidence})).max(6),themes:z.array(z.object({title:z.string().max(150),sentiment:z.enum(['positive','negative','mixed']),description:z.string().max(800),response_ids:responseRefs.length?references(responseRefs,100).min(1):references(responseRefs,100)})).max(responseRefs.length?6:0),actions:z.array(z.object({intent:z.enum(['change','replicate','improve','investigate']),owner:z.string().max(120),horizon:z.string().max(150),title:z.string().max(150),reason:z.string().max(700),next_step:z.string().max(700),measure:z.string().max(500),...evidence})).max(6),limitations:z.array(z.string().max(600)).max(8)});
}
// Contacts are unnecessary for analysis. Redact common contact patterns inside free text too.
const redact=(value:string)=>value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[correo omitido]').replace(/(?:\+?\d[\s().-]*){10,15}/g,'[teléfono omitido]');
export async function generateRestaurantReport(snapshot:ReportSnapshot,previous:ReportNarrative|null,promptConfig:{id:string;version:number;template:string},observe?:AIObservation){
 if(!promptConfig?.template||!promptConfig.id)throw new Error('report_prompt_missing');
 await observe?.('prompt_loaded',{metadata:{prompt_version:promptConfig.version,prompt_id:promptConfig.id,contract:REPORT_PROMPT_CONTRACT}});
 const key=process.env.OPENAI_API_KEY;if(!key)throw new Error('ai_not_configured');
 const questionRefs=new Map<string,string>(),responseRefs=new Map<string,string>(),responseAliases=new Map<string,string>();
 const questions=snapshot.questions.map((q,index)=>{
  const alias=index+1;questionRefs.set(String(alias),q.key);
  return {...q,key:alias,label:redact(q.label),comments:q.comments.map(c=>{
   let ref=responseAliases.get(c.response_id);
   if(!ref){ref=String(responseAliases.size+1);responseAliases.set(c.response_id,ref);responseRefs.set(ref,c.response_id);}
   return {response_id:Number(ref),text:redact(c.text)};
  })};
 });
 const input={...snapshot,restaurant_name:'Restaurante seleccionado',employees:snapshot.employees.map((e,index)=>({...e,id:`E${index+1}`,name:`Empleado ${index+1}`})),questions};
 // Previous prose is context only; its citations may not exist in the current snapshot.
 const previousContext=previous?{summary:previous.summary,findings:previous.findings.map(f=>({title:f.title,observation:f.observation})),actions:previous.actions.map(a=>({title:a.title,next_step:a.next_step}))}:null;
 const prompt=JSON.stringify({reference_rules:{question_keys:'Usa exclusivamente los índices enteros de current_snapshot.questions[].key. Nunca etiquetas, UUIDs ni referencias del análisis anterior.',response_ids:'Usa exclusivamente los índices enteros presentes en current_snapshot.questions[].comments[].response_id. Para hallazgos cuantitativos cita el índice de la pregunta; no inventes una respuesta individual.',no_comments:responseRefs.size===0?'No hay comentarios citables: response_ids y themes deben ser arrays vacíos.':null},current_snapshot:input,previous_analysis:previousContext});
 const schema=reportSchema([...questionRefs.keys()],[...responseRefs.keys()]);
 if(prompt.length>300000)throw new Error('report_too_large');
 await observe?.('input_prepared',{metadata:{input_characters:prompt.length,response_count:snapshot.responses,question_count:questions.length,allowed_question_references:questionRefs.size,allowed_response_references:responseRefs.size,reference_format:'snapshot_index_v1'}});
 const client=createOpenAI({apiKey:key});
 await observe?.('provider_started',{provider_started:true,metadata:{max_output_tokens:REPORT_MAX_OUTPUT_TOKENS,timeout_ms:REPORT_TIMEOUT_MS,reasoning_effort:'medium'}});
 const result=await generateText({model:client.responses('gpt-6-luna'),output:Output.object({schema}),maxOutputTokens:REPORT_MAX_OUTPUT_TOKENS,maxRetries:0,timeout:REPORT_TIMEOUT_MS,providerOptions:{openai:{store:false,reasoningEffort:'medium'}},system:composeReportPrompt(promptConfig.template),prompt});
 const metrics=usageMetrics(result.usage);
 const responseInfo={...metrics,provider_status:200,provider_request_id:result.response.headers?.['x-request-id'],provider_response_id:result.response.id};
 await observe?.('provider_completed',responseInfo);
 const generated=result.output;
 function invalidEvidence(invalidKeys=0,invalidIds=0){return new ReportAIError({code:'invalid_evidence',message:'El reporte incluyó referencias que no existen en los datos del periodo.',stage:'evidence_validation',retryable:true,metadata:{invalid_question_keys:invalidKeys,invalid_response_ids:invalidIds},...metrics,provider_status:200,provider_request_id:result.response.headers?.['x-request-id'],provider_response_id:result.response.id});}
 // Bounded integer references avoid free-form UUID errors and large enum schemas.
 function resolveQuestion(index:number){const key=questionRefs.get(String(index));if(!key)throw invalidEvidence(1,0);return key;}
 function resolveResponse(index:number){const id=responseRefs.get(String(index));if(!id)throw invalidEvidence(0,1);return id;}
 const resolveEvidence=(item:{question_keys:number[];response_ids:number[]})=>({question_keys:[...new Set(item.question_keys.map(resolveQuestion))],response_ids:[...new Set(item.response_ids.map(resolveResponse))]});
 const output:ReportNarrative={...generated,
  findings:generated.findings.map(item=>({...item,...resolveEvidence(item)})),
  actions:generated.actions.map(item=>({...item,...resolveEvidence(item)})),
  themes:generated.themes.map(theme=>({...theme,response_ids:[...new Set(theme.response_ids.map(resolveResponse))]}))
 };
 await observe?.('evidence_validated',{metadata:{findings:output.findings.length,themes:output.themes.length,actions:output.actions.length}});
 const inputTokens=result.usage.inputTokens??0,outputTokens=result.usage.outputTokens??0;
 return {output,usage:{input_tokens:inputTokens,output_tokens:outputTokens,estimated_usd:metrics.estimated_usd??(inputTokens*.1+outputTokens*.5)/1000000,pricing_as_of:'2026-11-27'}};
}
