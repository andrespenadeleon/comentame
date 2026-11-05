'use client';
import { useEffect,useId,useLayoutEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check,ChevronsUpDown,Search,Store } from 'lucide-react';
import { logoUrl } from '@/lib/survey-types';
type RestaurantOption={id:string;name:string;logo_path?:string|null};
function Avatar({restaurant}:{restaurant:RestaurantOption}) {
 const logo=logoUrl(restaurant.logo_path);
 return <span className="restaurant-avatar" aria-hidden="true">{logo?<img src={logo} alt="" width={36} height={36}/>:restaurant.name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()}</span>;
}
export function RestaurantSwitcher({restaurants,activeId,basePath='/dashboard'}:{restaurants:RestaurantOption[];activeId:string;basePath?:'/dashboard'|'/admin'}) {
 const active=restaurants.find(restaurant=>restaurant.id===activeId)!;
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 const id=useId(),params=useSearchParams();
 const keyboardOpen=useRef(false);
 const [position,setPosition]=useState({top:0,left:0,width:270});
 useLayoutEffect(()=>{
  if(!open)return;
  function positionPanel(){
   const rect=trigger.current?.getBoundingClientRect();
   if(rect)setPosition({top:rect.bottom+7,left:rect.left,width:Math.min(Math.max(rect.width,270),window.innerWidth-rect.left-16)});
  }
  positionPanel();
  // Reposition rather than close when the keyboard/browser chrome changes the viewport.
  function scroll(event:Event){
   if(window.matchMedia('(min-width: 768px)').matches&&!panel.current?.contains(event.target as Node))positionPanel();
  }
  window.addEventListener('resize',positionPanel);window.addEventListener('scroll',scroll,true);
  return()=>{window.removeEventListener('resize',positionPanel);window.removeEventListener('scroll',scroll,true);};
 },[open]);
 const filtered=restaurants.filter(restaurant=>restaurant.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
 useEffect(()=>{
  if(!open)return;
  // Touch opening must not focus the search input and summon the software keyboard.
  if(keyboardOpen.current){
   panel.current?.querySelector<HTMLElement>('input,a[aria-current="true"],a')?.focus({preventScroll:true});
   keyboardOpen.current=false;
  }
  function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}
  function focusOutside(event:FocusEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',focusOutside);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',focusOutside);};
 },[open]);
 function close(){setOpen(false);setSearch('');}
 function href(restaurantId:string){
  const query=new URLSearchParams(params.toString());query.set('restaurant',restaurantId);
  for(const key of ['employee','rating','page','detail','scope','q'])query.delete(key);
  return `${basePath}?${query}`;
 }
 return <div className="restaurant-switcher" ref={root}>
  {restaurants.length===1?<div className="restaurant-switcher-trigger is-static"><Avatar restaurant={active}/><span><strong>{active.name}</strong><small>Restaurante activo</small></span></div>:<button ref={trigger} type="button" className="restaurant-switcher-trigger" aria-expanded={open} aria-controls={id} aria-label={`Cambiar restaurante. Actual: ${active.name}`} onPointerDown={()=>{keyboardOpen.current=false;}} onClick={()=>{setSearch('');setOpen(value=>!value);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')keyboardOpen.current=true;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();keyboardOpen.current=true;setOpen(true);}}}><Avatar restaurant={active}/><span><strong>{active.name}</strong><small>Restaurante activo</small></span><ChevronsUpDown size={17} aria-hidden="true"/></button>}
  {open&&<div id={id} ref={panel} className="restaurant-switcher-panel" style={{'--switcher-top':`${position.top}px`,'--switcher-left':`${position.left}px`,'--switcher-width':`${position.width}px`} as React.CSSProperties} role="region" aria-label="Seleccionar restaurante" onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();trigger.current?.focus({preventScroll:true});return;}
   const typing=event.target instanceof HTMLInputElement;
   if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||(typing&&['Home','End'].includes(event.key)))return;
   const options=Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>('a')||[]);if(!options.length)return;
   event.preventDefault();const current=options.indexOf(document.activeElement as HTMLAnchorElement);
   const next=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowDown'?(current+1)%options.length:(current-1+options.length)%options.length;
   options[next]?.focus({preventScroll:true});
  }}>
   {restaurants.length>5&&<label className="restaurant-switcher-search"><Search size={15} aria-hidden="true"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar restaurante" aria-label="Buscar restaurante"/></label>}
   <nav className="restaurant-switcher-options" aria-label="Tus restaurantes">{filtered.map(restaurant=><Link key={restaurant.id} href={href(restaurant.id)} aria-current={restaurant.id===activeId?'true':undefined} onClick={close}><Avatar restaurant={restaurant}/><span>{restaurant.name}</span>{restaurant.id===activeId&&<Check size={16} aria-hidden="true"/>}</Link>)}{!filtered.length&&<p className="muted">No encontramos ese restaurante.</p>}</nav>
   <Link className="restaurant-manage" href={`${basePath}?section=restaurante&restaurant=${activeId}`} onClick={close}><Store size={16} aria-hidden="true"/>Administrar restaurantes</Link>
  </div>}
 </div>;
}
