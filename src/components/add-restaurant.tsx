'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RestaurantForm } from './details-forms';
import { Button } from './ui/button';
export function AddRestaurant(){const [open,setOpen]=useState(false);const router=useRouter();return <div className="stack"><p className="muted">Tu cuenta incluye un restaurante por defecto. Para agregar otro, el equipo de comenta.me debe autorizarlo previamente.</p><Button variant="outline" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="new-restaurant">{open?'Cerrar formulario':'Agregar restaurante autorizado'}</Button>{open&&<div id="new-restaurant"><RestaurantForm onSaved={id=>{setOpen(false);router.push(`/dashboard?section=restaurante&restaurant=${id}`);router.refresh();}}/></div>}</div>;}
