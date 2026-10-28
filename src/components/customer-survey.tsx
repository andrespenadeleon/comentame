'use client';
import { useId,useRef,useState } from 'react';
import Link from 'next/link';
import { normalizeTheme,backgroundUrl,themeTokens,type SurveyTheme } from '@/lib/survey-theme';
import { Check,ExternalLink,Instagram,Facebook,Youtube,Music2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { guestContactSchema,validateAnswers,type Question } from '@/lib/validation';
import { logoUrl,SOCIAL_NAMES,type SocialLinks,type SurveyBranding,type PublicSurvey,type Answers } from '@/lib/survey-types';
const socialIcons={instagram:Instagram,facebook:Facebook,tiktok:Music2,youtube:Youtube};
export function SocialLinksList({links,prominent=false}:{links?:SocialLinks;prominent?:boolean}){
 const headingId=useId();
 const platforms=(Object.keys(SOCIAL_NAMES) as (keyof SocialLinks)[]).filter(key=>!!links?.[key]);
 if(!platforms.length)return null;
 const navigation=<nav className={prominent?'survey-social-cards':'survey-socials'} aria-label="Redes sociales del restaurante">{platforms.map(key=>{const Icon=socialIcons[key];return <a key={key} href={links![key]} target="_blank" rel="noopener noreferrer">{prominent&&<Icon size={23} aria-hidden="true"/>}<span>{SOCIAL_NAMES[key]}</span><ExternalLink size={prominent?15:12} aria-hidden="true"/></a>;})}</nav>;
 return prominent?<section className="survey-social-highlight" aria-labelledby={headingId}><h2 id={headingId}>Sigamos en contacto</h2><p>Síguenos y entérate de lo que viene.</p>{navigation}</section>:navigation;
}
export function CustomerSurvey({branding,title,questions,context,preview=false,theme}:{branding:SurveyBranding;title:string;questions:Question[];context?:PublicSurvey;preview?:boolean;theme?:SurveyTheme}){
 const [rating,setRating]=useState(0),[name,setName]=useState(''),[contact,setContact]=useState('');
 const [answers,setAnswers]=useState<Answers>({}),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(false),submissionId=useRef<string|null>(null),form=useRef<HTMLFormElement>(null);
 const logo=logoUrl(branding.logo_path),prefix=useId();
 const appearance=normalizeTheme(theme),image=backgroundUrl(appearance.backgroundImagePath);
 const style={...themeTokens(appearance),backgroundColor:appearance.backgroundColor,backgroundImage:image?`url("${image}")`:undefined} as React.CSSProperties;
 function update(id:string,value:string|string[]){setAnswers(current=>({...current,[id]:value}));setError('');}
 function reset(){submissionId.current=null;setSent(false);setRating(0);setName('');setContact('');setAnswers({});setError('');}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending.current)return;setError('');
  if(!rating){setError('Selecciona de 1 a 5 estrellas.');form.current?.querySelector<HTMLButtonElement>('.customer-stars button')?.focus();return;}
  if(!name.trim()){setError('Escribe tu nombre.');return;}
  const contactResult=guestContactSchema.safeParse(contact);if(!contactResult.success){setError(contactResult.error.issues[0].message);return;}
  const validated=validateAnswers(questions,answers);if(validated.error){setError(validated.error);if(validated.questionId)document.getElementById(`${prefix}-answer-${validated.questionId}`)?.focus();return;}
  if(preview){setSent(true);return;}
  if(!context){setError('Esta encuesta no está disponible.');return;}
  pending.current=true;setBusy(true);submissionId.current??=crypto.randomUUID();
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
  try{
   const result=await fetch('/api/encuesta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submission_id:submissionId.current,restaurant_id:context.restaurant_id,employee_id:context.employee_id,survey_version_id:context.survey_version_id,guest_name:name.trim(),guest_contact:contactResult.data,rating,answers:validated.answers}),signal:controller.signal});
   const body=await result.json();if(!result.ok||!body.success)throw new Error(body.error||'No pudimos confirmar el envío. Inténtalo nuevamente.');
   setSent(true);
  }catch(err){setError(err instanceof Error&&err.name!=='AbortError'?err.message:'No pudimos confirmar el envío. Tus respuestas siguen aquí; inténtalo nuevamente.');}
  finally{clearTimeout(timeout);pending.current=false;setBusy(false);}
 }
 return <div className={`survey-experience ${image?'has-background-image':''}`} style={style}><div className="customer-survey"><header className="survey-brand">{logo?<img src={logo} alt={`Logo de ${branding.name}`} width={180} height={90}/>:<span>{branding.name||'Tu restaurante'}</span>}</header>
  {sent?<section className="survey-thanks" role="status"><div className="survey-success"><Check size={32}/></div><h1>¡Gracias por compartir tu experiencia!</h1><p>Tu opinión ayuda a {branding.name} a mejorar cada día.</p>{preview&&<p className="alert">Vista previa: no se guardó ninguna respuesta.</p>}{branding.google_maps_url&&!preview&&<div className="google-invitation"><h2>¿Quieres compartirla también en Google?</h2><p>Es opcional y nos ayuda a que más personas nos conozcan.</p><Button asChild><a href={branding.google_maps_url} target="_blank" rel="noopener noreferrer">Dejar una reseña en Google <ExternalLink size={15}/></a></Button><small>Se abrirá la ficha del restaurante en Google.</small></div>}<Button type="button" variant="ghost" onClick={reset}>{preview?'Volver a probar la encuesta':'Dejar otra opinión'}</Button></section>:<><div className="survey-intro"><h1>{title||'Tu opinión nos ayuda a mejorar'}</h1><p>Nos gustaría conocer tu experiencia.</p></div><form ref={form} className="customer-form" onSubmit={submit}>
   <fieldset className="customer-rating"><legend>¿Cómo estuvo tu experiencia? <span aria-hidden="true">*</span></legend><div className="customer-stars" role="group" aria-label="Calificación obligatoria de 1 a 5 estrellas">{[1,2,3,4,5].map(n=><button key={n} type="button" disabled={busy} className={n<=rating?'chosen':''} aria-label={`${n} ${n===1?'estrella':'estrellas'}`} aria-pressed={rating===n} onClick={()=>{setRating(n);setError('');}}>★</button>)}</div><span className="rating-description">{rating?['','Muy mala','Mala','Regular','Buena','Excelente'][rating]:'Elige tu calificación'}</span></fieldset>
   <label className="field" htmlFor={`${prefix}-guest-name`}>Tu nombre <span aria-hidden="true">*</span><Input id={`${prefix}-guest-name`} autoComplete="name" required maxLength={150} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
   <label className="field" htmlFor={`${prefix}-guest-contact`}>Correo o teléfono (opcional)<Input id={`${prefix}-guest-contact`} autoComplete="off" maxLength={254} value={contact} disabled={busy} onChange={e=>setContact(e.target.value)} placeholder="Por si el restaurante necesita contactarte"/></label>
   {questions.filter(q=>q.type!=='rating').map(q=><fieldset key={q.id} className="customer-question" id={`${prefix}-question-${q.id}`}><legend>{q.prompt}{q.required?' *':' (opcional)'}</legend>{q.type==='text'&&q.presentation==='short'?<Input id={`${prefix}-answer-${q.id}`} aria-label={q.prompt} required={q.required} disabled={busy} maxLength={2000} value={typeof answers[q.id]==='string'?answers[q.id] as string:''} onChange={e=>update(q.id,e.target.value)} placeholder="Tu respuesta"/>:q.type==='text'?<textarea className="input" id={`${prefix}-answer-${q.id}`} aria-label={q.prompt} required={q.required} disabled={busy} maxLength={2000} value={typeof answers[q.id]==='string'?answers[q.id] as string:''} onChange={e=>update(q.id,e.target.value)} placeholder="Cuéntanos…"/>:q.type==='single'&&q.presentation==='scale'?<div id={`${prefix}-answer-${q.id}`} tabIndex={-1} className="customer-scale" role="group" aria-label={q.prompt}>{q.options.map(option=><button key={option} type="button" disabled={busy} aria-pressed={answers[q.id]===option} className={answers[q.id]===option?'selected':''} onClick={()=>update(q.id,option)}>{option}</button>)}</div>:q.type==='single'&&q.presentation==='yes_no'?<div id={`${prefix}-answer-${q.id}`} tabIndex={-1} className="customer-options binary-options">{q.options.map(option=><label key={option}><input type="radio" name={`${prefix}-${q.id}`} value={option} required={q.required} disabled={busy} checked={answers[q.id]===option} onChange={()=>update(q.id,option)}/>{option}</label>)}</div>:q.type==='single'?<select className="input" id={`${prefix}-answer-${q.id}`} aria-label={q.prompt} required={q.required} disabled={busy} value={typeof answers[q.id]==='string'?answers[q.id] as string:''} onChange={e=>update(q.id,e.target.value)}><option value="">Selecciona una opción</option>{q.options.map(option=><option key={option}>{option}</option>)}</select>:<div id={`${prefix}-answer-${q.id}`} tabIndex={-1} className="customer-options">{q.options.map(option=><label key={option}><input type="checkbox" disabled={busy} checked={Array.isArray(answers[q.id])&&(answers[q.id] as string[]).includes(option)} onChange={e=>{const selected=Array.isArray(answers[q.id])?answers[q.id] as string[]:[];update(q.id,e.target.checked?[...selected,option]:selected.filter(v=>v!==option));}}/>{option}</label>)}{q.required&&<small>Selecciona al menos una opción.</small>}</div>}</fieldset>)}
   {error&&<p className="alert alert-error" role="alert">{error}</p>}<Button type="submit" disabled={busy} aria-busy={busy}>{busy?'Enviando tu opinión…':preview?'Probar envío (sin guardar)':'Enviar mi opinión →'}</Button>
   <p className="survey-privacy">Tu nombre, contacto y opinión serán visibles solo para el restaurante. <Link href="/privacidad" target="_blank">Aviso de privacidad</Link></p>
  </form></>}
  <SocialLinksList links={branding.social_links} prominent={sent}/><footer className="survey-powered">Hecho con <Link href="/">comenta.me</Link></footer>
 </div></div>;
}
