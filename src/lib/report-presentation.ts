// Presentation adapters only: preserve unstructured older reports without inferring missing fields.
export function executiveSummary(summary:string){
 const pattern=/(?:^|\n|\s)(?:[¿*#\s]*)(?:qué\s+)?(cambiar|mantener|vigilar)\s*[:：]\s*/giu;
 const matches=[...summary.matchAll(pattern)];
 const priorities:{key:string;title:string;text:string|null}[]=[{key:'cambiar',title:'Qué cambiar',text:null},{key:'mantener',title:'Qué mantener',text:null},{key:'vigilar',title:'Qué vigilar',text:null}];
 for(let i=0;i<matches.length;i++){const m=matches[i],priority=priorities.find(p=>p.key===m[1].toLowerCase());if(priority&&!priority.text)priority.text=summary.slice(m.index!+m[0].length,matches[i+1]?.index??summary.length).trim();}
 return {takeaway:(matches.length?summary.slice(0,matches[0].index):summary).replace(/^\s*(?:conclusión principal|conclusión)\s*:\s*/iu,'').trim(),priorities};
}
export function findingPresentation(observation:string){
 const pattern=/(?:^|;|\n)\s*(Tipo|Observación|Impacto operativo(?:\s*\([^)]*\))?|Solidez(?: de evidencia)?)\s*:\s*/giu;
 const matches=[...observation.matchAll(pattern)];
 if(!matches.length)return {observation,type:null,impact:null,impactLabel:null,strength:null};
 let text=observation.slice(0,matches[0].index).trim(),type:string|null=null,impact:string|null=null,impactLabel:string|null=null,strength:string|null=null;
 matches.forEach((m,i)=>{const value=observation.slice(m.index!+m[0].length,matches[i+1]?.index??observation.length).trim(),key=m[1].toLowerCase();if(key==='tipo')type=value;else if(key==='observación')text=value;else if(key.startsWith('impacto')){impact=value;impactLabel=m[1];}else if(key.startsWith('solidez'))strength=value;});
 return {observation:text||observation,type,impact,impactLabel,strength};
}
export function actionPriority(reason:string){const value=reason.match(/prioridad\s*:?\s*(alta|media|baja)/iu)?.[1].toLowerCase();return value??null;}
export const reportIntent={change:'Cambiar',replicate:'Replicar',improve:'Mejorar',investigate:'Investigar'};
export const reportPriority={high:'Alta',medium:'Media',low:'Baja'};
