import { z } from 'zod';
import { publicClient } from '@/lib/supabase/public';
const schema=z.object({click_id:z.uuid(),visit_id:z.uuid()}).strict();
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 try{
  if(!request.headers.get('content-type')?.includes('application/json'))return new Response(null,{status:415,headers});
  const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400,headers});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();return new Response(null,{status:413,headers});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const parsed=schema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));if(!parsed.success)return new Response(null,{status:400,headers});
  const {error}=await publicClient().rpc('record_google_review_click',{p_click_id:parsed.data.click_id,p_visit_id:parsed.data.visit_id});
  return new Response(null,{status:error?503:204,headers});
 }catch{return new Response(null,{status:400,headers});}
}
