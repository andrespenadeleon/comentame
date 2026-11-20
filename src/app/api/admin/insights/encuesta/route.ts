import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
const scope=z.object({restaurant:z.uuid(),version:z.uuid(),field:z.literal('*').default('*'),period:z.enum(['7','30','90','all']).default('30'),employee:z.uuid().optional(),rating:z.coerce.number().int().min(1).max(5).optional()}).strict();
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
async function execute(input:unknown,generate=false){
 const parsed=(generate?scope.extend({requestId:z.uuid()}):scope).safeParse(input);
 if(!parsed.success)return Response.json({error:'Los filtros del análisis no son válidos.'},{status:400,headers});
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user?.email_confirmed_at)return Response.json({error:'Tu sesión expiró. Vuelve a iniciar sesión.'},{status:401,headers});
 const {data:admin,error:adminError}=await db.rpc('is_portal_admin');
 if(adminError||admin!==true)return Response.json({error:'Este análisis está disponible solo para administradores del portal.'},{status:403,headers});
 const p=parsed.data;const args={p_restaurant_id:p.restaurant,p_version_id:p.version,p_field:p.field,p_period:p.period,p_employee_id:p.employee||null,p_rating:p.rating||null};
 const {data,error}=generate?await db.rpc('portal_generate_question_insight_mock',{...args,p_request_id:(p as z.infer<typeof scope>&{requestId:string}).requestId}):await db.rpc('portal_question_insight_state',args);
 if(error){const limited=error.message.includes('weekly_limit_reached'),missing=['PGRST202','42883'].includes(error.code),forbidden=error.code==='42501',conflict=error.message.includes('request_scope_conflict');return Response.json({error:limited?'Este restaurante ya utilizó sus 2 análisis de esta semana.':missing?'El guardado de análisis estará disponible al actualizar la plataforma.':forbidden?'No tienes acceso a este análisis.':conflict?'Este intento corresponde a otros filtros. Cierra y vuelve a abrir el análisis.':'No pudimos guardar o cargar el análisis. Inténtalo de nuevo.'},{status:limited?429:forbidden?403:conflict?409:503,headers});}
 return Response.json(data,{headers});
}
export async function GET(request:Request){return execute(Object.fromEntries(new URL(request.url).searchParams));}
export async function POST(request:Request){
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Formato no válido.'},{status:415,headers});
 try{const reader=request.body?.getReader();if(!reader)return Response.json({error:'Solicitud vacía.'},{status:400,headers});const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return Response.json({error:'Solicitud demasiado grande.'},{status:413,headers});}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return execute(JSON.parse(new TextDecoder().decode(bytes)),true);}catch{return Response.json({error:'No pudimos leer la solicitud.'},{status:400,headers});}
}
