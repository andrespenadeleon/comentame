import { isPortalAdmin } from '@/lib/portal-admin';
import { redirect } from 'next/navigation';
import { workspace } from '@/lib/data';
import { restaurantData } from '@/lib/restaurant-data';
import { AppHeader } from '@/components/app-header';
import { Onboarding } from '@/components/onboarding';
export const metadata={title:'Configura tu restaurante',robots:{index:false,follow:false}};
export default async function Page() {
 if(await isPortalAdmin())redirect('/admin');
  const {db,profile,restaurants}=await workspace();
  if(profile?.onboarding_completed&&restaurants.length)redirect('/dashboard');
  const restaurant=restaurants[0]||null;
  const data=restaurant?await restaurantData(db,restaurant.id):{employees:[],draft:null};
  return <><AppHeader name={profile?.full_name}/><Onboarding profile={profile} restaurant={restaurant} {...data}/></>;
}
