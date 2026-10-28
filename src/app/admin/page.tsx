import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Link2,Search,ShieldCheck,Users } from 'lucide-react';
import { portalDirectory,portalHref,type DirectoryParams } from '@/lib/portal-admin';
import { surveyPath } from '@/lib/validation';
import { AppHeader } from '@/components/app-header';
import { PortalEmployeeRow } from '@/components/portal-employee-row';
export const dynamic='force-dynamic';
export const metadata={title:'Portal de administración',robots:{index:false,follow:false}};
export default async function AdminPage({searchParams}:{searchParams:Promise<DirectoryParams>}){
 const {user,filters,directory}=await portalDirectory(await searchParams);
 const pages=Math.max(1,Math.ceil(directory.total/directory.page_size));
 if(filters.page>pages)redirect(portalHref(filters,pages));
 const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://comentame.vercel.app');
 if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('Configura un dominio válido para los enlaces de encuesta.');
 return <><AppHeader name={user.email}/><main id="main" className="portal-main"><div className="portal-wrap">
  <header className="portal-page-heading"><span className="portal-admin-label"><ShieldCheck size={15} aria-hidden="true"/>PORTAL ADMIN</span><h1>Tu equipo, en todos los restaurantes.</h1><p>Encuentra a cada empleado y copia el enlace de su encuesta para asignarlo a una tarjeta NFC.</p></header>
  <section className="card portal-directory" aria-labelledby="directory-heading"><header className="card-head"><div className="portal-directory-title"><Users size={21} aria-hidden="true"/><h2 id="directory-heading">Empleados</h2></div><span className="pill">{directory.total} {directory.total===1?'empleado':'empleados'}</span></header>
   <form action="/admin" className="portal-filters"><label className="field portal-search" htmlFor="portal-search">Buscar empleado o restaurante<div><Search size={16} aria-hidden="true"/><input className="input" id="portal-search" name="q" type="search" maxLength={150} defaultValue={filters.query} placeholder="Nombre, restaurante o puesto"/></div></label><label className="field" htmlFor="portal-restaurant">Restaurante<select className="input" id="portal-restaurant" name="restaurant" defaultValue={filters.restaurant}><option value="">Todos los restaurantes</option>{directory.restaurants.map(restaurant=><option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label><label className="field" htmlFor="portal-status">Empleados<select className="input" id="portal-status" name="status" defaultValue={filters.status}><option value="active">Activos</option><option value="all">Todos</option><option value="archived">Archivados</option></select></label><button type="submit" className="button">Buscar</button><Link className="text-link" href="/admin">Limpiar</Link></form>
   <p className="portal-link-help"><Link2 size={16} aria-hidden="true"/>Puedes preparar las tarjetas antes de publicar. El enlace recibirá respuestas cuando la encuesta esté publicada; los enlaces de empleados archivados están desactivados.</p>
   {directory.employees.length?<div className="portal-employee-list">{directory.employees.map(employee=><PortalEmployeeRow key={employee.id} employee={employee} surveyUrl={employee.deleted_at?null:new URL(surveyPath(employee.restaurant_id,employee.id),origin.origin).toString()}/>)}</div>:<div className="empty portal-directory-empty"><div className="empty-icon"><Users size={24} aria-hidden="true"/></div><h3>No hay empleados para mostrar.</h3><p>{filters.query||filters.restaurant||filters.status!=='active'?'Prueba con otro nombre, restaurante o estado.':'Los empleados aparecerán aquí cuando los restaurantes registren a su equipo.'}</p>{(filters.query||filters.restaurant||filters.status!=='active')&&<Link className="text-link" href="/admin">Limpiar filtros →</Link>}</div>}
   {pages>1&&<nav className="pagination actions" aria-label="Páginas del directorio">{filters.page>1&&<Link className="button button-outline button-sm" href={portalHref(filters,filters.page-1)}>← Anterior</Link>}<span>Página {filters.page} de {pages} · {directory.total} empleados</span>{filters.page<pages&&<Link className="button button-outline button-sm" href={portalHref(filters,filters.page+1)}>Siguiente →</Link>}</nav>}
  </section><p className="footer-note">comenta.me · Administración del portal</p>
 </div></main></>;
}
