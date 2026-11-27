import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {ReportContent} from '@/components/report-view';
export const dynamic='force-dynamic';
export const metadata={title:'Reporte | comenta.me',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function SharedReport({params}:{params:Promise<{token:string}>}){const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))notFound();const db=await createClient();const {data,error}=await db.rpc('shared_ai_report',{p_token:token});if(error||!data)notFound();return <main id="main" className="shared-report"><header className="actions"><strong>comenta.me</strong><a className="button button-outline button-sm" href={`/api/reports/shared/${token}/pdf`}>Descargar PDF</a></header><ReportContent report={data}/></main>;}
