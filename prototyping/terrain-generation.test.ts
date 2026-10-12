import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/iceland-terrain.json' with { type:'json' };
import { TerrainGenerator, icelandPrototype } from './terrain-generation.ts';
import type { Feature } from './terrain-generation.ts';
import { slots } from './hex-grid.ts';
const features=fixture.terrainFeatures as Feature[];
const generator=()=>new TerrainGenerator(icelandPrototype,features);
test('overlapping viewports and reversed request order reproduce exactly the same cells',()=>{
 const g=generator(),a=g.viewport([-20,-15,10,15]),b=g.viewport([-5,-10,20,10]);
 const lookup=new Map(a.map(c=>[c.address,c]));let overlap=0;
 for(const c of b)if(lookup.has(c.address)){assert.deepEqual(c,lookup.get(c.address));overlap++;}
 assert.ok(overlap>50);
 for(const c of [...a].reverse())assert.deepEqual(g.cell(c.q,c.r),c);
 assert.deepEqual(generator().viewport([-20,-15,10,15]),a);
});
test('feature input order does not change generated terrain',()=>{
 const a=generator(),b=new TerrainGenerator(icelandPrototype,[...features].reverse());
 for(const p of [[0,0],[-57,-30],[25,10],[-60,20]])assert.deepEqual(a.sample(p[0]!,p[1]!),b.sample(p[0]!,p[1]!));
});
test('channel bed and pool remove vegetation and expose explicit water state',()=>{
 const g=generator(),water=features.find(f=>f.name==='Western winding channel')!;
 const p=(water.geometry.coordinates as number[][])[12]!;
 assert.equal(g.sample(p[0]!,p[1]!).surface.waterPresent,true);
 assert.equal(g.sample(p[0]!,p[1]!).surface.substrate,'channel-bed');
 assert.equal(g.sample(p[0]!,p[1]!).surface.vegetationDensity,0);
 assert.equal(g.sample(-57.5,-30.3).surface.waterPresent,true);
 const dry={...water,state:{waterPresent:false}};
 const s=new TerrainGenerator(icelandPrototype,[dry]).sample(p[0]!,p[1]!);
 assert.equal(s.surface.substrate,'channel-bed');assert.equal(s.surface.waterPresent,false);
});
test('ridge raises a crest and explicit cliff makes a discontinuous step',()=>{
 const line={type:'LineString',coordinates:[[-10,0],[10,0]]};
 const ridge:Feature={id:'ridge',kind:'ridge',geometry:line,properties:{},state:{}};
 const bare=new TerrainGenerator(icelandPrototype,[]),g=new TerrainGenerator(icelandPrototype,[ridge]);
 assert.ok(Math.abs(g.sample(0,0).relativeHeightM-bare.sample(0,0).relativeHeightM-4)<1e-10);
 const cliff:Feature={...ridge,id:'cliff',kind:'escarpment'};
 const cg=new TerrainGenerator(icelandPrototype,[cliff]);
 assert.ok(Math.abs((cg.sample(0,1e-6).relativeHeightM-cg.sample(0,-1e-6).relativeHeightM)-6)<1e-4);
});
test('relative edge differences reverse and telescope around closed routes',()=>{
 const g=generator();
 for(const [q,r] of [[0,0],[-40,10],[15,-20]]) {
  const route=slots.slice(1).map(d=>({level:0,q:q!+d.q,r:r!+d.r}));let sum=0;
  for(let i=0;i<route.length;i++){const a=route[i]!,b=route[(i+1)%route.length]!;const delta=g.edge(a,b).deltaM;assert.ok(Math.abs(delta+g.edge(b,a).deltaM)<1e-12);sum+=delta;}
  assert.ok(Math.abs(sum)<1e-10);
 }
});
test('persistent local edits win over features',()=>{
 const patch={id:'cleared',priority:1,geometry:{type:'Polygon',coordinates:[[[-65,-35],[-50,-35],[-50,-25],[-65,-25],[-65,-35]]]},surfacePatch:{substrate:'paved',vegetationDensity:0,waterPresent:false,wetness:'dry'},heightOffsetM:2};
 const g=new TerrainGenerator(icelandPrototype,features,[patch]),bare=generator();
 const p=g.sample(-57.5,-30.3);assert.equal(p.surface.substrate,'paved');assert.equal(p.surface.waterPresent,false);assert.equal(p.surface.vegetationDensity,0);assert.equal(p.relativeHeightM,bare.sample(-57.5,-30.3).relativeHeightM+2);
});
test('changing seed or rules changes generated detail; invalid requests fail',()=>{
 const g=generator(),other=new TerrainGenerator({...icelandPrototype,seed:42},features);
 assert.notEqual(g.sample(0,0).relativeHeightM,other.sample(0,0).relativeHeightM);
 assert.throws(()=>g.sample(NaN,0));assert.throws(()=>g.cell(0.5,0));assert.throws(()=>g.viewport([-10000,-10000,10000,10000]));assert.throws(()=>g.edge({level:0,q:0,r:0},{level:0,q:3,r:0}));
});
