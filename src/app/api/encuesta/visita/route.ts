import { z } from 'zod';
import { trackingSchema } from '@/lib/survey-tracking';
import { publicClient } from '@/lib/supabase/public';
const schema=trackingSchema.extend({restaurant_id:z.uuid(),employee_id:z.uuid(),survey_version_id:z.uuid()}).strict();
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 try {
  if(!request.headers.get('content-type')?.includes('application/json'))return new Response(null,{status:415,headers});
  const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400,headers});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return new Response(null,{status:413,headers});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const parsed=schema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
  if(!parsed.success)return new Response(null,{status:400,headers});
  const input=parsed.data;
  let result=await publicClient().rpc('update_survey_engagement',{p_visit_id:input.visit_id,p_restaurant_id:input.restaurant_id,p_employee_id:input.employee_id,p_version_id:input.survey_version_id,p_active_ms:input.active_ms,p_sequence:input.sequence,p_touched:input.touched,p_answered:input.answered});
  if(result.error&&['PGRST202','42883'].includes(result.error.code))result=await publicClient().rpc('record_survey_visit',{p_visit_id:input.visit_id,p_restaurant_id:input.restaurant_id,p_employee_id:input.employee_id,p_version_id:input.survey_version_id});
  return new Response(null,{status:result.error?503:204,headers});
 }catch{return new Response(null,{status:400,headers});}
}
