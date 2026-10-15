import assert from 'node:assert/strict';import{World}from'../public/engine.mjs';
const blank=opt=>{let w=new World(1,opt);w.cells.forEach(c=>{c.f=0;c.p=0;c.a=null;c.hunger=0});return w};
let d=blank({diffusion:.4});d.cells[210].f=10;for(let t=0;t<100;t++)d.diffuse();assert(Math.abs(d.cells.reduce((s,c)=>s+c.f,0)-10)<1e-8);assert(d.cells[211].f>0);
let off=blank({diffusion:0});off.cells[210].f=10;off.diffuse();assert.equal(off.cells[210].f,10);assert.equal(off.cells[211].f,0);
let w=blank({diffusion:0});w.cells[210].p=2;w.cells[211].p=.2;w.cells[210].f=5;w.cells[213].f=10;w.step();assert(w.cells[211].p>.2);assert(w.cells[211].hunger===0);assert(w.cells.filter(c=>c.p>0).length===3,'thread extends toward remote food');
let split=blank();for(let i of [210,211,212])split.cells[i].p=1;assert.equal(split.networks().length,1);split.cells[211].p=0;assert.equal(split.networks().length,2);
for(let seed of [42,123,7]){let w=new World(seed);for(let t=0;t<200;t++){w.step();for(let c of w.cells){assert(c.f>=-1e-8&&c.f<=10+1e-8);assert(c.p>=-1e-8&&c.p<=10+1e-8);assert(w.total(c)<=11+1e-8);}}console.log('seed',seed,'tick',w.tick,w.stats,'networks',w.networks().length);}
let a=new World(42),b=new World(42);for(let t=0;t<30;t++){a.step();b.step()}assert.deepEqual(a.cells,b.cells);console.log('Passed diffusion conservation/off, shared feeding, thread extension, splitting, deterministic replay, and 600 ticks of capacity checks.');
