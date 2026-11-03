'use client';
import { useEffect,useRef } from 'react';
export function SurveyVisit({restaurantId,employeeId,versionId}:{restaurantId:string;employeeId:string;versionId:string}) {
 const visit=useRef<string|null>(null);
 useEffect(()=>{
  // One event per actual mount; retries/Strict Mode reuse the same UUID.
  visit.current??=crypto.randomUUID();
  void fetch('/api/encuesta/visita',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visit_id:visit.current,restaurant_id:restaurantId,employee_id:employeeId,survey_version_id:versionId}),keepalive:true}).catch(()=>{});
 },[restaurantId,employeeId,versionId]);
 return null;
}
