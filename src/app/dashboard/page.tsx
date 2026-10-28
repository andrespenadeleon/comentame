import Link from 'next/link';
import { redirect,notFound } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import { workspace } from '@/lib/data';
import { restaurantData,teamData } from '@/lib/restaurant-data';
import { opinionsData,type OpinionParams } from '@/lib/opinions';
import { Opinions,OpinionMetrics,OpinionList } from '@/components/opinions';
import { DashboardShell } from '@/components/dashboard-shell';
import { Employees } from '@/components/employees';
import { SurveyEditor } from '@/components/survey-editor';
import { ProfileForm,RestaurantForm } from '@/components/details-forms';
import { AddRestaurant } from '@/components/add-restaurant';
export const metadata={title:'Tu dashboard',robots:{index:false,follow:false}};
const sections=['resumen','opiniones','restaurante','equipo','encuesta','soporte'];
export default async function Dashboard({searchParams}:{searchParams:Promise<OpinionParams>}) {
 const {db,profile,restaurants,user}=await workspace();
 if(!profile?.onboarding_completed||!restaurants.length)redirect('/onboarding');
 const params=await searchParams;
 const section=sections.includes(params.section||'')?params.section!:'resumen';
 const restaurant=params.restaurant&&params.restaurant!=='all'?restaurants.find(r=>r.id===params.restaurant):restaurants[0];
 if(!restaurant)notFound();
 const data=['resumen','encuesta'].includes(section)?await restaurantData(db,restaurant.id):null;
 const employees=section==='equipo'?await teamData(db,restaurants):data?.employees||[];
 const opinions=['resumen','opiniones'].includes(section)?await opinionsData(db,restaurants.map(r=>r.id),section==='resumen'?{...params,restaurant:restaurant.id,rating:undefined,employee:undefined,page:'1',detail:undefined}:params):null;
 const href=(s:string,id=restaurant.id)=>`/dashboard?section=${s}&restaurant=${id}`;
 const headings:Record<string,string>={resumen:`Hola, ${profile.full_name.split(' ')[0]}.`,opiniones:'Cada opinión cuenta.',restaurante:'Tu restaurante, a tu manera.',equipo:'Las personas detrás de cada experiencia.',encuesta:'Haz las preguntas que importan.',soporte:'Estamos para escucharte.'};
 const descriptions:Record<string,string>={resumen:'Conoce cómo viven tus comensales cada visita.',opiniones:'Explora las respuestas y encuentra oportunidades para mejorar.',restaurante:'Mantén al día los datos, el logo y las redes de tu negocio.',equipo:'Administra a tu equipo y encuentra a cada empleado por restaurante.',encuesta:'Diseña, previsualiza y publica una encuesta sencilla.',soporte:'Un espacio para comunicarte con el equipo de comenta.me.'};
 return <DashboardShell name={profile.full_name} restaurantName={restaurant.name} restaurantId={restaurant.id} restaurantCount={restaurants.length} section={section} surveyNeedsSetup={!restaurant.active_survey_id}><div className="page-head"><div><span className="eyebrow">{['equipo','opiniones'].includes(section)&&restaurants.length>1?'Tus restaurantes':restaurant.name}</span><h1>{headings[section]}</h1><p className="muted">{descriptions[section]}</p></div></div>
 {restaurants.length>1&&['restaurante','encuesta','resumen'].includes(section)&&<nav className="subnav actions" aria-label="Cambiar restaurante">{restaurants.map(r=><Link key={r.id} className={r.id===restaurant.id?'button button-sm':'button button-sm button-outline'} href={href(section,r.id)} aria-current={r.id===restaurant.id?'true':undefined}>{r.name}</Link>)}</nav>}
 {section==='resumen'&&opinions&&<><form action="/dashboard" className="summary-period actions"><input type="hidden" name="section" value="resumen"/><input type="hidden" name="restaurant" value={restaurant.id}/><label className="field">Periodo<select className="input" name="period" defaultValue={opinions.period}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="all">Desde el inicio</option></select></label><button type="submit" className="button button-outline">Actualizar</button></form><OpinionMetrics data={opinions}/><section className="card stack"><div className="card-head"><h2>Opiniones recientes</h2><Link className="text-link" href={`${href('opiniones')}&period=${opinions.period}`}>Ver todas →</Link></div><OpinionList compact knownSurvey={data?.published} data={opinions} params={{restaurant:restaurant.id,period:opinions.period}}/></section>{!data?.published&&<section className="publish-alert"><h3>Tu próxima conversación empieza aquí.</h3><p>Publica tu encuesta para comenzar a recibir opiniones. El equipo de comenta.me se encargará de los enlaces de las tarjetas NFC.</p><Link className="text-link" href={href('encuesta')}>Preparar mi encuesta →</Link></section>}</>}
 {section==='opiniones'&&opinions&&<Opinions data={opinions} params={params} restaurants={restaurants}/>}
 {section==='equipo'&&<section className="card"><Employees restaurantId={restaurant.id} employees={employees} restaurants={restaurants}/></section>}
 {section==='encuesta'&&data&&<section className="card"><SurveyEditor key={restaurant.id} restaurantId={restaurant.id} initial={data.draft} published={data.published} branding={restaurant}/></section>}
 {section==='restaurante'&&<div className="dashboard-grid"><div className="stack"><section className="card stack"><h2>Datos del restaurante</h2><RestaurantForm key={restaurant.id} id={restaurant.id} initial={restaurant}/></section><section className="card stack"><h2>Más restaurantes</h2><AddRestaurant/></section></div><section className="card stack" style={{alignSelf:'start'}}><h2>Tu cuenta de administrador</h2><p className="muted">{user.email}</p><ProfileForm initial={profile}/></section></div>}
 {section==='soporte'&&<section className="card empty support-empty"><div className="empty-icon"><LifeBuoy size={26}/></div><span className="pill">Próximamente</span><h2>Un canal directo contigo.</h2><p>Próximamente podrás comunicarte con el equipo de comenta.me desde aquí.</p></section>}
 <p className="footer-note">comenta.me · <Link href="/privacidad">Aviso de privacidad</Link></p></DashboardShell>;
}
