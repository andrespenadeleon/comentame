import Link from 'next/link';
import { z } from 'zod';
import { publicClient } from '@/lib/supabase/public';
import { CustomerSurvey } from '@/components/customer-survey';
import type { PublicSurvey } from '@/lib/survey-types';
export const dynamic='force-dynamic';
export const metadata={title:'Comparte tu experiencia',robots:{index:false,follow:false}};
export default async function PublicSurveyPage({params}:{params:Promise<{restaurant:string;employee:string}>}){
 const {restaurant,employee}=await params;
 let survey:PublicSurvey|null=null;let failed=false;
 if(z.uuid().safeParse(restaurant).success&&z.uuid().safeParse(employee).success){
  try{const {data,error}=await publicClient().rpc('get_public_survey',{p_restaurant_id:restaurant,p_employee_id:employee});failed=!!error;survey=error?null:data as PublicSurvey|null;}catch{failed=true;}
 }
 return <main id="main" className="public-survey-page">{survey?<CustomerSurvey context={survey} branding={{name:survey.restaurant_name,logo_path:survey.logo_path,social_links:survey.social_links,google_maps_url:survey.google_maps_url}} title={survey.title} questions={survey.questions} theme={survey.theme}/>:<section className="survey-unavailable stack"><Link className="wordmark" href="/">comenta.me</Link><h1>{failed?'No pudimos abrir la encuesta.':'Esta encuesta aún no está disponible.'}</h1><p className="muted">{failed?'Inténtalo nuevamente en unos momentos.':'Consulta con el restaurante para recibir un enlace activo. No se ha enviado ninguna opinión.'}</p>{failed&&<a className="button button-outline" href={`/encuesta/${restaurant}/${employee}`}>Volver a intentar</a>}</section>}</main>;
}
