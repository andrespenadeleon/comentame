import {z} from 'zod';
import {reportAdmin,reportHeaders as headers} from '@/lib/report-access';
import {reportBranding} from '@/lib/report-branding';
import {publicReport} from '@/lib/report-public';
import {reportPDF} from '@/lib/report-pdf';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const db=await reportAdmin();if(!db)return new Response('Acceso restringido.',{status:403,headers});const {id}=await params;if(!z.uuid().safeParse(id).success)return new Response('Reporte no válido.',{status:400,headers});const {data,error}=await db.rpc('admin_ai_report_document',{p_id:id});if(error||!data)return new Response('Reporte no disponible.',{status:404,headers});try{return new Response(await reportPDF(publicReport((await reportBranding(db,data.report,data.report.restaurant_id))!,data.privacy_values)),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="reporte-comentame.pdf"'}});}catch{return new Response('No pudimos generar el PDF.',{status:503,headers});}}
