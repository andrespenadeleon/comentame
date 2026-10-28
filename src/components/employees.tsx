'use client';
import Link from 'next/link';
import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { employeeSchema,initials,type EmployeeInput } from '@/lib/validation';
import { saveEmployee,deleteEmployee,uploadEmployeePhoto } from '@/app/actions/workspace';
import type { Employee } from '@/lib/data';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Feedback } from './details-forms';
import { Pencil,Trash2,Users,MessageSquareText } from 'lucide-react';
export function Employees({restaurantId,employees,restaurants=[],onboarding=false}:{restaurantId:string;employees:Employee[];restaurants?:{id:string;name:string}[];onboarding?:boolean}) {
  const router=useRouter();
  const [filter,setFilter]=useState('all');
  const visibleEmployees=filter==='all'?employees:employees.filter(e=>e.restaurant_id===filter);
  const [editing,setEditing]=useState<Employee|null|undefined>();
  const [deleting,setDeleting]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<{error?:string;success?:string}>({});
  async function remove(id:string) {setBusy(true);setResult({});try{const r=await deleteEmployee(id);setResult(r);if(!r.error){setDeleting(null);router.refresh();}}catch{setResult({error:'No pudimos eliminar al empleado. Inténtalo nuevamente.'});}finally{setBusy(false);}}
  return <div className="stack"><div className="card-head team-header"><div><h2 id={onboarding?'step-heading':undefined} tabIndex={onboarding?-1:undefined}>Tu equipo</h2><p className="muted">{onboarding?'Agrega a quienes forman parte de la experiencia. Puedes hacerlo después.':'Administra a las personas que atienden a tus clientes.'}</p></div>{employees.length>0&&<Button className="team-add" onClick={()=>setEditing(null)}>+ Agregar empleado</Button>}</div>
    {!onboarding&&restaurants.length>1&&<label className="field team-filter" htmlFor="team-restaurant">Filtrar por restaurante<select id="team-restaurant" className="input" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos los restaurantes</option>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
    <Feedback {...result}/>
    {editing!==undefined && <div className="card"><EmployeeForm key={editing?.id||'new'} restaurantId={filter==='all'?restaurantId:filter} restaurants={restaurants} employee={editing||undefined} onSaved={savedRestaurant=>{setEditing(undefined);setResult({success:'Empleado guardado.'});if(filter!=='all')setFilter(savedRestaurant);router.refresh();}} onCancel={()=>setEditing(undefined)}/></div>}
    {!employees.length && editing===undefined && <div className="empty"><div className="empty-icon"><Users size={23} aria-hidden="true"/></div><h3>Cada mesero cuenta.</h3><p>Agrega a tu primer empleado para comenzar a preparar tu equipo.</p><Button variant="outline" onClick={()=>setEditing(null)}>Agregar primer empleado</Button></div>}
    <div className="employee-list">{visibleEmployees.map(e=><article key={e.id} className="employee">
      {e.photo_url?<img className="avatar" width={46} height={46} src={e.photo_url} alt={`Foto de ${e.first_name} ${e.last_name}`}/>:<span className="avatar" aria-hidden="true">{initials(e.first_name,e.last_name)}</span>}
      <div className="employee-info"><p>{e.first_name} {e.last_name}</p><small>{e.role}</small><span className="employee-restaurant">{e.restaurant_name||restaurants.find(r=>r.id===e.restaurant_id)?.name}</span></div>
      <div className="employee-actions">{!onboarding&&<Link className="icon-action" title="Ver opiniones" aria-label={`Ver opiniones de ${e.first_name} ${e.last_name}`} href={`/dashboard?section=opiniones&restaurant=${e.restaurant_id}&employee=${e.id}`}><MessageSquareText size={16} aria-hidden="true"/></Link>}<button className="icon-action" type="button" title="Editar empleado" aria-label={`Editar a ${e.first_name} ${e.last_name}`} onClick={()=>setEditing(e)}><Pencil size={16} aria-hidden="true"/></button><button className="icon-action icon-danger" type="button" title="Eliminar empleado" aria-label={`Eliminar a ${e.first_name} ${e.last_name}`} onClick={()=>setDeleting(e.id)}><Trash2 size={16} aria-hidden="true"/></button></div>
      {deleting===e.id && <div className="stack" role="group" aria-label="Confirmar eliminación"><p className="muted">¿Eliminar a {e.first_name} {e.last_name}? Su enlace dejará de aceptar respuestas. Las opiniones anteriores se conservarán.</p><div className="actions"><Button size="sm" variant="destructive" disabled={busy} onClick={()=>remove(e.id)}>{busy?'Eliminando…':'Sí, eliminar'}</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>setDeleting(null)}>Cancelar</Button></div></div>}
    </article>)}</div>{employees.length>0&&!visibleEmployees.length&&<p className="empty muted">Todavía no hay empleados en este restaurante.</p>}
  </div>;
}
function EmployeeForm({restaurantId,restaurants,employee,onSaved,onCancel}:{restaurantId:string;restaurants:{id:string;name:string}[];employee?:Employee;onSaved:(restaurantId:string)=>void;onCancel:()=>void}) {
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<EmployeeInput>({resolver:zodResolver(employeeSchema),defaultValues:employee||{first_name:'',last_name:'',role:''}});
  const [selectedRestaurant,setSelectedRestaurant]=useState(employee?.restaurant_id||restaurantId);
  const photo=useRef<HTMLInputElement>(null);
  const savedId=useRef(employee?.id);
  const [result,setResult]=useState<{error?:string;success?:string}>({});
  return <form className="form-grid" onSubmit={handleSubmit(async data=>{
    setResult({});const file=photo.current?.files?.[0];
    if(file&&(file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))){setResult({error:'Elige una foto JPG, PNG o WebP de máximo 2 MB.'});return;}
    try {const r=await saveEmployee(selectedRestaurant,data,savedId.current);if(r.error||!r.id){setResult(r);return;}savedId.current=r.id;
      if(file){const form=new FormData();form.set('photo',file);const uploaded=await uploadEmployeePhoto(r.id,form);if(uploaded.error){setResult({error:'El perfil se guardó, pero la foto no pudo subirse. Puedes reintentar o continuar sin foto.'});return;}}
      onSaved(selectedRestaurant);
    }catch{setResult({error:'No pudimos guardar los cambios. Inténtalo nuevamente.'});}
  })}>
    <h3>{employee?'Editar empleado':'Nuevo empleado'}</h3>{restaurants.length>1&&<label className="field" htmlFor="employee-restaurant">Restaurante<select id="employee-restaurant" className="input" value={selectedRestaurant} disabled={!!employee||!!savedId.current} onChange={e=>setSelectedRestaurant(e.target.value)}>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}<div className="two-col">
    <label className="field" htmlFor="first-name">Nombre<Input id="first-name" maxLength={80} autoComplete="off" {...register('first_name')} aria-invalid={!!errors.first_name} aria-describedby={errors.first_name?'first-name-error':undefined}/>{errors.first_name&&<span id="first-name-error" className="field-error">{errors.first_name.message}</span>}</label>
    <label className="field" htmlFor="last-name">Apellido<Input id="last-name" maxLength={80} autoComplete="off" {...register('last_name')} aria-invalid={!!errors.last_name} aria-describedby={errors.last_name?'last-name-error':undefined}/>{errors.last_name&&<span id="last-name-error" className="field-error">{errors.last_name.message}</span>}</label></div>
    <label className="field" htmlFor="employee-role">Puesto<Input id="employee-role" maxLength={100} placeholder="Mesero, anfitrión…" {...register('role')} aria-invalid={!!errors.role} aria-describedby={errors.role?'employee-role-error':undefined}/>{errors.role&&<span id="employee-role-error" className="field-error">{errors.role.message}</span>}</label>
    <label className="field" htmlFor="employee-photo">Foto (opcional)<Input ref={photo} id="employee-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help"/><span id="photo-help" className="muted">JPG, PNG o WebP · Máximo 2 MB. Sin foto usaremos sus iniciales.</span></label>
    <Feedback {...result}/><div className="actions"><Button disabled={isSubmitting} type="submit">{isSubmitting?'Guardando…':'Guardar empleado'}</Button><Button disabled={isSubmitting} variant="ghost" type="button" onClick={onCancel}>Cerrar</Button></div>
  </form>;
}
