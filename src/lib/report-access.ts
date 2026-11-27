import 'server-only';
import {createClient} from './supabase/server';
export async function reportAdmin(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)return null;const {data}=await db.rpc('is_portal_admin');return data===true?db:null;}
export const reportHeaders={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
