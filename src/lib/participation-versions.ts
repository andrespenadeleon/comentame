import 'server-only';
import type { createClient } from './supabase/server';
export type ParticipationVersion={id:string;restaurant_id:string;restaurant_name:string;version:number;title:string;published_at:string};
export async function participationVersions(db:Awaited<ReturnType<typeof createClient>>,restaurant:string|null):Promise<ParticipationVersion[]|null>{
 const {data,error}=await db.rpc('participation_versions',{p_restaurant_id:restaurant});
 if(error){if(['PGRST202','42883'].includes(error.code))return null;throw new Error('No pudimos cargar las versiones de la encuesta.');}
 return data as ParticipationVersion[];
}
