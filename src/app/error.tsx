'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}) {return <main id="main" className="setup-error stack"><Link href="/" className="wordmark">comenta.me</Link><h1>No pudimos abrir tu espacio.</h1><p className="muted">Inténtalo nuevamente. Si es la primera configuración del proyecto, asegúrate de que la migración de Supabase esté aplicada.</p><div className="actions"><Button onClick={reset}>Reintentar</Button><Button asChild variant="outline"><Link href="/login">Volver al acceso</Link></Button></div></main>;}
