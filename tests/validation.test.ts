import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneSchema,signupSchema,profileSchema,restaurantSchema,employeeSchema,surveySchema,surveyPath,ratingQuestion,withInitialRating,googleMapsSchema,surveyError } from '../src/lib/validation';
const id='00000000-0000-4000-8000-000000000001';
test('normaliza teléfonos mexicanos y rechaza datos evidentes inválidos',()=>{
 for(const value of ['81 1234 5678','+52 (81) 1234-5678','528112345678'])assert.equal(phoneSchema.parse(value),'+528112345678');
 for(const value of ['','0000000000','1111111111','+1 212 555 1234','abcdef8112345678','123'])assert.equal(phoneSchema.safeParse(value).success,false,value);
});
test('registro y datos obligatorios',()=>{
 assert.equal(signupSchema.safeParse({email:'hola@example.com',password:'123'}).success,false);
 assert.equal(signupSchema.safeParse({email:'invalid',password:'12345678'}).success,false);
 assert.equal(profileSchema.safeParse({full_name:'  ',phone:'8112345678'}).success,false);
 assert.equal(restaurantSchema.safeParse({name:'Restaurante',address:'',phone:'8112345678'}).success,false);
 assert.equal(employeeSchema.safeParse({first_name:'Ana',last_name:'',role:'Mesera'}).success,false);
});
test('encuestas completas de una pantalla con tipos y opciones validados',()=>{
 const q={id,prompt:'¿Qué mejorarías?',type:'text',required:false,options:[]};
 assert.equal(surveySchema.safeParse({title:'Opinión',questions:[ratingQuestion(),q]}).success,true);
 for(const options of [[],['Uno'],['Uno','Uno'],[' Uno ','Uno']])assert.equal(surveySchema.safeParse({title:'Opinión',questions:[ratingQuestion(),{...q,type:'single',options}]}).success,false);
 assert.equal(surveySchema.safeParse({title:'Opinión',questions:[ratingQuestion(),{...q,type:'multiple',options:['Servicio','Comida']}]}).success,true);
 assert.equal(surveySchema.safeParse({title:'Opinión',questions:[]}).success,false);
 assert.equal(surveySchema.safeParse({title:'Opinión',questions:[ratingQuestion(),{...q,type:'rating'}]}).success,false);
});
test('los enlaces usan identificadores, independientemente de los nombres',()=>{
 assert.equal(surveyPath(id,id),`/encuesta/${id}/${id}`);
});

test('calificación fija y borradores existentes',()=>{
 const q={id,prompt:'Comentario',type:'text' as const,required:false,options:[]};
 const questions=withInitialRating([q]);
 assert.equal(questions[0].type,'rating');assert.equal(questions[0].required,true);
 assert.equal(withInitialRating(questions).length,2);
 assert.equal(surveySchema.safeParse({title:'Encuesta',questions:[q,ratingQuestion()]}).success,false);
 assert.equal(surveySchema.safeParse({title:'Encuesta',questions:[{...ratingQuestion(),required:false}]}).success,false);
 assert.equal(surveySchema.safeParse({title:'Encuesta',questions:[ratingQuestion()]}).success,true);
});
test('regresión: guardar opciones completas con salto de línea final',()=>{
 const q={id,prompt:'¿Qué disfrutaste?',type:'multiple',required:false,options:['Comida','Servicio','']};
 const result=surveySchema.safeParse({title:'Encuesta',questions:[ratingQuestion(),q]});
 assert.equal(result.success,true);
 if(result.success)assert.deepEqual(result.data.questions[1].options,['Comida','Servicio']);
 const invalid=surveySchema.safeParse({title:'Encuesta',questions:[ratingQuestion(),{...q,options:['','']}]});
 assert.equal(invalid.success,false);
 if(!invalid.success){assert.match(surveyError(invalid.error),/Pregunta 2:/);assert.doesNotMatch(surveyError(invalid.error),/Too small/);}
});
test('Google Maps opcional y limitado a enlaces seguros de Maps',()=>{
 for(const value of ['', 'https://maps.app.goo.gl/abc','https://www.google.com/maps/place/Mexico','https://goo.gl/maps/abc','https://maps.google.com/?q=restaurante'])assert.equal(googleMapsSchema.safeParse(value).success,true,value);
 assert.equal(googleMapsSchema.parse('https://WWW.GOOGLE.COM/maps/place/El Botanero'),'https://www.google.com/maps/place/El%20Botanero');
 for(const value of ['https://maps.app.goo.gl/','javascript:alert(1)','https://google.com.evil.com/maps/a','https://google.com/search?q=a','https://maps.app.goo.gl@evil.com/x'])assert.equal(googleMapsSchema.safeParse(value).success,false,value);
});
