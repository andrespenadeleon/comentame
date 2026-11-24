import { createClient } from '@/lib/supabase/server';
import { MetricPreferences } from './metric-preferences';
export async function MetricPreferencesServer({scope,admin,children}:{scope:string;admin:boolean;children:React.ReactNode}){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 const result=user?await db.from('metric_preferences').select('hidden').eq('user_id',user.id).eq('scope',scope).maybeSingle():null;
 return <MetricPreferences key={`${user?.id}:${scope}`} scope={scope} admin={admin} initial={result?.data?.hidden||[]}>{children}</MetricPreferences>;
}
