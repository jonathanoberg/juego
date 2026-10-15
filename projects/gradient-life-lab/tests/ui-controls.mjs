import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),elements=new Map();
const context=new Proxy({},{get:(target,key)=>target[key]||(()=>{})});
for(const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const value=tag[0].match(/\bvalue="([^"]*)"/);elements.set(tag[1],{value:value?.[1]||'',textContent:'',innerHTML:'',getContext:()=>context});}
globalThis.document={getElementById:id=>{assert(elements.has(id),'missing UI element '+id);return elements.get(id)}};globalThis.requestAnimationFrame=()=>{};
await import('../public/app.mjs');const el=id=>elements.get(id);
el('step').onclick();let baseline=el('stats').innerHTML;el('reset').onclick();el('growth').value='0';el('growth').oninput();assert.match(el('pending').textContent,/Pending/);el('step').onclick();assert.equal(el('stats').innerHTML,baseline,'pending edits cannot alter current run');el('reset').onclick();el('step').onclick();assert.notEqual(el('stats').innerHTML,baseline,'reset applies pending traits');assert.match(el('pending').textContent,/captured at reset/);
console.log('Passed UI startup, control wiring, pending-control isolation and reset application (DOM harness, not a browser).');
