import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:3000';
const cases=[['/',200],['/registro',200],['/login',200],['/recuperar',200],['/privacidad',200],['/gracias',200],['/dashboard',307,'/login'],['/onboarding',307,'/login'],['/restablecer',307,'/login'],['/gracias.html',308,'/gracias'],['/index.html',308,'/'],['/favicon.ico?v=8',200],['/favicon.svg?v=8',200],['/favicon-32.png?v=8',200],['/assets/el-botanero-nfc.png',200],['/encuesta/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002',200]];
await Promise.all(cases.map(async([path,status,destination])=>{
 const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,status,path);
 if(destination)assert.equal(new URL(r.headers.get('location'),origin).pathname,destination,path);
 if(path==='/registro')assert.match(await r.text(),/Crear mi cuenta/);
 if(String(path).startsWith('/encuesta/'))assert.match(await r.text(),/No se están recopilando respuestas/);
 console.log(`OK ${status} ${path}`);
}));
