'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { profileSchema,restaurantSchema,employeeSchema,surveySchema,surveyError,draftSchema } from '@/lib/validation';
import { messageFor } from '@/lib/errors';
import { z } from 'zod';
export type Result = {error?:string;success?:string;id?:string};
function invalid(error:z.ZodError):Result {return {error:error.issues[0].message};}
const refresh=()=>{revalidatePath('/dashboard','layout');revalidatePath('/onboarding');};
export async function saveProfile(input:unknown):Promise<Result> {
  const parsed=profileSchema.safeParse(input);if(!parsed.success)return invalid(parsed.error);
  const {db,user}=await requireUser();
  // Upsert would need an UPDATE grant on id. Read and update explicitly instead.
  const {data:existing,error:readError}=await db.from('profiles').select('id').eq('id',user.id).maybeSingle();
  if(readError)return {error:messageFor(readError)};
  const {error}=existing?await db.from('profiles').update(parsed.data).eq('id',user.id):await db.from('profiles').insert({id:user.id,...parsed.data});
  if(error)return {error:messageFor(error)};refresh();return {success:'Tus datos se guardaron.'};
}
export async function saveRestaurant(input:unknown,id?:string):Promise<Result> {
  const parsed=restaurantSchema.safeParse(input);if(!parsed.success)return invalid(parsed.error);
  const payload={...parsed.data,google_maps_url:parsed.data.google_maps_url||null,social_links:Object.fromEntries(Object.entries(parsed.data.social_links||{}).filter(([,value])=>!!value))};
  const {db}=await requireUser();
  if(id) {
    if(!z.uuid().safeParse(id).success)return {error:'Restaurante inválido.'};
    const {data,error}=await db.from('restaurants').update(payload).eq('id',id).select('id').single();
    if(error)return {error:error.message.includes('restaurant_live_google_required')?'La encuesta está publicada: conserva un enlace de Google Maps válido.':messageFor(error)};refresh();return {success:'Restaurante actualizado.',id:data.id};
  }
  const {data,error}=await db.rpc('create_restaurant',{p_name:parsed.data.name,p_address:parsed.data.address,p_phone:parsed.data.phone,p_google_maps_url:payload.google_maps_url,p_social_links:payload.social_links});
  if(error)return {error:messageFor(error)};refresh();return {success:'Tu restaurante está listo.',id:data};
}
export async function saveEmployee(restaurantId:string,input:unknown,id?:string):Promise<Result> {
  const parsed=employeeSchema.safeParse(input);if(!parsed.success)return invalid(parsed.error);
  if(!z.uuid().safeParse(restaurantId).success || (id && !z.uuid().safeParse(id).success))return {error:'Identificador inválido.'};
  const {db}=await requireUser();
  const query=id?db.from('employees').update(parsed.data).eq('id',id).eq('restaurant_id',restaurantId).is('deleted_at',null):db.from('employees').insert({...parsed.data,restaurant_id:restaurantId});
  const {data,error}=await query.select('id').single();
  if(error)return {error:messageFor(error)};refresh();return {success:'Empleado guardado.',id:data.id};
}
export async function deleteEmployee(id:string):Promise<Result> {
  if(!z.uuid().safeParse(id).success)return {error:'Empleado inválido.'};
  const {db}=await requireUser();
  const {data,error:readError}=await db.from('employees').select('photo_path,restaurant_id').eq('id',id).single();
  if(readError)return {error:messageFor(readError)};
  const {error}=await db.rpc('archive_employee',{p_employee_id:id});
  if(error)return {error:messageFor(error)};
  if(data.photo_path)await db.storage.from('employee-photos').remove([data.photo_path]);
  refresh();return {success:'Empleado eliminado. Se desactivó su enlace y se conservaron sus opiniones anteriores.'};
}
export async function saveSurvey(restaurantId:string,input:unknown):Promise<Result> {
  const parsed=draftSchema.safeParse(input);if(!parsed.success)return {error:surveyError(parsed.error)};
  if(!z.uuid().safeParse(restaurantId).success)return {error:'Restaurante inválido.'};
  const {db}=await requireUser();
  const {error}=await db.rpc('save_survey_draft',{p_restaurant_id:restaurantId,p_title:parsed.data.title,p_questions:parsed.data.questions,p_theme:parsed.data.theme,p_step:parsed.data.builderStep});
  if(error)return {error:messageFor(error)};
  return {success:'Guardado'};
}
export async function completeOnboarding():Promise<Result> {
  const {db}=await requireUser();
  const {error}=await db.rpc('complete_onboarding');
  if(error)return {error:messageFor(error)};
  refresh();redirect('/dashboard');
}
export async function uploadEmployeePhoto(employeeId:string,form:FormData):Promise<Result> {
  if(!z.uuid().safeParse(employeeId).success)return {error:'Empleado inválido.'};
  const file=form.get('photo');
  if(!(file instanceof File)||!file.size||file.size>2*1024*1024)return {error:'Elige una imagen de máximo 2 MB.'};
  const bytes=new Uint8Array(await file.arrayBuffer());
  const ext=bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff?'jpg':bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4e && bytes[3]===0x47?'png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'webp':null;
  if(!ext)return {error:'Solo se permiten imágenes JPG, PNG o WebP.'};
  const {db}=await requireUser();
  const {data:employee,error:readError}=await db.from('employees').select('id,restaurant_id,photo_path').eq('id',employeeId).is('deleted_at',null).single();
  if(readError)return {error:messageFor(readError)};
  const path=`${employee.restaurant_id}/${employeeId}/${crypto.randomUUID()}.${ext}`;
  const bucket=db.storage.from('employee-photos');
  const {error:uploadError}=await bucket.upload(path,bytes,{contentType:ext==='jpg'?'image/jpeg':`image/${ext}`,upsert:false});
  if(uploadError)return {error:messageFor(uploadError)};
  const {error}=await db.from('employees').update({photo_path:path}).eq('id',employeeId);
  if(error){await bucket.remove([path]);return {error:messageFor(error)};}
  if(employee.photo_path)await bucket.remove([employee.photo_path]);
  refresh();return {success:'Foto guardada.'};
}
export async function publishSurvey(restaurantId:string,input:unknown):Promise<Result & {version?:number}> {
 const parsed=surveySchema.safeParse(input);if(!parsed.success)return {error:surveyError(parsed.error)};
 if(!z.uuid().safeParse(restaurantId).success)return {error:'Restaurante inválido.'};
 const {db}=await requireUser();
 const {data,error}=await db.rpc('publish_survey',{p_restaurant_id:restaurantId,p_title:parsed.data.title,p_questions:parsed.data.questions,p_theme:parsed.data.theme});
 if(error)return {error:error.message.includes('google_required')?'Agrega el enlace de Google Maps del restaurante antes de publicar.':messageFor(error)};
 refresh();return {success:'Tu encuesta ya está publicada.',id:data.id,version:data.version};
}
export async function uploadRestaurantLogo(restaurantId:string,form:FormData):Promise<Result> {
 if(!z.uuid().safeParse(restaurantId).success)return {error:'Restaurante inválido.'};
 const file=form.get('logo');
 if(!(file instanceof File)||!file.size||file.size>2*1024*1024)return {error:'Elige una imagen de máximo 2 MB.'};
 const bytes=new Uint8Array(await file.arrayBuffer());
 const ext=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'jpg':bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47?'png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'webp':null;
 if(!ext)return {error:'El logo debe ser JPG, PNG o WebP.'};
 const {db}=await requireUser();
 const {data:restaurant,error:readError}=await db.from('restaurants').select('logo_path').eq('id',restaurantId).single();
 if(readError)return {error:messageFor(readError)};
 const path=`${restaurantId}/${crypto.randomUUID()}.${ext}`;
 const bucket=db.storage.from('restaurant-logos');
 const {error:uploadError}=await bucket.upload(path,bytes,{contentType:ext==='jpg'?'image/jpeg':`image/${ext}`,upsert:false});
 if(uploadError)return {error:messageFor(uploadError)};
 const {error}=await db.from('restaurants').update({logo_path:path}).eq('id',restaurantId);
 if(error){await bucket.remove([path]);return {error:messageFor(error)};}
 if(restaurant.logo_path)await bucket.remove([restaurant.logo_path]);
 refresh();return {success:'Logo guardado.'};
}
export async function removeRestaurantLogo(restaurantId:string):Promise<Result> {
 if(!z.uuid().safeParse(restaurantId).success)return {error:'Restaurante inválido.'};
 const {db}=await requireUser();
 const {data,error:readError}=await db.from('restaurants').select('logo_path').eq('id',restaurantId).single();
 if(readError)return {error:messageFor(readError)};
 const {error}=await db.from('restaurants').update({logo_path:null}).eq('id',restaurantId);
 if(error)return {error:messageFor(error)};
 if(data.logo_path)await db.storage.from('restaurant-logos').remove([data.logo_path]);
 refresh();return {success:'Logo eliminado. Se mostrará el nombre del restaurante.'};
}


export async function prepareSurveyBackground(restaurantId:string,mime:string):Promise<Result & {path?:string;token?:string}> {
 if(!z.uuid().safeParse(restaurantId).success||!['image/jpeg','image/png','image/webp'].includes(mime))return {error:'Elige una imagen JPG, PNG o WebP.'};
 const {db}=await requireUser();
 const {error:ownerError}=await db.from('restaurants').select('id').eq('id',restaurantId).single();
 if(ownerError)return {error:messageFor(ownerError)};
 const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';
 const path=`${restaurantId}/${crypto.randomUUID()}.${ext}`;
 const {data,error}=await db.storage.from('survey-backgrounds').createSignedUploadUrl(path);
 if(error)return {error:messageFor(error)};
 return {path,token:data.token};
}
export async function confirmSurveyBackground(restaurantId:string,path:string):Promise<Result & {path?:string}> {
 if(!z.uuid().safeParse(restaurantId).success||!new RegExp('^'+restaurantId+'/[a-f0-9-]{36}\\.(jpg|png|webp)$').test(path))return {error:'La imagen no es válida.'};
 const {db}=await requireUser();
 const {error:ownerError}=await db.from('restaurants').select('id').eq('id',restaurantId).single();
 if(ownerError)return {error:messageFor(ownerError)};
 const bucket=db.storage.from('survey-backgrounds');
 const {data,error}=await bucket.download(path);
 if(error||!data)return {error:'No pudimos confirmar la imagen. Intenta subirla de nuevo.'};
 const bytes=new Uint8Array(await data.slice(0,12).arrayBuffer());
 const ext=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'jpg':bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10?'png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'webp':null;
 if(!data.size||data.size>5*1024*1024||!ext||!path.endsWith('.'+ext))return {error:'La imagen debe ser JPG, PNG o WebP y pesar máximo 5 MB.'};
 return {path,success:'Imagen lista.'};
}
