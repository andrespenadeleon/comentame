import Link from 'next/link';
import { CalendarDays,Eye,MessageSquare,Star } from 'lucide-react';
import { overviewData } from '@/lib/overview';
import type { createClient } from '@/lib/supabase/server';
import { EmployeePerformancePanels } from './employee-performance-panels';
export async function RestaurantOverview({db,restaurant,period}:{db:Awaited<ReturnType<typeof createClient>>;restaurant:{id:string;active_survey_id?:string|null};period?:string}){
 const data=await overviewData(db,restaurant.id,period);
 const periodLabel=data.period==='all'?'Desde el inicio':`Últimos ${data.period} días`;
 const number=(value:number|null|undefined)=>value==null?'—':value.toLocaleString('es-MX');
 return <div className="restaurant-overview"><section className="overview-kpis without-google" aria-label={`Indicadores del restaurante: ${periodLabel}`}><OverviewKpi label="Visitas a la encuesta" value={number(data.visits)} icon={<Eye size={16}/>} note={periodLabel}/><OverviewKpi label="Opiniones recibidas" value={number(data.summary.total)} icon={<MessageSquare size={16}/>} note={periodLabel}/><OverviewKpi label="Calificación promedio" value={data.summary.average==null?'—':Number(data.summary.average).toFixed(1)} icon={<Star size={16}/>} note="De 5 estrellas"/></section><p className="overview-period-note">Indicadores y desempeño del equipo · {periodLabel.toLowerCase()}</p><EmployeePerformancePanels employees={data.performance} restaurantId={restaurant.id} period={data.period}/>{!restaurant.active_survey_id&&<section className="publish-alert"><h3>Tu próxima conversación empieza aquí.</h3><p>Publica tu encuesta para comenzar a recibir opiniones. El equipo de comenta.me se encargará de los enlaces de las tarjetas NFC.</p><Link className="text-link" href={`/dashboard?section=encuesta&restaurant=${restaurant.id}`}>Preparar mi encuesta →</Link></section>}</div>;
}
function OverviewKpi({label,value,icon,note}:{label:string;value:string;icon:React.ReactNode;note:string}){
 return <article className="overview-kpi"><div><span>{label}</span><span className="overview-kpi-icon" aria-hidden="true">{icon}</span></div><strong>{value}</strong><small>{note}</small></article>;
}

export function OverviewPeriodToolbar({restaurantId,period}:{restaurantId:string;period?:string}){
 const selectedPeriod=['7','30','90','all'].includes(period||'')?period:'30';
 return <form action="/dashboard" className="overview-toolbar"><input type="hidden" name="section" value="resumen"/><input type="hidden" name="restaurant" value={restaurantId}/><label className="overview-period"><CalendarDays size={16} aria-hidden="true"/><span className="sr-only">Periodo del resumen</span><select name="period" defaultValue={selectedPeriod}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="all">Desde el inicio</option></select></label><button className="button button-outline button-sm" type="submit">Actualizar</button></form>;
}
