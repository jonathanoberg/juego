import { writeFileSync } from 'node:fs';
import { baseCells, boundaryEdges, boundaryArea, baseCenter, parent, key } from './hex-grid.ts';

const colors=['#e9c46a','#80b7ad','#a9b6df','#e3a5b0','#b8cf91','#cbb6dc','#edb68c'];
const regions=[];
for(let q=-1;q<=1;q++)for(let r=-1;r<=1;r++)regions.push({level:2,q,r});
const paths=regions.map((c,i)=> {
 const edges=boundaryEdges(baseCells(c));
 const d=edges.map(([[x,y],[xx,yy]])=>`M ${x/2} ${y*Math.sqrt(3)/2} L ${xx/2} ${yy*Math.sqrt(3)/2}`).join(' ');
 // Even-odd fill uses each base hex; outline cancels internal edges exactly.
 const fill=baseCells(c).map(b=>boundaryEdges([b]).map(([a],j)=>`${j?'L':'M'} ${a[0]/2} ${a[1]*Math.sqrt(3)/2}`).join(' ')+' Z').join(' ');
 const p=baseCenter(c), x=1.5*p.q,y=Math.sqrt(3)/2*(p.q+2*p.r);
 return `<path d="${fill}" fill="${colors[i%colors.length]}" stroke="#ffffff" stroke-width="0.025"/><path d="${d}" fill="none" stroke="#243544" stroke-width="0.12"/><text x="${x}" y="${y}" text-anchor="middle" font-size="1.2">${c.q},${c.r}</text>`;
});
const output=process.argv[2];
if(output) {
 writeFileSync(output,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25 -25 50 50" width="900" height="900"><rect x="-25" y="-25" width="50" height="50" fill="#f8fafc"/>${paths.join('')}</svg>`);
 console.log(`Wrote level-2 footprint diagram: ${output}`);
}
for(let level=0;level<=4;level++) {
 const c={level,q:0,r:0},cells=baseCells(c);
 const contacts=new Set<string>();
 for(const b of cells) for(const [dq,dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
  let n={level:0,q:b.q+dq!,r:b.r+dr!}; while(n.level<level)n=parent(n).cell;
  if(key(n)!==key(c))contacts.add(key(n));
 }
 console.log(`Level ${level}: ${cells.length} base cells; area ${boundaryArea(boundaryEdges(cells)).toFixed(3)} m²; ${contacts.size} touching aggregates`);
}
