import Link from 'next/link';
import { signOut } from '@/app/actions/auth';
import { SignOutButton } from './signout-button';
export function AppHeader({name}:{name?:string}) {return <header className="app-header"><Link href="/" className="wordmark">comenta.me</Link><div className="header-right"><span className="account-name">{name||'Tu espacio de restaurante'}</span><form action={signOut}><SignOutButton/></form></div></header>;}
