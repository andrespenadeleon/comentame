import { test,before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createElement as h, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
// Render real client components, replacing only Next routing and server transports.
// No authentication bypass or fixture route is shipped in the application.
let ui: Record<string,ComponentType<any>>;
before(async()=>{
  const dir=resolve('node_modules/.cache/comentame-tests');await mkdir(dir,{recursive:true});
  const outfile=resolve(dir,'feedback-ui.mjs');
  await build({stdin:{contents:`export {Employees} from './src/components/employees'; export {SurveyEditor} from './src/components/survey-editor'; export {DashboardShell} from './src/components/dashboard-shell'; export {VerificationDialog} from './src/components/verification-dialog'; export {LoadingIndicator} from './src/components/loading-indicator';`,resolveDir:process.cwd(),loader:'tsx'},outfile,bundle:true,platform:'node',format:'esm',packages:'external',alias:{'@':resolve('src')},plugins:[{name:'server-transports',setup(b){
    b.onResolve({filter:/app\/actions\/(workspace|auth)/},args=>({path:args.path,namespace:'stub'}));
    b.onResolve({filter:/^next\/navigation$/},()=>({path:'routing',namespace:'stub'}));
    b.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='routing'?`export const useRouter=()=>({refresh(){},push(){}});`:`export const saveEmployee=async()=>({}); export const deleteEmployee=async()=>({}); export const uploadEmployeePhoto=async()=>({}); export const saveSurvey=async()=>({}); export const saveProfile=async()=>({}); export const saveRestaurant=async()=>({}); export const signOut=async()=>{};`,loader:'js'}));
  }}]});
  ui=await import(pathToFileURL(outfile).href);
});
const restaurantId='00000000-0000-4000-8000-000000000001';
const restaurants=[{id:restaurantId,name:'El Botanero'},{id:'00000000-0000-4000-8000-000000000002',name:'Café Norte'}];
const employees=[{id:'00000000-0000-4000-8000-000000000003',restaurant_id:restaurantId,first_name:'Ana',last_name:'García',role:'Mesera',photo_path:null},{id:'00000000-0000-4000-8000-000000000004',restaurant_id:restaurants[1].id,first_name:'Luis',last_name:'Pérez',role:'Mesero',photo_path:null}];
test('equipo vacío tiene una sola cabecera y únicamente el CTA del empty state',()=>{
 const html=renderToStaticMarkup(h(ui.Employees,{restaurantId,employees:[],restaurants:[restaurants[0]],onboarding:true}));
 assert.equal((html.match(/<h2/g)||[]).length,1);assert.match(html,/Agregar primer empleado/);assert.doesNotMatch(html,/class="[^"]*team-add/);assert.doesNotMatch(html,/Perfiles sin acceso/);assert.doesNotMatch(html,/Filtrar por restaurante/);
});
test('equipo global muestra restaurantes, filtro condicional y acciones discretas',()=>{
 const html=renderToStaticMarkup(h(ui.Employees,{restaurantId,employees,restaurants}));
 assert.match(html,/Filtrar por restaurante/);assert.match(html,/Todos los restaurantes/);
 for(const name of ['El Botanero','Café Norte','Ana','Luis'])assert.ok(html.includes(name));
 assert.match(html,/Editar a Ana García/);assert.match(html,/Eliminar a Ana García/);
 assert.doesNotMatch(html,/Copiar enlace|\/encuesta\/|Los enlaces conservan/);
 const single=renderToStaticMarkup(h(ui.Employees,{restaurantId,employees:[employees[0]],restaurants:[restaurants[0]]}));assert.doesNotMatch(single,/Filtrar por restaurante/);
});
test('encuesta nueva comienza con estrellas sin controles para modificar la pregunta fija',()=>{
 const html=renderToStaticMarkup(h(ui.SurveyEditor,{restaurantId}));
 assert.match(html,/¿Cómo estuvo tu experiencia\?/);assert.match(html,/Fija · Obligatoria/);assert.doesNotMatch(html,/Eliminar.*pregunta 1/);assert.match(html,/★★★★★/);
});
test('navegación ordenada y cierre de sesión al final',()=>{
 const html=renderToStaticMarkup(h(ui.DashboardShell,{name:'Ana',restaurantName:'El Botanero',restaurantId,restaurantCount:2,section:'resumen',children:h('p',{},'Contenido')}));
 const labels=['Resumen','Mis restaurantes','Mi equipo','Mi encuesta','Cerrar sesión'];
 let previous=-1;for(const label of labels){const index=html.indexOf(label);assert.ok(index>previous,label);previous=index;}
 assert.match(html,/Abrir navegación/);assert.match(html,/aria-expanded="false"/);
});
test('verificación y loaders usan semántica accesible',()=>{
 const modal=renderToStaticMarkup(h(ui.VerificationDialog,{email:'admin@example.com',onClose(){}}));assert.match(modal,/<dialog/);assert.match(modal,/Revisa tu correo/);assert.match(modal,/admin@example.com/);
 const spinner=renderToStaticMarkup(h(ui.LoadingIndicator,{}));assert.match(spinner,/loading-spinner/);assert.match(spinner,/role="status"/);
 const progress=renderToStaticMarkup(h(ui.LoadingIndicator,{dashboard:true}));assert.match(progress,/role="progressbar"/);assert.doesNotMatch(progress,/aria-valuenow/);
});
