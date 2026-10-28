'use client';
import { useEffect,useRef,useState } from 'react';
import { ProfileForm,RestaurantForm,Feedback } from './details-forms';
import { Employees } from './employees';
import { SurveyEditor } from './survey-editor';
import { Button } from './ui/button';
import { completeOnboarding } from '@/app/actions/workspace';
import type { Profile,Restaurant,Employee } from '@/lib/data';
import type { SurveyDraft } from '@/lib/validation';
import type { PublishedSurvey } from '@/lib/survey-types';
const steps=['Tus datos','Tu restaurante','Tu equipo','Tu encuesta'];
export function Onboarding({profile,restaurant,employees,draft,published}:{profile:Profile|null;restaurant:Restaurant|null;employees:Employee[];draft:SurveyDraft|null;published?:PublishedSurvey|null}) {
  const [step,setStep]=useState(profile?restaurant?2:1:0);
  const [restaurantId,setRestaurantId]=useState(restaurant?.id);
  const [returnToSurvey,setReturnToSurvey]=useState(false);
  useEffect(()=>{document.getElementById('step-heading')?.focus();},[step]);
  const [result,setResult]=useState<{error?:string}>({});
  const [busy,setBusy]=useState(false);
  const pending=useRef(false);
  async function finish(){if(pending.current)return;pending.current=true;setBusy(true);setResult({});try{setResult(await completeOnboarding());}catch{setResult({error:'No pudimos finalizar. Inténtalo de nuevo.'});}finally{setBusy(false);pending.current=false;}}
  return <main className="onboarding-bg" id="main"><div className="onboarding-wrap"><aside className="onboarding-side"><span className="eyebrow">HAGAMOS ESPACIO PARA ESCUCHAR</span><h1>Un gran comienzo.</h1><p className="muted">Prepara tu restaurante. Tu equipo y tu encuesta pueden esperar.</p><ol className="steps">{steps.map((name,i)=><li key={name} aria-current={step===i?'step':undefined}><span className="step-number">{i<step?'✓':i+1}</span><span>{name}{i>1&&<small style={{display:'block',fontWeight:400,marginTop:3}}>Opcional</small>}</span></li>)}</ol></aside>
  <section className="onboarding-card" aria-labelledby="step-heading"><span className="eyebrow">PASO {step+1} DE 4</span>{step!==2&&<><h2 id="step-heading" tabIndex={-1}>{steps[step]}</h2><p className="muted">{['Cuéntanos quién administrará la cuenta. Todos los campos son obligatorios.','Da de alta tu primer restaurante. Puedes agregar Google Maps después; será necesario para publicar la encuesta.','Agrega a quienes forman parte de la experiencia. Puedes hacerlo después.','Personaliza tu encuesta, agrega preguntas si quieres y publícala cuando estés listo.'][step]}</p></>}
    {step===0&&<ProfileForm initial={profile||undefined} onSaved={()=>setStep(1)}/>}
    {step===1&&<RestaurantForm id={restaurant?.id||restaurantId} initial={restaurant||undefined} onSaved={id=>{setRestaurantId(id);setStep(returnToSurvey?3:2);setReturnToSurvey(false);}}/>}
    {step===2&&restaurantId&&<div className="stack"><Employees onboarding restaurantId={restaurantId} employees={employees} restaurants={restaurant?[{id:restaurant.id,name:restaurant.name}]:[]}/><Button onClick={()=>setStep(3)}>Continuar a mi encuesta →</Button></div>}
    {restaurantId&&<div hidden={step!==3}><SurveyEditor restaurantId={restaurantId} initial={draft} published={published} branding={restaurant||{name:"Tu restaurante"}} onConfigureRestaurant={()=>{setReturnToSurvey(true);setStep(1);}} onSaved={finish}/></div>}
    <Feedback {...result}/><div className="divider"/><div className="actions">{step>0&&<Button variant="ghost" disabled={busy} onClick={()=>setStep(s=>s-1)}>← Atrás</Button>}{step===2&&<Button variant="ghost" onClick={()=>setStep(3)}>Omitir por ahora</Button>}{step===3&&<Button variant="outline" disabled={busy} onClick={finish}>{busy?'Preparando tu espacio…':'Ir al dashboard →'}</Button>}</div>
  </section></div></main>;
}
