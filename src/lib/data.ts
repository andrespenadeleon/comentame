import 'server-only';
import type { SocialLinks } from './survey-types';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
export const requireUser = cache(async () => {
  const db = await createClient();
  const {data:{user},error} = await db.auth.getUser();
  if(error || !user) redirect('/login');
  if(!user.email_confirmed_at) redirect('/login?notice=confirm');
  return {db,user};
});
export type Profile = {id:string;full_name:string;phone:string;onboarding_completed:boolean};
export type Restaurant = {id:string;owner_id:string;name:string;address:string;phone:string;google_maps_url?:string|null;logo_path?:string|null;social_links?:SocialLinks;active_survey_id?:string|null};
export type Employee = {id:string;restaurant_id:string;first_name:string;last_name:string;role:string;photo_path:string|null;photo_url?:string|null;restaurant_name?:string;deleted_at?:string|null};
export const workspace = cache(async () => {
  const {db,user} = await requireUser();
  const [p,r] = await Promise.all([
    db.from('profiles').select('id,full_name,phone,onboarding_completed').eq('id',user.id).maybeSingle(),
    db.from('restaurants').select('*').eq('owner_id',user.id).order('created_at'),
  ]);
  if(p.error || r.error) throw new Error('WORKSPACE_SETUP_PENDING');
  return {db,user,profile:p.data as Profile|null,restaurants:(r.data || []).map(({id,owner_id,name,address,phone,google_maps_url,logo_path,social_links,active_survey_id})=>({id,owner_id,name,address,phone,google_maps_url,logo_path,social_links,active_survey_id})) as Restaurant[]};
});
