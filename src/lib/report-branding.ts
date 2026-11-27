import 'server-only';
import type {createClient} from './supabase/server';
import type {RestaurantReport} from './restaurant-report-types';
export async function reportBranding(db:Awaited<ReturnType<typeof createClient>>,report:RestaurantReport|null,restaurant:string){
 if(!report)return report;
 // The portal RPC enforces admin access; owner-only restaurant RLS does not grant portal-wide reads.
 const {data}=await db.rpc('portal_restaurants');
 const branding=(data as {id:string;logo_path:string|null}[]|null)?.find(row=>row.id===restaurant);
 return {...report,snapshot:{...report.snapshot,logo_path:branding?.logo_path||report.snapshot.logo_path||null}};
}
