import ExcelJS from 'exceljs';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { LeadData } from '@/lib/leads';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
export async function GET(request:Request){
 const restaurant=z.uuid().safeParse(new URL(request.url).searchParams.get('restaurant'));
 if(!restaurant.success)return Response.json({error:'Selecciona un restaurante válido.'},{status:400,headers});
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user?.email_confirmed_at)return Response.json({error:'Tu sesión expiró. Vuelve a iniciar sesión.'},{status:401,headers});
 try{
  async function page(number:number){
   const {data,error}=await db.rpc('restaurant_leads',{p_restaurant_id:restaurant.data,p_page:number,p_detail:null});
   if(error)throw error;
   return data as LeadData;
  }
  const first=await page(1),rows=[...first.rows];
  // Reuse the same authorized lead query, including voluntary Google click status.
  const pages=Math.ceil(first.total/20);
  for(let start=2;start<=pages;start+=4){
   if(request.signal.aborted)throw new Error('aborted');
   const batch=await Promise.all(Array.from({length:Math.min(4,pages-start+1)},(_,index)=>page(start+index)));
   for(const result of batch)rows.push(...result.rows);
  }
  const workbook=new ExcelJS.Workbook();workbook.creator='comenta.me';
  const sheet=workbook.addWorksheet('Leads',{views:[{state:'frozen',ySplit:1}]});
  sheet.columns=[{header:'Nombre',key:'name',width:30},{header:'Contacto',key:'contact',width:36},{header:'Fecha de encuesta (Monterrey)',key:'date',width:30},{header:'Mesero',key:'employee',width:30},{header:'Clic en Google',key:'google',width:28}];
  const date=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Monterrey'});
  const seen=new Set<string>();
  for(const row of rows){if(seen.has(row.id))continue;seen.add(row.id);sheet.addRow({name:row.guest_name,contact:row.guest_contact,date:date.format(new Date(row.submitted_at)),employee:row.employee_name,google:row.google_clicked?'Sí':row.google_legacy?'Histórico sin confirmar':'Sin clic registrado'});}
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2463EB'}};sheet.getRow(1).height=26;
  sheet.autoFilter={from:'A1',to:'E1'};
  // Contacts remain literal strings, preserving phone prefixes and leading zeroes.
  sheet.getColumn('contact').numFmt='@';
  const buffer=await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="leads-${restaurant.data}.xlsx"`}});
 }catch(error){const code=(error as {code?:string}).code;return Response.json({error:code==='42501'?'No tienes acceso a este restaurante.':'No pudimos exportar los leads. Inténtalo de nuevo.'},{status:code==='42501'?403:500,headers});}
}
