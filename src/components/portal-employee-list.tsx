'use client';
import { useState } from 'react';
import { PortalEmployeeRow } from './portal-employee-row';
import type { PortalEmployee } from '@/lib/portal-admin';
export function PortalEmployeeList({employees}:{employees:(PortalEmployee&{surveyUrl:string|null})[]}){
 const [expanded,setExpanded]=useState<string|null>(null);
 return <div className="compact-employee-list">{employees.map(employee=><PortalEmployeeRow key={employee.id} employee={employee} surveyUrl={employee.surveyUrl} expanded={expanded===employee.id} onToggle={()=>setExpanded(value=>value===employee.id?null:employee.id)}/>)}</div>;
}
