import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAIAudit } from '@/lib/ai/observability';
export async function PUT(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Solicitud no válida.'},{status:403,headers});
 const input=z.object({monthly:z.number().positive().max(1000000).nullable()}).strict().safeParse(await request.json().catch(()=>null));if(!input.success)return Response.json({error:'Ingresa un umbral válido o déjalo vacío.'},{status:400,headers});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return Response.json({error:'Vuelve a iniciar sesión.'},{status:401,headers});
 const {data:admin}=await db.rpc('is_portal_admin');if(admin!==true)return Response.json({error:'Solo portal admin.'},{status:403,headers});
 const audit=createAIAudit(db,crypto.randomUUID());await audit.start({environment:process.env.VERCEL_ENV==='production'?'production':process.env.VERCEL_ENV==='preview'?'preview':'development',model:'gpt-6-luna',metadata:{kind:'monitor_settings'}});
 const {error}=await db.rpc('set_ai_monitor_alert',{p_monthly_usd:input.data.monthly});
 if(error){await audit.failure({code:'settings_save_failed',message:'No se pudo guardar el umbral mensual.',stage:'monitor_settings',retryable:false});return Response.json({error:'No pudimos guardar el umbral.'},{status:503,headers});}
 await audit.event('monitor_settings',{metadata:{monthly_alert_usd:input.data.monthly}},'info',undefined,'Umbral mensual actualizado.');await audit.finish('reused','Configuración de alertas actualizada.');
 return Response.json({ok:true},{headers});
}
