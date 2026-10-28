import { z } from 'zod';
import { surveyThemeSchema,DEFAULT_THEME } from './survey-theme';
const text = (label: string, max = 150) => z.string().trim().min(1, `${label} es obligatorio.`).max(max, `Máximo ${max} caracteres.`);
export const phoneSchema = z.string().trim().refine(value => {
  const digits = value.replace(/\D/g, '');
  return /^[+\d()\s.-]+$/.test(value) && /^(?:52)?[2-9]\d{9}$/.test(digits) && !/^(\d)\1{9}$/.test(digits.slice(-10));
}, 'Escribe un teléfono mexicano de 10 dígitos, opcionalmente con +52.').transform(value => '+52' + value.replace(/\D/g, '').slice(-10));
export const loginSchema = z.object({email: z.email('Escribe un correo válido.').max(254), password: z.string().min(1, 'Escribe tu contraseña.')});
export const signupSchema = loginSchema.extend({password: z.string().min(8, 'Usa al menos 8 caracteres.').max(128, 'Máximo 128 caracteres.')});
export const profileSchema = z.object({full_name: text('El nombre'), phone: phoneSchema});
export const googleMapsSchema = z.string().trim().max(2048, 'El enlace es demasiado largo.').refine(value => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
      (url.hostname === 'maps.app.goo.gl' && url.pathname.length>1) ||
      (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/') && url.pathname.length>6) ||
      (['google.com','www.google.com','google.com.mx','www.google.com.mx','maps.google.com','maps.google.com.mx'].includes(url.hostname) && (url.hostname.startsWith('maps.') || /^\/maps(?:\/|$)/.test(url.pathname)))
    );
  } catch { return false; }
}, 'Pega un enlace válido de Google Maps que comience con https://.').transform(value=>value?new URL(value).toString():'');
const socialHosts={instagram:['instagram.com'],facebook:['facebook.com','fb.com','fb.me'],tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be']} as const;
function socialUrl(platform:keyof typeof socialHosts){return z.string().trim().max(2048,'El enlace es demasiado largo.').refine(value=>{
 if(!value)return true;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&socialHosts[platform].some(host=>u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}
},'Agrega un enlace válido de esta red social, comenzando con https://.').transform(value=>value?new URL(value).toString():'');}
export const socialLinksSchema=z.object({instagram:socialUrl('instagram').optional(),facebook:socialUrl('facebook').optional(),tiktok:socialUrl('tiktok').optional(),youtube:socialUrl('youtube').optional()}).strict();
export const restaurantSchema = z.object({name: text('El nombre comercial'), address: text('La dirección', 500), phone: phoneSchema, google_maps_url: googleMapsSchema.optional(), social_links:socialLinksSchema.optional()});
export const employeeSchema = z.object({first_name: text('El nombre', 80), last_name: text('El apellido', 80), role: text('El puesto', 100)});
export const RATING_ID = '00000000-0000-4000-8000-000000000005';
export const RATING_PROMPT = '¿Cómo estuvo tu experiencia?';
export const questionSchema = z.object({
  id: z.uuid('La pregunta tiene un identificador inválido.'), prompt: text('La pregunta', 250), type: z.enum(['rating', 'text', 'multiple', 'single']),
  required: z.boolean(), presentation:z.enum(['short','long','scale','yes_no']).optional(),
  // Ignore blank lines left by Enter in the options textarea, including a trailing newline.
  options: z.array(z.string().trim()).transform(values => values.filter(Boolean)).pipe(z.array(z.string().max(120, 'Cada opción admite hasta 120 caracteres.')).max(10, 'Agrega un máximo de 10 opciones.')),
}).superRefine((q, ctx) => {
  if(q.presentation&&((['short','long'].includes(q.presentation)&&q.type!=='text')||(['scale','yes_no'].includes(q.presentation)&&q.type!=='single')))ctx.addIssue({code:'custom',message:'Elige un tipo de respuesta válido.'});
  if(q.presentation==='scale'&&JSON.stringify(q.options)!==JSON.stringify(['1','2','3','4','5']))ctx.addIssue({code:'custom',message:'La calificación debe ser de 1 a 5.'});
  if(q.presentation==='yes_no'&&JSON.stringify(q.options)!==JSON.stringify(['Sí','No']))ctx.addIssue({code:'custom',message:'Las opciones deben ser Sí y No.'});
  if (['single','multiple'].includes(q.type) && (q.options.length < 2 || new Set(q.options).size !== q.options.length)) ctx.addIssue({code:'custom',path:['options'],message:'Agrega de 2 a 10 opciones distintas.'});
  if (['text','rating'].includes(q.type) && q.options.length) ctx.addIssue({code:'custom',path:['options'],message:'Esta pregunta no necesita opciones.'});
});
export const surveySchema = z.object({theme:surveyThemeSchema.default(DEFAULT_THEME),title: text('El título', 150), questions: z.array(questionSchema).min(1, 'La encuesta debe comenzar con la calificación de estrellas.').max(21, 'Máximo 20 preguntas adicionales a la calificación.')}).superRefine((survey,ctx) => {
  const first = survey.questions[0];
  if (!first || first.type !== 'rating' || !first.required || first.id !== RATING_ID || first.prompt !== RATING_PROMPT || survey.questions.slice(1).some(q => q.type === 'rating')) ctx.addIssue({code:'custom',path:['questions'],message:'La primera pregunta debe ser la calificación obligatoria de 1 a 5 estrellas.'});
  if(new Set(survey.questions.map(q=>q.id)).size !== survey.questions.length) ctx.addIssue({code:'custom',path:['questions'],message:'Cada pregunta debe tener un identificador único.'});
});
export function ratingQuestion(): Question { return {id:RATING_ID,prompt:RATING_PROMPT,type:'rating',required:true,options:[]}; }
export function withInitialRating(questions: Question[] = []): Question[] { return [ratingQuestion(),...questions.filter(q=>q.type!=='rating')]; }
export function surveyError(error:z.ZodError):string {
  const issue=error.issues[0];
  const index=issue.path[0]==='questions' && typeof issue.path[1]==='number'?issue.path[1]:null;
  return index===null?issue.message:`Pregunta ${index+1}: ${issue.message}`;
}
export type ProfileInput = z.input<typeof profileSchema>;
export type RestaurantInput = z.input<typeof restaurantSchema>;
export type EmployeeInput = z.input<typeof employeeSchema>;
export type Question = z.infer<typeof questionSchema>;
export type SurveyInput = z.infer<typeof surveySchema>;
export const draftSchema=z.object({title:z.string().max(150,'Máximo 150 caracteres.'),questions:z.array(z.object({id:z.uuid(),prompt:z.string().max(250),type:z.enum(['rating','text','single','multiple']),required:z.boolean(),options:z.array(z.string().max(120)).max(10),presentation:z.enum(['short','long','scale','yes_no']).optional()})).min(1).max(21),theme:surveyThemeSchema.default(DEFAULT_THEME),builderStep:z.number().int().min(1).max(3).default(1)}).superRefine((draft,ctx)=>{const first=draft.questions[0];if(!first||first.id!==RATING_ID||first.type!=='rating'||!first.required||first.prompt!==RATING_PROMPT||first.options.length||first.presentation||draft.questions.slice(1).some(q=>q.type==='rating')||new Set(draft.questions.map(q=>q.id)).size!==draft.questions.length)ctx.addIssue({code:'custom',message:'Conserva la pregunta inicial de estrellas.'});});
export type SurveyDraft=z.infer<typeof draftSchema>;
export function initials(first: string, last = '') { return ((first.trim()[0] || '') + (last.trim()[0] || '')).toLocaleUpperCase('es-MX'); }
export function surveyPath(restaurantId: string, employeeId: string) { return `/encuesta/${encodeURIComponent(restaurantId)}/${encodeURIComponent(employeeId)}`; }

export const guestContactSchema=z.string().trim().max(254,'El contacto admite hasta 254 caracteres.').refine(value=>!value||z.email().safeParse(value).success||(/^[+\d()\s.-]+$/.test(value)&&value.replace(/\D/g,'').length>=10&&value.replace(/\D/g,'').length<=15),'Escribe un correo o teléfono válido, o deja el campo vacío.');
export const submissionSchema=z.object({submission_id:z.uuid(),restaurant_id:z.uuid(),employee_id:z.uuid(),survey_version_id:z.uuid(),guest_name:text('Tu nombre'),guest_contact:guestContactSchema,rating:z.number().int().min(1,'Selecciona de 1 a 5 estrellas.').max(5),answers:z.record(z.uuid(),z.union([z.string().max(2000,'Máximo 2,000 caracteres por respuesta.'),z.array(z.string().max(120)).max(10)]))}).strict();
export function validateAnswers(questions:Question[],values:Record<string,string|string[]>):{answers?:Record<string,string|string[]>;error?:string;questionId?:string}{
 const answers:Record<string,string|string[]>={};
 const allowed=new Set(questions.filter(q=>q.type!=='rating').map(q=>q.id));
 if(Object.keys(values).some(key=>!allowed.has(key)))return {error:'La encuesta cambió. Actualiza la página e inténtalo de nuevo.'};
 for(const q of questions){
  if(q.type==='rating')continue;
  const raw=values[q.id];const value=typeof raw==='string'?raw.trim():raw;
  if(value===undefined||value===''||(Array.isArray(value)&&!value.length)){if(q.required)return {error:`Responde: ${q.prompt}`,questionId:q.id};continue;}
  if(q.type==='text'&&(typeof value!=='string'||value.length>2000))return {error:`Revisa tu respuesta: ${q.prompt}`,questionId:q.id};
  if(q.type==='single'&&(typeof value!=='string'||!q.options.includes(value)))return {error:`Selecciona una opción: ${q.prompt}`,questionId:q.id};
  if(q.type==='multiple'&&(!Array.isArray(value)||new Set(value).size!==value.length||value.some(v=>!q.options.includes(v))))return {error:`Revisa las opciones: ${q.prompt}`,questionId:q.id};
  answers[q.id]=value;
 }
 return {answers};
}
