import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {LandingDemo,LandingNav,HowItWorks,LeadForm} from '../src/components/landing-interactions';
test('la landing conserva navegación, lead form y demos con etiquetas accesibles',()=>{
 const nav=renderToStaticMarkup(createElement(LandingNav));
 assert.match(nav,/href="\/registro"/);assert.match(nav,/href="\/login"/);assert.match(nav,/aria-expanded="false"/);
 const form=renderToStaticMarkup(createElement(LeadForm));assert.match(form,/name="contact"/);assert.match(form,/id="lead-error"/);
 const how=renderToStaticMarkup(createElement(HowItWorks));assert.match(how,/aria-pressed="true"/);
 const demo=renderToStaticMarkup(createElement(LandingDemo));assert.match(demo,/Datos ficticios|datos ficticios/);assert.match(demo,/Sin base de datos ni conexión a Google/);assert.match(demo,/aria-label="1 estrella"/);
});
