import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { LoadingIndicator } from '@/components/loading-indicator';
import { isPortalAdmin } from '@/lib/portal-admin';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import { workspace } from '@/lib/data';
import { restaurantData,teamData } from '@/lib/restaurant-data';
import { opinionsData,type OpinionParams } from '@/lib/opinions';
import { Opinions } from '@/components/opinions';
import { RestaurantOverview,OverviewPeriodToolbar } from '@/components/restaurant-overview';
import { DashboardShell } from '@/components/dashboard-shell';
import { Employees } from '@/components/employees';
import { SurveyEditor } from '@/components/survey-editor';
import { ProfileForm,RestaurantForm } from '@/components/details-forms';
import { AddRestaurant } from '@/components/add-restaurant';
export const metadata={title:'Tu dashboard',robots:{index:false,follow:false}};
const sections=['resumen','opiniones','restaurante','equipo','encuesta','soporte'];
export default async function Dashboard({searchParams}:{searchParams:Promise<OpinionParams>}) {
 const [admin,space]=await Promise.all([isPortalAdmin(),workspace()]);
 if(admin)redirect('/admin');
 const {profile,restaurants}=space;
 if(!profile?.onboarding_completed||!restaurants.length)redirect('/onboarding');
 const params=await searchParams;
 const section=sections.includes(params.section||'')?params.section!:'resumen';
 const questionParticipation=section==='opiniones'&&params.view==='questions';
 const stored=(await cookies()).get('cm_restaurant')?.value;
 const restaurant=restaurants.find(r=>r.id===params.restaurant)||restaurants.find(r=>r.id===stored)||restaurants[0];
 const effectiveParams={...params,portal:undefined,restaurant:params.scope==='all'||params.restaurant==='all'?'all':restaurant.id};
 const headings:Record<string,string>={resumen:'Resumen de tu restaurante',opiniones:'Opiniones y métricas',restaurante:'Tu restaurante, a tu manera.',equipo:'Las personas detrás de cada experiencia.',encuesta:'Haz las preguntas que importan.',soporte:'Estamos para escucharte.'};
 const descriptions:Record<string,string>={resumen:'Conoce cómo viven tus comensales cada visita.',opiniones:'Explora las respuestas y encuentra oportunidades de mejora.',restaurante:'Mantén al día los datos, el logo y las redes de tu negocio.',equipo:'Administra a tu equipo y encuentra a cada empleado por restaurante.',encuesta:'Diseña, previsualiza y publica una encuesta sencilla.',soporte:'Un espacio para comunicarte con el equipo de comenta.me.'};
 return <DashboardShell name={profile.full_name} restaurantName={restaurant.name} restaurantId={restaurant.id} restaurantCount={restaurants.length} restaurants={restaurants.map(({id,name,logo_path})=>({id,name,logo_path}))} section={section} surveyNeedsSetup={!restaurant.active_survey_id}><div className={section==='resumen'?'page-head overview-page-head':'page-head'}>{section==='resumen'?<><h1 className="overview-heading">Resumen de tu restaurante <span aria-hidden="true">— </span><span className="overview-restaurant">{restaurant.name}</span></h1><OverviewPeriodToolbar restaurantId={restaurant.id} period={params.period}/></>:<div><span className="eyebrow">{section==='opiniones'&&effectiveParams.restaurant==='all'?'Todos mis restaurantes':restaurant.name}</span><h1>{questionParticipation?'Participación por pregunta':headings[section]}</h1><p className="muted">{questionParticipation?'Descubre cómo interactúan tus clientes con cada pregunta de tu encuesta.':descriptions[section]}</p></div>}</div>

 <Suspense key={`${section}:${restaurant.id}:${JSON.stringify(params)}`} fallback={<LoadingIndicator dashboard/>}><DashboardContent space={space} restaurant={restaurant} section={section} params={effectiveParams}/></Suspense>
 <p className="footer-note">comenta.me · <Link href="/privacidad">Aviso de privacidad</Link></p></DashboardShell>;
}

async function DashboardContent({space,restaurant,section,params}:{space:Awaited<ReturnType<typeof workspace>>;restaurant:Awaited<ReturnType<typeof workspace>>['restaurants'][number];section:string;params:OpinionParams}) {
 const {db,restaurants,user,profile}=space;
 if(section==='resumen')return <RestaurantOverview db={db} restaurant={restaurant} period={params.period}/>;
 const [data,employees,opinions]=await Promise.all([
  section==='encuesta'?restaurantData(db,restaurant.id,false):null,
  section==='equipo'?teamData(db,[restaurant]):[],
  section==='opiniones'?opinionsData(db,restaurants.map(r=>r.id),params):null,
 ]);
 return <>
 {section==='opiniones'&&opinions&&<Opinions data={opinions} params={params} restaurants={restaurants} activeRestaurantId={restaurant.id}/>}
 {section==='equipo'&&<section className="card"><Employees key={restaurant.id} restaurantId={restaurant.id} employees={employees} restaurants={[restaurant]}/></section>}
 {section==='encuesta'&&data&&<section className="card"><SurveyEditor key={restaurant.id} restaurantId={restaurant.id} initial={data.draft} published={data.published} branding={restaurant}/></section>}
 {section==='restaurante'&&<div className="dashboard-grid"><div className="stack"><section className="card stack"><h2>Datos del restaurante</h2><RestaurantForm key={restaurant.id} id={restaurant.id} initial={restaurant}/></section><section className="card stack"><h2>Más restaurantes</h2><AddRestaurant/></section></div><section className="card stack" style={{alignSelf:'start'}}><h2>Tu cuenta de administrador</h2><p className="muted">{user.email}</p><ProfileForm initial={profile!}/></section></div>}
 {section==='soporte'&&<section className="card empty support-empty"><div className="empty-icon"><LifeBuoy size={26}/></div><span className="pill">Próximamente</span><h2>Un canal directo contigo.</h2><p>Próximamente podrás comunicarte con el equipo de comenta.me desde aquí.</p></section>}</>;
}
