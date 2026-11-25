import assert from 'node:assert/strict';import{World as BaseWorld}from'./reference-world.mjs';class World extends BaseWorld{constructor(seed=42,options={}){super(seed,{size:20,animalSenseCost:0,plantSenseCost:0,fastGrowthCost:0,memoryCost:0,memoryStrength:0,...options});}}
const fixture=(options={})=>{let w=new World(42,{diffusion:0,regen:0,metabolism:0,growth:0,divisionChance:0,crowdThreshold:5,dartDistance:3,...options});w.cells.forEach(c=>{c.f=0;c.p=0;c.a=null});w.cells[210].a={id:w.nextId++,size:1,energy:1};for(let i of [189,190,191,209,229])w.cells[i].a={id:w.nextId++,size:1,energy:1};return w};
const snap=w=>w.cells.map(c=>({...c,a:c.a?{...c.a}:null}));
let w=fixture(),id=w.cells[210].a.id,s=snap(w),target=w.dart(210,s);assert.notEqual(target,210);assert(w.crowdAt(target,s,210)<5);assert(Math.max(Math.abs(target%20-10),Math.abs(Math.floor(target/20)-10))<=3);assert.equal(w.cells[target].a.id,id);assert.equal(w.darts,1);assert.equal(w.cells[210].a,null);
let off=fixture({crowdThreshold:9});assert.equal(off.dart(210,snap(off)),210);let below=fixture({crowdThreshold:6});assert.equal(below.dart(210,snap(below)),210);
let blocked=fixture();for(let q of blocked.neighbors(210))if(!blocked.cells[q.i].a){blocked.cells[q.i].f=10;blocked.cells[q.i].p=.5;}
assert.equal(blocked.dart(210,snap(blocked)),210);
let priority=fixture();priority.cells[210].p=4;let old=priority.cells[210].a.id;priority.step();let moved=priority.cells.findIndex(c=>c.a?.id===old);assert.notEqual(moved,210,'crowding overrides a meal at the origin');
let one=fixture({dartDistance:1});let dest=one.dart(210,snap(one));assert(dest!==210&&one.neighbors(210).some(q=>q.i===dest));
console.log('Passed crowd threshold/off, rapid escape, capacity barriers, identity, food override, and distance control.');
