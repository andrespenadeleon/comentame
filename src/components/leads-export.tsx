'use client';
import { useState } from 'react';
import { Download,LoaderCircle } from 'lucide-react';
export function LeadsExport({restaurantId,disabled=false}:{restaurantId:string;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){
  setBusy(true);setError('');
  try{
   const response=await fetch(`/api/leads/export?${new URLSearchParams({restaurant:restaurantId})}`,{cache:'no-store'});
   if(!response.ok){const body=await response.json();throw new Error(body.error||'No pudimos descargar el archivo.');}
   const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
   link.href=url;link.download=`leads-${restaurantId}.xlsx`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setError(error instanceof Error?error.message:'No pudimos descargar el archivo.');}finally{setBusy(false);}
 }
 return <div className="leads-export"><button type="button" className="button button-outline button-sm" disabled={disabled||busy} aria-busy={busy} onClick={download}>{busy?<LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>:<Download size={16} aria-hidden="true"/>}{busy?'Preparando Excel…':'Descargar Excel'}</button>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
