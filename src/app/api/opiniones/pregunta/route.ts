import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
const schema=z.object({version:z.uuid(),field:z.string().min(1).max(100),restaurant:z.uuid(),employee:z.uuid().optional(),rating:z.coerce.number().int().min(1).max(5).optional(),period:z.enum(['7','30','90','all']).default('30'),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function GET(request:Request){
 const parsed=schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!parsed.success)return Response.json({error:'Los filtros de esta pregunta no son válidos.'},{status:400,headers});
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user||!user.email_confirmed_at)return Response.json({error:'Tu sesión expiró. Vuelve a iniciar sesión.'},{status:401,headers});
 const params=parsed.data;
 const {data,error}=await db.rpc('question_responses',{p_version_id:params.version,p_field:params.field,p_restaurant_id:params.restaurant,p_employee_id:params.employee||null,p_rating:params.rating||null,p_from:params.period==='all'?null:new Date(Date.now()-Number(params.period)*86400000).toISOString(),p_page:params.page});
 if(error){const missing=['PGRST202','42883'].includes(error.code),forbidden=error.code==='42501';return Response.json({error:missing?'Las respuestas por pregunta estarán disponibles al actualizar la plataforma.':forbidden?'No tienes acceso a esta encuesta.':'No pudimos cargar las respuestas. Inténtalo de nuevo.'},{status:forbidden?403:503,headers});}
 return Response.json(data,{headers});
}
