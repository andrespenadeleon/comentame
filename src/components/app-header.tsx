import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import { Button } from './ui/button';
export function AppHeader({name}:{name?:string}) {return <header className="app-header"><Link href="/" className="wordmark">comenta.me</Link><div className="header-right"><span className="account-name">{name||'Tu espacio de restaurante'}</span><form action={signOut}><Button size="sm" variant="outline" type="submit">Cerrar sesión</Button></form></div></header>;}
