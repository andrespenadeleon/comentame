import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
const schema=z.object({restaurant:z.union([z.uuid(),z.literal('all')]),version:z.union([z.uuid(),z.literal('all')]).default('all'),employee:z.uuid().optional(),rating:z.coerce.number().int().min(1).max(5).optional(),period:z.enum(['7','30','90','all']).default('30')}).strict();
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function GET(request:Request){
 const parsed=schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!parsed.success)return Response.json({error:'Los filtros no son válidos.'},{status:400,headers});
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user?.email_confirmed_at)return Response.json({error:'Tu sesión expiró. Vuelve a iniciar sesión.'},{status:401,headers});
 const p=parsed.data;const {data,error}=await db.rpc('question_answer_analytics',{p_restaurant_id:p.restaurant==='all'?null:p.restaurant,p_version_id:p.version==='all'?null:p.version,p_employee_id:p.employee||null,p_rating:p.rating||null,p_from:p.period==='all'?null:new Date(Date.now()-Number(p.period)*86400000).toISOString()});
 if(error)return Response.json({error:['PGRST202','42883'].includes(error.code)?'Actualiza las métricas de preguntas en Supabase para ver las respuestas.':'No pudimos cargar las preguntas.'},{status:error.code==='42501'?403:503,headers});return Response.json({...data,scope:new URLSearchParams(Object.entries(p).map(([key,value])=>[key,String(value)] )).toString()},{headers});
}
