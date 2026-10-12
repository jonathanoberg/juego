import { writeFileSync } from 'node:fs';
import fixture from './fixtures/wetland-terrain.json' with {type:'json'};
import { TerrainGenerator, icelandPrototype } from './terrain-generation.ts';
import type { Feature, TerrainPrototype } from './terrain-generation.ts';
export const wetlandPrototype:TerrainPrototype={...icelandPrototype,
 revision:'wetland-terrain-v1',seed:93517,worldId:fixture.world.id,
 background:{substrate:'organic-ground',vegetationDensity:0.5,roughnessM:0.18,wetness:'damp'},
 channelDepthM:1,channelBankWidthM:2};
if(import.meta.url===`file://${process.argv[1]}`) {
 const g=new TerrainGenerator(wetlandPrototype,fixture.terrainFeatures as Feature[]);
 const bounds=fixture.source.worldBoundsM as [number,number,number,number];
 const cells=g.viewport(bounds),objects=g.objects(bounds);
 if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({prototype:wetlandPrototype,bounds,cells,objects,fixturePath:'prototyping/fixtures/wetland-terrain.json',title:'Wetland terrain-generation prototype'})+'\n');
 console.log(`${cells.length} cells; ${cells.filter(c=>c.surface.waterPresent).length} open-water centers; ${objects.length} separate trees`);
 console.log(`${fixture.terrainFeatures.length} mapped features; no sampled-cell persistence`);
}
