import { z } from 'zod';
export const DEFAULT_CONTACT={required:false,mode:'either' as const};
export const contactSettingsSchema=z.object({required:z.boolean(),mode:z.enum(['either','email','phone'])}).strict();
export type ContactSettings=z.infer<typeof contactSettingsSchema>;
export function normalizeContact(value:unknown):ContactSettings{const result=contactSettingsSchema.safeParse(value);return result.success?result.data:{...DEFAULT_CONTACT};}
export function contactLabel(value:ContactSettings){return value.mode==='email'?'Correo electrónico':value.mode==='phone'?'Teléfono':'Correo o teléfono';}
export function validateContact(value:string,settings:ContactSettings):string|null{const input=value.trim();if(!input)return settings.required?`Agrega tu ${settings.mode==='email'?'correo electrónico':settings.mode==='phone'?'teléfono':'correo o teléfono'}.`:null;const email=z.email().safeParse(input).success,phone=/^[+\d()\s.-]+$/.test(input)&&input.replace(/\D/g,'').length>=10&&input.replace(/\D/g,'').length<=15;if(input.length>254||!(settings.mode==='email'?email:settings.mode==='phone'?phone:email||phone))return settings.mode==='email'?'Escribe un correo electrónico válido.':settings.mode==='phone'?'Escribe un teléfono válido (de 10 a 15 dígitos).':'Escribe un correo o teléfono válido.';return null;}
