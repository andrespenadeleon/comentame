'use client';
import { useEffect,useRef,useState,useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutDashboard,Store,Users,ClipboardList,Menu,X,MessageSquare,LifeBuoy,CircleAlert } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { LoadingIndicator } from './loading-indicator';
import { RestaurantSwitcher } from './restaurant-switcher';
import { SignOutButton } from './signout-button';
const navigation=[{id:'resumen',label:'Resumen',icon:LayoutDashboard},{id:'opiniones',label:'Opiniones y métricas',icon:MessageSquare},{id:'restaurante',label:'Mi restaurante',icon:Store},{id:'equipo',label:'Mi equipo',icon:Users},{id:'encuesta',label:'Mi encuesta',icon:ClipboardList},{id:'soporte',label:'Soporte',icon:LifeBuoy}];
export function DashboardShell({name,restaurantName,restaurantId,restaurantCount,restaurants,section,children,surveyNeedsSetup=false,portal=false}:{name:string;restaurantName:string;restaurantId:string;restaurantCount:number;restaurants:{id:string;name:string;logo_path?:string|null}[];section:string;children:React.ReactNode;surveyNeedsSetup?:boolean;portal?:boolean}) {
  const basePath=portal?'/admin':'/dashboard';
  const [open,setOpen]=useState(false);
  const [pending,startTransition]=useTransition();
  const router=useRouter();
  const menuButton=useRef<HTMLButtonElement>(null);
  const menu=useRef<HTMLElement>(null);
  useEffect(()=>{document.cookie=`${portal?'cm_portal_restaurant':'cm_restaurant'}=${encodeURIComponent(restaurantId)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;},[restaurantId,portal]);
  useEffect(()=>{
    if(!open)return;
    const media=window.matchMedia('(max-width: 767px)');
    if(!media.matches)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    menu.current?.querySelector<HTMLElement>('a')?.focus();
    function keydown(event:KeyboardEvent){
      if(event.key==='Escape'){setOpen(false);menuButton.current?.focus();}
      if(event.key==='Tab'){
        const elements=Array.from(menu.current?.querySelectorAll<HTMLElement>('a,button,input')||[]);
        const first=elements[0],last=elements[elements.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }
    function resized(){if(!media.matches)setOpen(false);}
    document.addEventListener('keydown',keydown);media.addEventListener('change',resized);
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',keydown);media.removeEventListener('change',resized);};
  },[open]);
  function close(){setOpen(false);menuButton.current?.focus();}
  return <><header className="app-header dashboard-header"><Link href="/" className="wordmark">comenta.me</Link><div className="header-right"><span className="mobile-restaurant-name">{restaurantName}</span><span className="account-name">{name}</span><button ref={menuButton} className="dashboard-menu-toggle" aria-label={open?'Cerrar navegación':'Abrir navegación'} aria-expanded={open} aria-controls="dashboard-nav" onClick={()=>setOpen(v=>!v)}><Menu size={23} aria-hidden="true"/></button></div></header><div className="workspace" onClickCapture={event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=(event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
    const url=new URL(anchor.href,window.location.origin);
    if(url.origin!==window.location.origin||url.pathname!==basePath)return;
    event.preventDefault();close();startTransition(()=>router.push(url.pathname+url.search));
  }}>
    {open&&<div className="nav-backdrop" onClick={close} aria-hidden="true"/>}
    <aside ref={menu} id="dashboard-nav" role={open?'dialog':undefined} aria-modal={open||undefined} aria-label="Menú principal" className={`app-sidebar ${open?'is-open':''}`}><button className="nav-close icon-action" onClick={close} aria-label="Cerrar navegación"><X size={22}/></button><span className="restaurant-label">{portal?'RESTAURANTES':restaurantCount>1?'TUS RESTAURANTES':'TU RESTAURANTE'}</span><RestaurantSwitcher key={restaurantId} restaurants={restaurants} activeId={restaurantId} basePath={basePath}/><nav className="app-nav" aria-label="Navegación de tu restaurante">{navigation.map(n=><Link key={n.id} href={`${basePath}?section=${n.id}&restaurant=${restaurantId}`} aria-current={section===n.id?'page':undefined}><n.icon size={18} aria-hidden="true"/>{portal?(n.id==='restaurante'?'Restaurantes':n.id==='encuesta'?'Encuestas':n.id==='equipo'?'Equipo':n.label):n.id==='restaurante'&&restaurantCount>1?'Mis restaurantes':n.label}{!portal&&n.id==='encuesta'&&surveyNeedsSetup&&<span className="nav-setup-indicator" title="Encuesta pendiente de publicar"><CircleAlert size={15} aria-hidden="true"/><span className="sr-only">Encuesta pendiente de publicar</span></span>}</Link>)}</nav><div className="sidebar-bottom"><form action={signOut}><SignOutButton sidebar/></form></div></aside>
    <main id="main" className="dashboard-main" aria-busy={pending} inert={open}>{pending&&<LoadingIndicator dashboard/>}<div className="dashboard-content" hidden={pending}>{children}</div></main></div></>;
}
