import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { metricOptions } from '@/lib/metric-options';
const schema=z.object({scope:z.union([z.uuid(),z.literal('all')]),hidden:z.array(z.string().refine(id=>metricOptions.some(item=>item.id===id))).max(metricOptions.length)}).strict();
export async function PUT(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 if(new URL(request.url).origin!==request.headers.get('origin'))return Response.json({error:'Solicitud no válida.'},{status:403,headers});
 const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:'Preferencias no válidas.'},{status:400,headers});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return Response.json({error:'Vuelve a iniciar sesión.'},{status:401,headers});
 if(parsed.data.scope!=='all'){const {data,error}=await db.rpc('can_edit_survey',{p_restaurant_id:parsed.data.scope});if(error||!data)return Response.json({error:'No tienes acceso a este restaurante.'},{status:403,headers});}
 const {error}=await db.from('metric_preferences').upsert({user_id:user.id,scope:parsed.data.scope,hidden:[...new Set(parsed.data.hidden)],updated_at:new Date().toISOString()},{onConflict:'user_id,scope'});
 if(error)return Response.json({error:['42P01','PGRST205'].includes(error.code)?'Actualiza Supabase para guardar tus preferencias.':'No pudimos guardar tus preferencias.'},{status:503,headers});
 return Response.json({ok:true},{headers});
}
