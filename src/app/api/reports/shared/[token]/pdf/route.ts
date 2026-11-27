import {createClient} from '@/lib/supabase/server';
import {reportPDF} from '@/lib/report-pdf';
import {reportHeaders as headers} from '@/lib/report-access';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))return new Response('No encontrado.',{status:404,headers});const db=await createClient();const {data,error}=await db.rpc('shared_ai_report',{p_token:token});if(error||!data)return new Response('Reporte no disponible.',{status:404,headers});try{return new Response(await reportPDF(data),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="reporte-comentame.pdf"'}});}catch{return new Response('No pudimos generar el PDF.',{status:503,headers});}}
