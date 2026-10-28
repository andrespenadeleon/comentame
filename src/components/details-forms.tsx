'use client';
import { useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema,restaurantSchema,type ProfileInput,type RestaurantInput } from '@/lib/validation';
import { saveProfile,saveRestaurant,uploadRestaurantLogo,removeRestaurantLogo } from '@/app/actions/workspace';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { SOCIAL_NAMES,logoUrl } from '@/lib/survey-types';
export function Feedback({error,success}:{error?:string;success?:string}) {return <>{error && <p className="alert alert-error" role="alert">{error}</p>}{success && <p className="alert" role="status">{success}</p>}</>;}
export function ProfileForm({initial,onSaved}:{initial?:ProfileInput;onSaved?:()=>void}) {
  const router=useRouter();
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<ProfileInput>({resolver:zodResolver(profileSchema),defaultValues:initial});
  const [result,setResult]=useState<{error?:string;success?:string}>({});
  return <form className="form-grid" onSubmit={handleSubmit(async data=>{setResult({});try{const r=await saveProfile(data);setResult(r);if(!r.error){router.refresh();onSaved?.();}}catch{setResult({error:'No pudimos guardar tus datos. Inténtalo de nuevo.'});}})}>
    <label className="field" htmlFor="full_name">Nombre completo<Input id="full_name" autoComplete="name" maxLength={150} {...register('full_name')} aria-invalid={!!errors.full_name} aria-describedby={errors.full_name?'full_name-error':undefined}/>{errors.full_name && <span className="field-error" id="full_name-error">{errors.full_name.message}</span>}</label>
    <label className="field" htmlFor="admin-phone">Teléfono<Input id="admin-phone" type="tel" autoComplete="tel" {...register('phone')} placeholder="81 1234 5678" aria-invalid={!!errors.phone} aria-describedby={errors.phone?'admin-phone-error':undefined}/>{errors.phone && <span className="field-error" id="admin-phone-error">{errors.phone.message}</span>}</label>
    <Feedback {...result}/><Button disabled={isSubmitting} type="submit">{isSubmitting?'Guardando…':onSaved?'Guardar y continuar →':'Guardar mis datos'}</Button>
  </form>;
}
export function RestaurantForm({initial,id,onSaved}:{initial?:(Omit<RestaurantInput,'google_maps_url'> & {google_maps_url?:string|null;logo_path?:string|null});id?:string;onSaved?:(id:string)=>void}) {
  const router=useRouter();
  const photo=useRef<HTMLInputElement>(null),savedId=useRef(id);
  const [logo,setLogo]=useState(initial?.logo_path);
  useEffect(()=>{setLogo(initial?.logo_path);},[initial?.logo_path]);
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<RestaurantInput>({resolver:zodResolver(restaurantSchema),defaultValues:initial?{...initial,google_maps_url:initial.google_maps_url||''}:undefined});
  const [result,setResult]=useState<{error?:string;success?:string}>({});
  return <form className="form-grid" onSubmit={handleSubmit(async data=>{setResult({});try{const r=await saveRestaurant(data,savedId.current);setResult(r);if(!r.error&&r.id){savedId.current=r.id;const file=photo.current?.files?.[0];if(file){const form=new FormData();form.set('logo',file);const uploaded=await uploadRestaurantLogo(r.id,form);if(uploaded.error){setResult({error:'El restaurante se guardó, pero el logo no pudo subirse. '+uploaded.error});return;}if(photo.current)photo.current.value='';}router.refresh();onSaved?.(r.id);}}catch{setResult({error:'No pudimos guardar el restaurante. Inténtalo de nuevo.'});}})}>
    <label className="field" htmlFor="restaurant-name">Nombre comercial<Input id="restaurant-name" autoComplete="organization" maxLength={150} {...register('name')} aria-invalid={!!errors.name} aria-describedby={errors.name?'restaurant-name-error':undefined}/>{errors.name && <span className="field-error" id="restaurant-name-error">{errors.name.message}</span>}</label>
    <label className="field" htmlFor="restaurant-address">Dirección completa<Input id="restaurant-address" autoComplete="street-address" maxLength={500} {...register('address')} placeholder="Calle, número, colonia, ciudad, estado y C.P." aria-invalid={!!errors.address} aria-describedby={errors.address?'restaurant-address-error':undefined}/>{errors.address && <span className="field-error" id="restaurant-address-error">{errors.address.message}</span>}</label>
    <label className="field" htmlFor="restaurant-phone">Teléfono del restaurante<Input id="restaurant-phone" type="tel" autoComplete="tel" {...register('phone')} placeholder="81 1234 5678" aria-invalid={!!errors.phone} aria-describedby={errors.phone?'restaurant-phone-error':undefined}/>{errors.phone && <span className="field-error" id="restaurant-phone-error">{errors.phone.message}</span>}</label>
    <label className="field" htmlFor="google-maps">Enlace de Google Maps<Input id="google-maps" type="url" maxLength={2048} placeholder="https://maps.app.goo.gl/…" {...register('google_maps_url')} aria-invalid={!!errors.google_maps_url} aria-describedby="maps-help maps-error"/><span id="maps-help" className="muted">Necesario para publicar tu encuesta. Abre tu restaurante en Google Maps y copia el enlace desde Compartir.</span>{errors.google_maps_url&&<span id="maps-error" className="field-error">{errors.google_maps_url.message}</span>}</label>
    <label className="field" htmlFor="restaurant-logo">Logo (opcional)<Input ref={photo} id="restaurant-logo" type="file" accept="image/jpeg,image/png,image/webp"/><small className="muted">JPG, PNG o WebP · Máximo 2 MB.</small></label>
    {logo&&<div className="actions"><img className="restaurant-logo" src={logoUrl(logo)!} alt="Logo actual" width={100} height={70}/><Button type="button" variant="ghost" disabled={isSubmitting} onClick={async()=>{if(!savedId.current)return;try{const r=await removeRestaurantLogo(savedId.current);setResult(r);if(!r.error){setLogo(null);router.refresh();}}catch{setResult({error:"No pudimos quitar el logo. Inténtalo de nuevo."});}}}>Quitar logo</Button></div>}
    <fieldset className="social-fields"><legend>Redes sociales (opcionales)</legend><p className="muted">Se mostrarán en tu encuesta y en el agradecimiento.</p>{(Object.keys(SOCIAL_NAMES) as (keyof typeof SOCIAL_NAMES)[]).map(key=><label key={key} className="field" htmlFor={`social-${key}`}>{SOCIAL_NAMES[key]}<Input id={`social-${key}`} type="url" placeholder={`https://${key}.com/…`} {...register(`social_links.${key}`)}/>{errors.social_links?.[key]&&<span className="field-error">{errors.social_links[key]?.message}</span>}</label>)}</fieldset>
    <Feedback {...result}/><Button disabled={isSubmitting} type="submit">{isSubmitting?'Guardando…':onSaved?'Guardar y continuar →':'Guardar restaurante'}</Button>
  </form>;
}
