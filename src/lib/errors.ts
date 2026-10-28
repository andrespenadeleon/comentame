export function messageFor(error: { code?: string; message?: string } | null): string {
  const messages: Record<string,string> = {
    invalid_credentials:'El correo o la contraseña no son correctos.', email_not_confirmed:'Confirma tu correo antes de iniciar sesión.',
    weak_password:'Usa una contraseña más segura, de al menos 8 caracteres.', user_already_exists:'Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.',
    over_email_send_rate_limit:'Espera unos minutos antes de solicitar otro correo.', over_request_rate_limit:'Demasiados intentos. Espera unos minutos.',
    same_password:'Elige una contraseña diferente de la anterior.', otp_expired:'El enlace venció o ya fue utilizado. Solicita uno nuevo.',
    PGRST204:'La configuración de datos está pendiente. Contacta al equipo de comenta.me.',
    PGRST205:'La configuración de datos está pendiente. Contacta al equipo de comenta.me.', PGRST202:'La configuración de datos está pendiente. Contacta al equipo de comenta.me.',
  };
  if (error?.code && messages[error.code]) return messages[error.code];
  if (error?.message?.includes('restaurant_limit')) return 'Tu cuenta tiene un restaurante autorizado. Contacta a comenta.me para solicitar otro.';
  return 'No pudimos completar la operación. Revisa tu conexión e inténtalo nuevamente.';
}
