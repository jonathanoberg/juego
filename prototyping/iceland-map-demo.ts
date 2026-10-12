import fixture from './fixtures/iceland-terrain.json' with { type: 'json' };
import { baseCells, boundaryEdges, parent, key } from './hex-grid.ts';
import type { Cell } from './hex-grid.ts';
import { writeFileSync } from 'node:fs';

/** Authoring helper: cover the image with explicit level-five region defaults.
 * No database writes, and no terrain generation implementation is implied.
 */
const parents=new Map<string,Cell>();
for(let q=-72;q<=72;q++)for(let r=-72;r<=72;r++) {
 const x=1.5*q,y=Math.sqrt(3)/2*(q+2*r);
 if(Math.abs(x)>104.4 || Math.abs(y)>49.7)continue;
 let c:Cell={level:0,q,r}; while(c.level<5)c=parent(c).cell;
 parents.set(key(c),c);
}
function polygon(c:Cell): number[][] {
 const edges=boundaryEdges(baseCells(c));
 const k=(v:readonly number[])=>v.join(',');
 const next=new Map(edges.map(([a,b])=>[k(a),b]));
 const start=edges[0]![0];let p=start;const coordinates:number[][]=[];
 do {coordinates.push([p[0]/2,p[1]*Math.sqrt(3)/2]);p=next.get(k(p))!;}while(k(p)!==k(start));
 coordinates.push(coordinates[0]!);
 if(coordinates.length!==edges.length+1)throw new Error('Multiple boundary loops');
 return coordinates;
}
if(process.argv[2]) {
 const result={...fixture,terrainRegions:[...parents.values()].map((c,i)=>({
  id:`b54626a7-1264-4c98-a529-${String(i+1).padStart(12,'0')}`,
  worldId:fixture.world.id,parentId:null,cellAddress:key(c),level:c.level,childSlot:null,
  terrainLabel:'rocky ground with low vegetation',
  footprint:{type:'MultiPolygon',coordinates:[[polygon(c)]]},
  surfaceDefaults:{substrate:'rock-and-soil',vegetationCover:'patchy-low-vegetation'},
  reliefDefaults:{unevenness:'rugged'},constraints:{},
  generatorId:fixture.terrainGenerators[0]!.id,generationSeed:48219,generationParams:{},revision:1,
 }))};
 writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
}
console.log(`Extent: 204.8 × 95.4 meters; ${parents.size} level-five background specifications`);
console.log(`Features: ${fixture.terrainFeatures.length}; no persistent edits or authored cell boundaries`);
for(const f of fixture.terrainFeatures)console.log(`${f.kind}: ${f.name}`);
