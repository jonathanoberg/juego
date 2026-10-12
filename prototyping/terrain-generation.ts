import { neighbors, key } from './hex-grid.ts';
import type { Cell } from './hex-grid.ts';

export type Point = readonly [number, number];
export interface Geometry { type: string; coordinates: unknown }
export interface Feature {
  id: string; name?: string; kind: string; geometry: Geometry; properties: Record<string, unknown>; state: Record<string, unknown>;
}
export interface Patch {
  id: string; priority: number; geometry: Geometry;
  surfacePatch: Partial<Surface>; heightOffsetM?: number;
}
export interface Surface { substrate: string; vegetationDensity: number; wetness: string; waterPresent: boolean }
export interface TerrainSample { x: number; y: number; relativeHeightM: number; surface: Surface; featureIds: string[] }
export interface GeneratedCell extends TerrainSample { address: string; q: number; r: number }
export interface TerrainPrototype {
  revision: string; seed: number; worldId: string;
  background: { substrate: string; vegetationDensity: number; roughnessM: number };
  // Synthetic authoring values, not heights measured from the source image.
  ridgeHeightM: number; ridgeHalfWidthM: number;
  cliffHeightM: number; cliffInfluenceM: number;
  channelDepthM: number; channelBankWidthM: number;
}
export const icelandPrototype: TerrainPrototype = {
  revision: 'iceland-terrain-v1', seed: 48219, worldId: 'b57e5bcd-d6bd-56f7-b107-4fb1686816e9',
  background: { substrate: 'rock-and-soil', vegetationDensity: 0.35, roughnessM: 0.7 },
  ridgeHeightM: 4, ridgeHalfWidthM: 6, cliffHeightM: 6, cliffInfluenceM: 12,
  channelDepthM: 0.8, channelBankWidthM: 2,
};
const clamp=(v:number,lo=0,hi=1):number=>Math.max(lo,Math.min(hi,v));
const smooth=(t:number):number=>{t=clamp(t);return t*t*(3-2*t);};
function stringHash(s:string):number { let h=2166136261; for(const c of s){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0; }
function lattice(x:number,y:number,seed:number):number {
 let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^seed;
 h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x:number,y:number,scale:number,seed:number):number {
 const xx=x/scale,yy=y/scale,ix=Math.floor(xx),iy=Math.floor(yy),u=smooth(xx-ix),v=smooth(yy-iy);
 const a=lattice(ix,iy,seed)*(1-u)+lattice(ix+1,iy,seed)*u;
 const b=lattice(ix,iy+1,seed)*(1-u)+lattice(ix+1,iy+1,seed)*u;
 return a*(1-v)+b*v;
}
function line(g:Geometry):Point[] {return g.coordinates as Point[];}
function ring(g:Geometry):Point[] {return (g.coordinates as Point[][])[0]!;}
function segmentDistance(p:Point,a:Point,b:Point):number {
 const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
 const t=len2===0?0:clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2);
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
export function contains(g:Geometry,p:Point):boolean {
 if(g.type!=='Polygon')return false;
 const rings=g.coordinates as Point[][];
 function inside(r:Point[]):boolean {
  let result=false;
  for(let i=0,j=r.length-1;i<r.length;j=i++) {
   const a=r[i]!,b=r[j]!;
   if(segmentDistance(p,a,b)<1e-9)return true;
   if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
  }return result;
 }
 return inside(rings[0]!)&&!rings.slice(1).some(inside);
}
function nearest(g:Geometry,p:Point):{distance:number; side:number; along:number; length:number} {
 const pts=line(g);let distance=Infinity,side=0,along=0,total=0;
 for(let i=1;i<pts.length;i++) {
  const a=pts[i-1]!,b=pts[i]!,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(!len)continue;
  const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(len*len));
  const d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
  if(d<distance){distance=d;side=Math.sign(dx*(p[1]-a[1])-dy*(p[0]-a[0]));along=total+t*len;}
  total+=len;
 }return {distance,side,along,length:total};
}
const priorities:Record<string,number>={'vegetation-patch':30,slope:40,watercourse:60,channel:60,pool:70};
export class TerrainGenerator {
 readonly revision:string;
 private readonly seed:number;
 private readonly features:Feature[];
 private readonly patches:Patch[];
 private readonly config:TerrainPrototype;
 constructor(config:TerrainPrototype,features:readonly Feature[],patches:readonly Patch[]=[]) {
  this.config=structuredClone(config);
  if(!Number.isSafeInteger(config.seed) || [config.background.roughnessM,config.ridgeHeightM,config.ridgeHalfWidthM,config.cliffHeightM,config.cliffInfluenceM,config.channelDepthM,config.channelBankWidthM].some(v=>!Number.isFinite(v)||v<0)||config.ridgeHalfWidthM===0||config.cliffInfluenceM===0||config.channelBankWidthM===0)throw new Error('Invalid terrain prototype');
  this.seed=(config.seed^stringHash(config.worldId))>>>0;this.revision=config.revision;
  const priority=(f:Feature):number=>typeof f.properties.priority==='number'?f.properties.priority:(priorities[f.kind]??20);
  this.features=structuredClone([...features]).sort((a,b)=>priority(a)-priority(b)||(a.id<b.id?-1:a.id>b.id?1:0));
  this.patches=structuredClone([...patches]).sort((a,b)=>a.priority-b.priority||(a.id<b.id?-1:a.id>b.id?1:0));
 }
 sample(x:number,y:number):TerrainSample {
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e8||Math.abs(y)>1e8)throw new Error('Position outside prototype limits');
  const c=this.config,p:Point=[x,y],featureIds:string[]=[];
  let height=(noise(x,y,24,this.seed)-0.5)*2*c.background.roughnessM+(noise(x,y,4,this.seed^17)-0.5)*0.15;
  const surface:Surface={substrate:c.background.substrate,vegetationDensity:clamp(c.background.vegetationDensity+(noise(x,y,5,this.seed^91)-0.5)*0.3),wetness:'unspecified',waterPresent:false};
  for(const f of this.features) {
   if(f.geometry.type==='Polygon') {
    if(!contains(f.geometry,p))continue;featureIds.push(f.id);
    const patch=f.properties.surfacePatch as Record<string,unknown>|undefined;
    if(typeof patch?.substrate==='string')surface.substrate=patch.substrate;
    if(patch?.vegetationCover==='dense-low-vegetation')surface.vegetationDensity=clamp(0.82+(noise(x,y,3,this.seed^7)-0.5)*0.18);
    if(patch?.vegetationCover==='patchy-low-vegetation')surface.vegetationDensity=clamp(0.5+(noise(x,y,4,this.seed^9)-0.5)*0.4);
    if(patch?.vegetationCover==='sparse')surface.vegetationDensity=clamp(0.1+(noise(x,y,4,this.seed^9)-0.5)*0.15);
    if(f.kind==='pool'){height-=c.channelDepthM;surface.substrate='channel-bed';surface.vegetationDensity=0;surface.waterPresent=f.state.waterPresent==='probable'||f.state.waterPresent===true;surface.wetness=surface.waterPresent?'submerged':'unspecified';}
    continue;
   }
   if(f.geometry.type!=='LineString')continue;
   const n=nearest(f.geometry,p);
   const endpoint=smooth(Math.min(n.along,n.length-n.along)/3);
   if(f.kind==='watercourse'||f.kind==='channel') {
    const widths=f.properties.channelWidthM as number[]|undefined;
    const halfWidth=widths?((widths[0]!+widths[1]!)/4):0.5;
    if(n.distance>halfWidth+c.channelBankWidthM)continue;featureIds.push(f.id);
    const weight=n.distance<=halfWidth?1:1-smooth((n.distance-halfWidth)/c.channelBankWidthM);
    height-=c.channelDepthM*weight;
    surface.vegetationDensity*=1-weight;
    if(n.distance<=halfWidth) {surface.substrate='channel-bed';surface.waterPresent=f.state.waterPresent==='probable'||f.state.waterPresent===true;surface.wetness=surface.waterPresent?'submerged':'unspecified';}
   }else if(f.kind==='ridge') {
    if(n.distance>c.ridgeHalfWidthM)continue;featureIds.push(f.id);
    height+=c.ridgeHeightM*(1-smooth(n.distance/c.ridgeHalfWidthM))*endpoint;
   }else if(f.kind==='escarpment') {
    if(n.distance>c.cliffInfluenceM)continue;featureIds.push(f.id);
    // Provisional: left of authored line is high. Flip property to reverse.
    const orientation=f.properties.highSide==='right'?-1:1;
    height+=orientation*n.side*c.cliffHeightM/2*(1-smooth(n.distance/c.cliffInfluenceM))*endpoint;
    if(n.distance<1){surface.substrate='exposed-rock';surface.vegetationDensity*=0.2;}
   }
  }
  for(const patch of this.patches)if(contains(patch.geometry,p)){Object.assign(surface,patch.surfacePatch);height+=patch.heightOffsetM??0;}
  surface.vegetationDensity=clamp(surface.vegetationDensity);
  return {x,y,relativeHeightM:height,surface,featureIds};
 }
 cell(q:number,r:number):GeneratedCell {
  const c:Cell={level:0,q,r};neighbors(c); // Validate integer coordinates.
  return {...this.sample(1.5*q,Math.sqrt(3)/2*(q+2*r)),address:key(c),q,r};
 }
 viewport(bounds:readonly [number,number,number,number]):GeneratedCell[] {
  const [xmin,ymin,xmax,ymax]=bounds;
  if(bounds.some(v=>!Number.isFinite(v))||xmin>xmax||ymin>ymax)throw new Error('Invalid viewport');
  const qmin=Math.ceil(xmin/1.5),qmax=Math.floor(xmax/1.5),cells:GeneratedCell[]=[];
  if((qmax-qmin+1)*((ymax-ymin)/Math.sqrt(3)+2)>100000)throw new Error('Viewport exceeds prototype cell limit');
  for(let q=qmin;q<=qmax;q++)for(let r=Math.ceil(ymin/Math.sqrt(3)-q/2);r<=Math.floor(ymax/Math.sqrt(3)-q/2);r++)cells.push(this.cell(q,r));
  return cells;
 }
 edge(a:Cell,b:Cell):{deltaM:number;direction:'rising'|'falling'|'level'} {
  if(a.level!==0||b.level!==0||!neighbors(a).some(n=>key(n)===key(b)))throw new Error('Expected adjacent base cells');
  const deltaM=this.cell(b.q,b.r).relativeHeightM-this.cell(a.q,a.r).relativeHeightM;
  return {deltaM,direction:Math.abs(deltaM)<1e-9?'level':deltaM>0?'rising':'falling'};
 }
}
