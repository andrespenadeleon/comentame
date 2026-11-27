import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {reportAdmin,reportHeaders as headers} from '@/lib/report-access';
import {reportBranding} from '@/lib/report-branding';
import {publicReport} from '@/lib/report-public';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Solicitud no válida.'},{status:403,headers});
 const db=await reportAdmin();if(!db)return Response.json({error:'Acceso restringido.'},{status:403,headers});
 const {id}=await params;if(!z.uuid().safeParse(id).success)return Response.json({error:'Reporte no válido.'},{status:400,headers});
 const parsed=z.object({action:z.enum(['visibility','share','revoke']),value:z.boolean().optional()}).strict().safeParse(await readJSON(request,4096));if(!parsed.success)return Response.json({error:'Solicitud no válida.'},{status:400,headers});
 const {action,value}=parsed.data;let payload=null;
 if(action==='share'){const doc=await db.rpc('admin_ai_report_document',{p_id:id});if(doc.error||!doc.data)return Response.json({error:'No pudimos preparar el reporte.'},{status:503,headers});payload=publicReport((await reportBranding(db,doc.data.report,doc.data.report.restaurant_id))!,doc.data.privacy_values);}
 const result=await db.rpc('manage_ai_report',{p_id:id,p_action:action,p_value:value??null,p_token:action==='share'?randomBytes(32).toString('hex'):null,p_payload:payload});
 if(result.error)return Response.json({error:'No pudimos guardar el cambio. Revisa la migración de reportes.'},{status:503,headers});
 return Response.json({...result.data,url:result.data.shared_token?`${new URL(request.url).origin}/reporte/${result.data.shared_token}`:null},{headers});
}

async function readJSON(request:Request,limit:number){const reader=request.body?.getReader();if(!reader)return null;const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return null;}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}}
