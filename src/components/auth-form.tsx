'use client';
import { useActionState,useState } from 'react';
import Link from 'next/link';
import { authenticate, type AuthState } from '@/app/actions/auth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { VerificationDialog } from './verification-dialog';
const copy = {
  login:{title:'Qué bueno verte.',description:'Inicia sesión para seguir escuchando a tus clientes.',button:'Iniciar sesión'},
  signup:{title:'Tu próxima gran mejora empieza aquí.',description:'Crea tu cuenta y prepara el espacio de tu restaurante.',button:'Crear mi cuenta'},
  recover:{title:'Recupera tu acceso.',description:'Te enviaremos un enlace para crear una nueva contraseña.',button:'Enviar enlace'},
  reset:{title:'Una nueva contraseña.',description:'Elige una contraseña segura para tu cuenta.',button:'Guardar contraseña'},
  resend:{title:'Confirma tu correo.',description:'Te enviaremos un nuevo enlace de confirmación.',button:'Reenviar confirmación'},
};
export function AuthForm({mode,notice}:{mode:keyof typeof copy;notice?:string}) {
  const [state,action,pending]=useActionState<AuthState,FormData>(authenticate.bind(null,mode),{});
  const [dismissed,setDismissed]=useState<AuthState|null>(null);
  const c=copy[mode];
  return <section className="auth-card"><span className="eyebrow">TU RESTAURANTE, MÁS CERCA DE SUS CLIENTES</span><h1>{c.title}</h1><p className="muted">{c.description}</p>{mode==='signup'&&state.success&&dismissed!==state&&<VerificationDialog email={state.email} onClose={()=>setDismissed(state)}/>}<form action={action}>
    {notice && <p className="alert" role="status">{notice}</p>}
    {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
    {state.success && <p className="alert" role="status">{state.success}</p>}
    {mode!=='reset' && <label className="field" htmlFor="email">Correo electrónico<Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={state.email} placeholder="tu@restaurante.com" /></label>}
    {(mode==='login'||mode==='signup'||mode==='reset') && <label className="field" htmlFor="password">Contraseña<Input id="password" name="password" type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:8} maxLength={128} required placeholder={mode==='login'?'Tu contraseña':'Al menos 8 caracteres'}/></label>}
    {mode==='login' && <Link href="/recuperar" className="text-link">Olvidé mi contraseña</Link>}
    <Button type="submit" disabled={pending} aria-busy={pending}>{pending?'Un momento…':c.button}<span aria-hidden="true">↗</span></Button>
  </form>
  <div className="auth-bottom">{mode==='login'?<>¿Aún no tienes cuenta? <Link className="text-link" href="/registro">Regístrate</Link></>:mode==='signup'?<>¿Ya tienes cuenta? <Link className="text-link" href="/login">Inicia sesión</Link></>:<Link className="text-link" href="/login">Volver a iniciar sesión</Link>}</div>
  {mode==='login' && <p className="auth-bottom"><Link className="text-link" href="/login?confirmar=1">Reenviar confirmación de correo</Link></p>}
  {mode==='signup' && <p className="auth-privacy">Sin tarjeta de crédito. <Link className="text-link" href="/privacidad">Aviso de privacidad</Link></p>}
  </section>;
}
