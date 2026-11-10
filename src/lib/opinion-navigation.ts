import type { OpinionParams } from './opinions';
export function opinionHref(params:OpinionParams,patch:OpinionParams={}){
 const query=new URLSearchParams();
 Object.entries({...params,...patch,section:'opiniones'}).forEach(([key,value])=>{if(value&&key!=='portal')query.set(key,value);});
 return `${params.portal?'/admin':'/dashboard'}?${query}`;
}
