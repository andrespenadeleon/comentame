'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, signupSchema } from '@/lib/validation';
import { messageFor } from '@/lib/errors';
export type AuthState = {error?:string;success?:string;email?:string};
const base = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/,'');
export async function authenticate(mode:'login'|'signup'|'recover'|'reset'|'resend', _previous:AuthState, form:FormData):Promise<AuthState> {
  const db = await createClient();
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  if(mode==='login' || mode==='signup') {
    const result=(mode==='signup'?signupSchema:loginSchema).safeParse({email,password});
    if(!result.success) return {error:result.error.issues[0].message,email};
    if(mode==='signup') {
      const {error}=await db.auth.signUp({email,password,options:{emailRedirectTo:`${base()}/auth/callback`}});
      if(error) return {error:messageFor(error),email};
      return {success:'Revisa tu correo y confirma tu cuenta para continuar. Si ya tenías una cuenta, puedes iniciar sesión o recuperar tu contraseña.',email};
    }
    const {error}=await db.auth.signInWithPassword({email,password});
    if(error) return {error:messageFor(error),email};
    revalidatePath('/','layout');
    redirect('/dashboard');
  }
  if(mode==='recover' || mode==='resend') {
    if(!loginSchema.shape.email.safeParse(email).success) return {error:'Escribe un correo válido.',email};
    const {error} = mode==='recover' ? await db.auth.resetPasswordForEmail(email,{redirectTo:`${base()}/auth/callback?next=/restablecer`}) : await db.auth.resend({type:'signup',email,options:{emailRedirectTo:`${base()}/auth/callback`}});
    if(error) return {error:messageFor(error),email};
    return {success:'Si el correo corresponde a una cuenta, recibirás un enlace. Revisa también tu carpeta de spam.',email};
  }
  if(!signupSchema.shape.password.safeParse(password).success) return {error:'Usa una contraseña de entre 8 y 128 caracteres.'};
  const {data:{user}}=await db.auth.getUser();
  if(!user) return {error:'Tu sesión venció. Solicita un nuevo enlace de recuperación.'};
  const {error}=await db.auth.updateUser({password});
  if(error) return {error:messageFor(error)};
  // End the current recovery session; the next visit requires the new password.
  await db.auth.signOut();
  revalidatePath('/','layout');
  redirect('/login?notice=updated');
}
export async function signOut() {
  const db=await createClient();
  const {error}=await db.auth.signOut();
  if(error) throw new Error('No pudimos cerrar la sesión. Inténtalo nuevamente.');
  revalidatePath('/','layout');
  redirect('/login');
}
