import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { LoadingIndicator } from '@/components/loading-indicator';
import { AppHeader } from '@/components/app-header';
import { Opinions,OpinionMetrics,OpinionList } from '@/components/opinions';
import { PortalEmployeeList } from '@/components/portal-employee-list';
import { PortalSurveyList } from '@/components/portal-survey-list';
import { portalWorkspace,portalOpinions,portalSurveys,descriptiveSurveyUrl } from '@/lib/portal-dashboard';
import { portalDirectory,portalHref } from '@/lib/portal-admin';
import type { OpinionParams } from '@/lib/opinions';
export const dynamic='force-dynamic';
export const metadata={title:'Portal de administración',robots:{index:false,follow:false}};
type Params=OpinionParams&{q?:string;status?:string};
const sections=['resumen','opiniones','restaurante','equipo','encuesta','soporte'];
export default async function AdminPage({searchParams}:{searchParams:Promise<Params>}){
 const [space,params,jar]=await Promise.all([portalWorkspace(),searchParams,cookies()]);
 if(space.setup)return <><AppHeader name={space.user.email}/><main id="main" className="portal-main"><section className="card stack"><h1>Actualización del portal pendiente</h1><p>Aplica la migración 202611030003_portal_readonly_dashboard.sql en Supabase para habilitar la navegación del portal.</p></section></main></>;
 const selected=params.restaurant||jar.get('cm_portal_restaurant')?.value||'all';
 const active=space.restaurants.find(restaurant=>restaurant.id===selected);
 const restaurant=active?.id||'all';
 const section=sections.includes(params.section||'')?params.section!:params.q||params.status?'equipo':'resumen';
 const headings:Record<string,string>={resumen:'Resumen del portal',opiniones:'Opiniones y métricas',restaurante:'Restaurantes',equipo:'Tu equipo, más claro.',encuesta:'Encuestas de tus restaurantes',soporte:'Soporte'};
 const options=[{id:'all',name:'Todos los restaurantes'},...space.restaurants];
 return <DashboardShell portal name={space.user.email||'Portal admin'} restaurants={options} restaurantName={active?.name||'Todos los restaurantes'} restaurantId={restaurant} restaurantCount={space.restaurants.length} section={section}><div className="page-head"><span className="eyebrow">PORTAL ADMIN / {active?.name||'Todos los restaurantes'}</span><h1>{headings[section]}</h1><p className="muted">Consulta los datos de tus restaurantes. Acceso de solo lectura.</p></div><Suspense key={JSON.stringify({...params,restaurant,section})} fallback={<LoadingIndicator dashboard/>}><PortalContent section={section} params={{...params,restaurant,portal:'1'}} restaurants={space.restaurants}/></Suspense></DashboardShell>;
}
async function PortalContent({section,params,restaurants}:{section:string;params:Params;restaurants:Awaited<ReturnType<typeof portalWorkspace>>['restaurants']}){
 const restaurant=params.restaurant||'all';
 if(section==='opiniones'||section==='resumen'){
 const data=await portalOpinions(section==='resumen'?{...params,rating:undefined,employee:undefined,detail:undefined,page:'1'}:params);
 if(section==='opiniones')return <Opinions data={data} params={params} restaurants={restaurants} activeRestaurantId={restaurant}/>;
 return <><form action="/admin" className="summary-period actions"><input type="hidden" name="section" value="resumen"/><input type="hidden" name="restaurant" value={restaurant}/><label className="field">Periodo<select className="input" name="period" defaultValue={data.period}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="all">Desde el inicio</option></select></label><button className="button button-outline">Actualizar</button></form><OpinionMetrics data={data} overview showGoogleClicks/><section className="card stack"><div className="card-head"><h2>Opiniones recientes</h2><Link className="text-link" href={`/admin?section=opiniones&restaurant=${restaurant}&period=${data.period}`}>Ver métricas →</Link></div><OpinionList data={data} compact params={params}/></section></>;
 }
 if(section==='equipo'){
 const {directory,filters,engagement}=await portalDirectory({q:params.q,restaurant,status:params.status,page:params.page});
 const pages=Math.max(1,Math.ceil(directory.total/directory.page_size));if(filters.page>pages)redirect(portalHref(filters,pages));
 const metrics=new Map(engagement?.employees.map(employee=>[employee.employee_id,employee])||[]);
 const origin=process.env.NEXT_PUBLIC_SITE_URL||'https://comentame.vercel.app';
 const rows=directory.employees.map(employee=>({...employee,engagement:metrics.get(employee.id),surveyUrl:employee.deleted_at?null:descriptiveSurveyUrl(origin,employee.restaurant_id,employee.id,employee.restaurant_name,`${employee.first_name} ${employee.last_name}`)}));
 return <section className="card stack"><form action="/admin" className="portal-filters"><input type="hidden" name="section" value="equipo"/><input type="hidden" name="restaurant" value={restaurant}/><label className="field">Buscar empleado<input name="q" className="input" type="search" defaultValue={filters.query} maxLength={150} placeholder="Nombre, restaurante o puesto"/></label><label className="field">Estado<select className="input" name="status" defaultValue={filters.status}><option value="active">Activos</option><option value="archived">Archivados</option><option value="all">Todos</option></select></label><button className="button">Buscar</button><Link className="text-link" href={`/admin?section=equipo&restaurant=${restaurant}`}>Limpiar</Link></form><div className="card-head"><h2>Equipo</h2><span className="pill">{directory.total} empleados</span></div><PortalEmployeeList key={`${restaurant}:${filters.query}:${filters.status}:${filters.page}`} employees={rows}/>{!rows.length&&<p className="empty muted">No hay empleados para estos filtros.</p>}{pages>1&&<nav className="pagination actions" aria-label="Páginas de empleados">{filters.page>1&&<Link className="button button-outline" href={portalHref(filters,filters.page-1)}>← Anterior</Link>}<span>Página {filters.page} de {pages}</span>{filters.page<pages&&<Link className="button button-outline" href={portalHref(filters,filters.page+1)}>Siguiente →</Link>}</nav>}</section>;
 }
 if(section==='restaurante')return <div className="stack">{restaurants.filter(item=>restaurant==='all'||item.id===restaurant).map(item=><section className="card stack" key={item.id}><h2>{item.name}</h2><dl className="opinion-metadata"><dt>Dirección</dt><dd>{item.address}</dd><dt>Teléfono</dt><dd>{item.phone}</dd><dt>Encuesta</dt><dd>{item.active_survey_id?'Publicada':'Sin publicar'}</dd></dl>{item.google_maps_url&&<a className="text-link" href={item.google_maps_url} target="_blank" rel="noopener noreferrer">Ver en Google Maps ↗</a>}</section>)}{!restaurants.length&&<p className="empty muted">Aún no hay restaurantes.</p>}</div>;
 if(section==='encuesta'){
 const page=Math.min(100000,Math.max(1,Number.parseInt(params.page||'1',10)||1));const catalog=await portalSurveys(restaurant,page);const pages=Math.max(1,Math.ceil(catalog.total/20));if(page>pages)redirect(`/admin?section=encuesta&restaurant=${restaurant}&page=${pages}`);
 return <div className="stack"><section className="card stack"><h2>Borradores</h2><PortalSurveyList surveys={catalog.drafts} draft/></section><section className="card stack"><h2>Publicadas e historial</h2><PortalSurveyList surveys={catalog.published}/>{pages>1&&<nav className="pagination actions" aria-label="Páginas de encuestas">{page>1&&<Link className="button button-outline" href={`/admin?section=encuesta&restaurant=${restaurant}&page=${page-1}`}>← Anterior</Link>}<span>Página {page} de {pages}</span>{page<pages&&<Link className="button button-outline" href={`/admin?section=encuesta&restaurant=${restaurant}&page=${page+1}`}>Siguiente →</Link>}</nav>}</section></div>;
 }
 return <section className="card empty"><span className="pill">Próximamente</span><h2>Soporte</h2><p className="muted">El chat de soporte sigue pendiente de definición.</p></section>;
}
