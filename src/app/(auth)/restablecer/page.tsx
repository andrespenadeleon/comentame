import { AuthForm } from '@/components/auth-form';
import { requireUser } from '@/lib/data';
export const metadata={title:'Nueva contraseña'};
export default async function Reset() {await requireUser(); return <AuthForm mode="reset"/>;}
