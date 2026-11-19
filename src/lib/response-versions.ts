import 'server-only';
import type { createClient } from './supabase/server';
import type { Question } from './validation';
export type ResponseVersions=Record<string,{title:string;version:number;questions:Question[]}>;
export async function responseVersions(db:Awaited<ReturnType<typeof createClient>>,ids:string[]):Promise<ResponseVersions>{
 if(!ids.length)return {};
 const {data,error}=await db.rpc('response_question_versions',{p_response_ids:ids.slice(0,20)});
 if(error){if(['PGRST202','42883'].includes(error.code))return {};throw new Error('No pudimos cargar las preguntas de las opiniones.');}
 return data as ResponseVersions;
}
