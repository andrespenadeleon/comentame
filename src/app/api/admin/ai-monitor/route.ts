import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function GET(request:Request){
 const id=z.uuid().safeParse(new URL(request.url).searchParams.get('id'));if(!id.success)return Response.json({error:'Identificador no válido.'},{status:400,headers});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return Response.json({error:'Vuelve a iniciar sesión.'},{status:401,headers});
 const {data:admin}=await db.rpc('is_portal_admin');if(admin!==true)return Response.json({error:'Solo portal admin.'},{status:403,headers});
 const {data,error}=await db.rpc('portal_ai_operation_detail',{p_id:id.data});if(error)return Response.json({error:'No pudimos cargar los eventos. Revisa la migración de monitoreo.'},{status:503,headers});
 if(!data)return Response.json({error:'Operación no encontrada.'},{status:404,headers});return Response.json(data,{headers});
}
