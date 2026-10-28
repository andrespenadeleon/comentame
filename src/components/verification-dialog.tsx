'use client';
import { useEffect,useRef } from 'react';
import Link from 'next/link';
import { MailCheck,X } from 'lucide-react';
import { Button } from './ui/button';
export function VerificationDialog({email,onClose}:{email?:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  return <dialog ref={dialog} className="verification-dialog" aria-labelledby="verify-title" aria-describedby="verify-description" onCancel={onClose} onClose={onClose}><button className="icon-action dialog-close" type="button" aria-label="Cerrar aviso" onClick={onClose}><X size={20}/></button><div className="verify-icon"><MailCheck size={36} aria-hidden="true"/></div><span className="eyebrow">UN PASO MÁS</span><h2 id="verify-title">Revisa tu correo.</h2><p id="verify-description">Te enviamos un enlace de verificación{email?<> a <strong>{email}</strong></>:null}. Ábrelo para confirmar tu cuenta y empezar a configurar tu restaurante.</p><p className="muted">Revisa también tu carpeta de spam. Si ya tenías una cuenta, puedes iniciar sesión o recuperar tu contraseña.</p><Button asChild><Link href="/login">Ir a iniciar sesión →</Link></Button><Link className="text-link" href="/login?confirmar=1">Reenviar correo de verificación</Link></dialog>;
}
