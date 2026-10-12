import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/wetland-terrain.json' with {type:'json'};
import { TerrainGenerator, contains } from './terrain-generation.ts';
import type { Feature } from './terrain-generation.ts';
import { wetlandPrototype } from './wetland-terrain-demo.ts';
const features=fixture.terrainFeatures as Feature[];
const g=()=>new TerrainGenerator(wetlandPrototype,features);
test('pond basin is smooth across shore, wet margins lie outside water, and dry state retains basin',()=>{
 const f:Feature={id:'pond',kind:'pond',geometry:{type:'Polygon',coordinates:[[[-10,-10],[10,-10],[10,10],[-10,10],[-10,-10]]]},properties:{depthM:1,bankWidthM:2},state:{waterPresent:true}};
 const wet=new TerrainGenerator(wetlandPrototype,[f]);
 assert.equal(wet.sample(0,0).surface.waterPresent,true);
 assert.equal(wet.sample(11,0).surface.waterPresent,false);assert.equal(wet.sample(11,0).surface.wetness,'saturated');
 assert.ok(Math.abs(wet.sample(10-1e-6,0).relativeHeightM-wet.sample(10+1e-6,0).relativeHeightM)<1e-5);
 const dry=new TerrainGenerator(wetlandPrototype,[{...f,state:{waterPresent:false}}]);
 assert.equal(dry.sample(0,0).surface.waterPresent,false);assert.equal(dry.sample(0,0).relativeHeightM,wet.sample(0,0).relativeHeightM);
});
test('pond holes remain dry land',()=>{
 const polygon={type:'Polygon',coordinates:[[[-10,-10],[10,-10],[10,10],[-10,10],[-10,-10]],[[-2,-2],[-2,2],[2,2],[2,-2],[-2,-2]]]};
 const gen=new TerrainGenerator(wetlandPrototype,[{id:'island',kind:'pond',geometry:polygon,properties:{depthM:1,bankWidthM:1},state:{waterPresent:true}}]);
 assert.equal(contains(polygon,[0,0]),false);assert.equal(gen.sample(0,0).surface.waterPresent,false);assert.equal(gen.sample(5,0).surface.waterPresent,true);
});
test('overlapping requests reproduce tree identities and no tree roots are underwater',()=>{
 const gen=g(),a=gen.objects([-90,-50,20,50]),b=gen.objects([-40,-30,70,30]);
 const inOverlap=(t:{x:number;y:number})=>t.x>=-40&&t.x<=20&&t.y>=-30&&t.y<=30;
 assert.deepEqual(a.filter(inOverlap),b.filter(inOverlap));assert.ok(a.length>20);
 assert.equal(new Set(a.map(t=>t.id)).size,a.length);
 for(const t of [...a,...b])assert.equal(gen.sample(t.x,t.y).surface.waterPresent,false);
 const before=gen.sample(-60,20);gen.objects([-90,-50,70,50]);assert.deepEqual(gen.sample(-60,20),before);
});
test('wetland terrain is deterministic across viewports and independent of feature order',()=>{
 const a=g(),b=new TerrainGenerator(wetlandPrototype,[...features].reverse());
 const cells=a.viewport([-10,-10,10,10]);assert.deepEqual(cells,b.viewport([-10,-10,10,10]));
 for(const c of cells)assert.deepEqual(c,a.cell(c.q,c.r));
});
