import { NextResponse } from 'next/server';
import { publicClient } from '@/lib/supabase/public';
import { submissionSchema,validateAnswers } from '@/lib/validation';
import type { PublicSurvey } from '@/lib/survey-types';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const response=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 try{
  if(!request.headers.get('content-type')?.includes('application/json'))return response({error:'Formato no válido.'},415);
  if(!request.body)return response({error:'El envío está vacío.'},400);
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();return response({error:'El envío es demasiado grande.'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body:unknown;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return response({error:'No pudimos leer el envío.'},400);}
  const parsed=submissionSchema.safeParse(body);
  if(!parsed.success)return response({error:parsed.error.issues[0].message},400);
  const input=parsed.data;const db=publicClient();
  // The database validates against the original published version as well.
  const {data:current,error:readError}=await db.rpc('get_public_survey',{p_restaurant_id:input.restaurant_id,p_employee_id:input.employee_id});
  if(readError)return response({error:'No pudimos conectarnos. Inténtalo nuevamente.'},503);
  if(!current)return response({error:'Esta encuesta ya no está disponible.'},410);
  if((current as PublicSurvey).survey_version_id===input.survey_version_id){const validation=validateAnswers((current as PublicSurvey).questions,input.answers);if(validation.error)return response({error:validation.error},400);input.answers=validation.answers!;}
  const {data,error}=await db.rpc('submit_survey',{p_submission_id:input.submission_id,p_restaurant_id:input.restaurant_id,p_employee_id:input.employee_id,p_version_id:input.survey_version_id,p_name:input.guest_name,p_contact:input.guest_contact,p_rating:input.rating,p_answers:input.answers});
  if(error){const message=error.message;
   if(message.includes('submission_conflict'))return response({error:'Ese envío ya se recibió. Recarga la página si deseas dejar otra opinión.'},409);
   if(message.includes('survey_unavailable'))return response({error:'Esta encuesta ya no está disponible.'},410);
   if(message.includes('answer_required')||message.includes('invalid_answer'))return response({error:'Revisa que las preguntas obligatorias estén completas y las opciones sean válidas.'},400);
   if(message.includes('invalid_contact'))return response({error:'Revisa tu correo o teléfono, o deja el contacto vacío.'},400);
   return response({error:'No pudimos guardar tu opinión. Tus respuestas siguen aquí; inténtalo nuevamente.'},503);
  }
  return response({success:true,id:data});
 }catch{return response({error:'No pudimos enviar tu opinión. Revisa tu conexión e inténtalo nuevamente.'},503);}
}
