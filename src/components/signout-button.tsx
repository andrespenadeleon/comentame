'use client';
import { useFormStatus } from 'react-dom';
import { LogOut } from 'lucide-react';
import { Button } from './ui/button';
export function SignOutButton({sidebar=false}:{sidebar?:boolean}) {
 const {pending}=useFormStatus();
 return <><Button className={sidebar?'signout-button':undefined} size={sidebar?'default':'sm'} variant={sidebar?'ghost':'outline'} type="submit" disabled={pending} aria-busy={pending}>{pending?<span className="loading-spinner button-spinner" aria-hidden="true"/>:sidebar?<LogOut size={17} aria-hidden="true"/>:null}{pending?'Cerrando sesión…':'Cerrar sesión'}</Button>{pending&&<div className="session-loading" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true"/><p>Cerrando sesión…</p></div>}</>;
}
