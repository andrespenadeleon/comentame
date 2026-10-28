import { AuthForm } from '@/components/auth-form';
export const metadata={title:'Iniciar sesión'};
export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const p=await searchParams;
 const notices:Record<string,string>={confirm:'Confirma tu correo antes de continuar.',updated:'Tu contraseña se actualizó. Inicia sesión con tu nueva contraseña.',link:'El enlace venció, ya fue utilizado o se abrió en otro navegador. Solicita uno nuevo.'};
 return <AuthForm mode={p.confirmar?'resend':'login'} notice={p.notice?notices[p.notice]:undefined}/>;
}
